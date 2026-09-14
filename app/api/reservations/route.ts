import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSlotAligned, addMinutesToTime } from "@/lib/reservation/slots";
import { isWithinBookingWindow } from "@/lib/reservation/rules";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

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

  const { data: isClosed } = await supabase.rpc("is_court_closed", {
    p_court_id: courtId,
    p_date: reservationDate,
  });
  if (isClosed) {
    return NextResponse.json({ error: "court_closed" }, { status: 400 });
  }

  const endTime = addMinutesToTime(startTime, settings.slot_duration_minutes);

  const { data: profile } = await supabase.from("profiles").select("is_fee_exempt").eq("id", user.id).single();
  const amount = profile?.is_fee_exempt ? 0 : settings.price_per_slot;

  const { data, error } = await supabase
    .from("reservations")
    .insert({
      court_id: courtId,
      user_id: user.id,
      reservation_date: reservationDate,
      start_time: startTime,
      end_time: endTime,
      status: "confirmed",
      amount,
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

  return NextResponse.json({ reservation: data }, { status: 201 });
}
