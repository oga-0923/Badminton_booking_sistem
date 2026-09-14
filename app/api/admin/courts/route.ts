import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRoleApi } from "@/lib/auth/admin-guard";

export async function POST(request: Request) {
  const supabase = await createClient();
  const guard = await requireRoleApi(supabase, ["staff", "admin"]);
  if (guard instanceof NextResponse) return guard;

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!name) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { data, error } = await supabase.from("courts").insert({ name }).select().single();

  if (error) {
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ court: data }, { status: 201 });
}
