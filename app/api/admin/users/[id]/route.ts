import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRoleApi } from "@/lib/auth/admin-guard";
import type { UserRole } from "@/types/database";

const VALID_ROLES: UserRole[] = ["student", "staff", "admin"];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const guard = await requireRoleApi(supabase, ["admin"]);
  if (guard instanceof NextResponse) return guard;

  const body = await request.json().catch(() => null);
  const update: { role?: UserRole; is_fee_exempt?: boolean } = {};

  if (body?.role !== undefined) {
    if (typeof body.role !== "string" || !VALID_ROLES.includes(body.role as UserRole)) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }
    update.role = body.role as UserRole;
  }

  if (body?.is_fee_exempt !== undefined) {
    if (typeof body.is_fee_exempt !== "boolean") {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }
    update.is_fee_exempt = body.is_fee_exempt;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { data, error } = await supabase.from("profiles").update(update).eq("id", id).select().single();

  if (error) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}
