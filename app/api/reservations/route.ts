import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSlotAligned, addMinutesToTime } from "@/lib/reservation/slots";
import { isWithinBookingWindow, isSlotBookable } from "@/lib/reservation/rules";
import type { EquipmentType } from "@/types/database";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

function toQuantity(value: unknown): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const courtId = body?.court_id;
  const reservationDate = body?.reservation_date;
  const startTime = body?.start_time;
  const racketQty = toQuantity(body?.racket_quantity);
  const shuttleQty = toQuantity(body?.shuttle_quantity);

  if (
    typeof courtId !== "string" ||
    typeof reservationDate !== "string" ||
    typeof startTime !== "string" ||
    !DATE_RE.test(reservationDate) ||
    !TIME_RE.test(startTime)
  ) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { data: settings } = await supabase.from("venue_settings").select("*").eq("id", 1).single();
  if (!settings) {
    return NextResponse.json({ error: "settings_missing" }, { status: 500 });
  }

  if (!isWithinBookingWindow(reservationDate, settings)) {
    return NextResponse.json({ error: "out_of_booking_window" }, { status: 400 });
  }

  if (!isSlotAligned(startTime, settings)) {
    return NextResponse.json({ error: "invalid_time_slot" }, { status: 400 });
  }

  if (!isSlotBookable(reservationDate, startTime)) {
    return NextResponse.json({ error: "slot_in_past" }, { status: 400 });
  }

  const { data: isClosed } = await supabase.rpc("is_court_closed", {
    p_court_id: courtId,
    p_date: reservationDate,
  });
  if (isClosed) {
    return NextResponse.json({ error: "court_closed" }, { status: 400 });
  }

  const endTime = addMinutesToTime(startTime, settings.slot_duration_minutes);

  const [{ data: profile }, { data: verified }, { data: equipmentList }, { data: equipmentAvail }] =
    await Promise.all([
      supabase.from("profiles").select("is_fee_exempt").eq("id", user.id).single(),
      supabase.rpc("is_verified_student", { p_user_id: user.id }),
      racketQty > 0 || shuttleQty > 0
        ? supabase.from("equipment").select("id, type, total_quantity")
        : Promise.resolve({ data: null }),
      racketQty > 0 || shuttleQty > 0
        ? supabase.rpc("get_equipment_availability", { p_date: reservationDate, p_start_time: startTime })
        : Promise.resolve({ data: null }),
    ]);

  const isFeeExempt = Boolean(profile?.is_fee_exempt) || Boolean(verified);
  const amount = isFeeExempt ? 0 : settings.price_per_slot;

  const wantedByType: Partial<Record<EquipmentType, number>> = { racket: racketQty, shuttle: shuttleQty };
  const equipmentByType = new Map<EquipmentType, { id: string; total_quantity: number }>();
  for (const e of equipmentList ?? []) {
    equipmentByType.set(e.type, { id: e.id, total_quantity: e.total_quantity });
  }
  const availableByEquipment = new Map<string, number>();
  for (const row of equipmentAvail ?? []) {
    availableByEquipment.set(row.equipment_id, row.available);
  }

  for (const [type, qty] of Object.entries(wantedByType) as [EquipmentType, number][]) {
    if (qty <= 0) continue;
    const equipment = equipmentByType.get(type);
    if (!equipment) {
      return NextResponse.json({ error: "equipment_not_found" }, { status: 400 });
    }
    const available = availableByEquipment.get(equipment.id) ?? equipment.total_quantity;
    if (qty > available) {
      return NextResponse.json({ error: "insufficient_stock", equipment_type: type }, { status: 409 });
    }
  }

  const { data: reservation, error } = await supabase
    .from("reservations")
    .insert({
      court_id: courtId,
      user_id: user.id,
      reservation_date: reservationDate,
      start_time: startTime,
      end_time: endTime,
      status: "confirmed",
      amount,
      paid: amount === 0,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "slot_taken" }, { status: 409 });
    }
    console.error("reservation insert failed", error);
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  const loanInserts = (Object.entries(wantedByType) as [EquipmentType, number][])
    .filter(([, qty]) => qty > 0)
    .map(([type, qty]) => {
      const equipment = equipmentByType.get(type)!;
      return {
        equipment_id: equipment.id,
        reservation_id: reservation.id,
        user_id: user.id,
        quantity: qty,
        status: "borrowed" as const,
        has_student_id: isFeeExempt,
        fee_amount: isFeeExempt ? 0 : settings.rental_fee_per_item * qty,
      };
    });

  if (loanInserts.length > 0) {
    const { error: loanError } = await supabase.from("equipment_loans").insert(loanInserts);
    if (loanError) {
      console.error("rental insert failed during reservation, rolling back", loanError);
      await supabase.from("reservations").delete().eq("id", reservation.id);
      return NextResponse.json({ error: "rental_insert_failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ reservation }, { status: 201 });
}
