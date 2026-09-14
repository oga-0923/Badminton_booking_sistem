import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRoleApi } from "@/lib/auth/admin-guard";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const guard = await requireRoleApi(supabase, ["staff", "admin"]);
  if (guard instanceof NextResponse) return guard;

  const { error } = await supabase.from("court_closures").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
