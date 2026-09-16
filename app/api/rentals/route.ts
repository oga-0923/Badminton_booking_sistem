import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { formatLocalDate } from "@/lib/date";
import { buildTimeSlots } from "@/lib/reservation/slots";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const equipmentId = body?.equipment_id;
  const quantity = Number(body?.quantity);

  if (typeof equipmentId !== "string" || !Number.isInteger(quantity) || quantity < 1) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  // 料金判定はクライアント申告ではなく、サーバー側で学生名簿照合・手数料免除フラグを見て決定する。
  const [{ data: verified }, { data: profile }] = await Promise.all([
    supabase.rpc("is_verified_student", { p_user_id: user.id }),
    supabase.from("profiles").select("is_fee_exempt").eq("id", user.id).single(),
  ]);
  const isFree = Boolean(verified) || Boolean(profile?.is_fee_exempt);

  const { data: equipment } = await supabase
    .from("equipment")
    .select("id, total_quantity")
    .eq("id", equipmentId)
    .single();

  if (!equipment) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data: settings } = await supabase.from("venue_settings").select("*").eq("id", 1).single();

  const today = formatLocalDate(new Date());
  const nowHHMM = new Date().toTimeString().slice(0, 5);
  const currentSlot = settings ? buildTimeSlots(settings).find((s) => s.start <= nowHHMM && nowHHMM < s.end) : undefined;

  const { data: equipmentAvail } = await supabase.rpc("get_equipment_availability", {
    p_date: today,
    p_start_time: currentSlot?.start ?? null,
  });
  const available = equipmentAvail?.find((r) => r.equipment_id === equipmentId)?.available ?? equipment.total_quantity;

  if (quantity > available) {
    return NextResponse.json({ error: "insufficient_stock" }, { status: 409 });
  }

  const feePerItem = settings?.rental_fee_per_item ?? 10;
  const feeAmount = isFree ? 0 : feePerItem * quantity;

  const { data, error } = await supabase
    .from("equipment_loans")
    .insert({
      equipment_id: equipmentId,
      user_id: user.id,
      quantity,
      status: "borrowed",
      has_student_id: isFree,
      fee_amount: feeAmount,
    })
    .select()
    .single();

  if (error) {
    console.error("rental insert failed", error);
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ loan: data }, { status: 201 });
}
