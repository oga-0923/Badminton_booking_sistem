import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRoleApi } from "@/lib/auth/admin-guard";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const guard = await requireRoleApi(supabase, ["staff", "admin"]);
  if (guard instanceof NextResponse) return guard;

  const body = await request.json().catch(() => null);
  const update: { status?: "returned"; returned_at?: string; fee_collected?: boolean } = {};

  if (body?.mark_returned === true) {
    update.status = "returned";
    update.returned_at = new Date().toISOString();
  }
  if (typeof body?.fee_collected === "boolean") {
    update.fee_collected = body.fee_collected;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { data, error } = await supabase.from("equipment_loans").update(update).eq("id", id).select().single();

  if (error) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ loan: data });
}
