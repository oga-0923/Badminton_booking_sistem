import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canCancel } from "@/lib/reservation/rules";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const isStaff = profile?.role === "staff" || profile?.role === "admin";

  const { data: reservation, error: fetchError } = await supabase
    .from("reservations")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !reservation) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (reservation.user_id !== user.id && !isStaff) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (reservation.status === "cancelled" || reservation.status === "expired") {
    return NextResponse.json({ error: "already_cancelled" }, { status: 400 });
  }

  const { data: settings } = await supabase.from("venue_settings").select("*").eq("id", 1).single();

  if (!isStaff && settings && !canCancel(reservation.reservation_date, settings)) {
    return NextResponse.json({ error: "cancellation_deadline_passed" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("reservations")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ reservation: data });
}
