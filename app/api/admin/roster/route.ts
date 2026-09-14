import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRoleApi } from "@/lib/auth/admin-guard";

interface RosterRow {
  student_id: string;
  full_name: string | null;
  email: string | null;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const guard = await requireRoleApi(supabase, ["staff", "admin"]);
  if (guard instanceof NextResponse) return guard;

  const body = await request.json().catch(() => null);
  const rows = Array.isArray(body?.rows) ? (body.rows as RosterRow[]) : null;

  if (!rows) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const cleaned = rows
    .map((r) => ({
      student_id: String(r.student_id ?? "").trim(),
      full_name: r.full_name ? String(r.full_name).trim() : null,
      email: r.email ? String(r.email).trim() : null,
    }))
    .filter((r) => r.student_id.length > 0);

  if (cleaned.length === 0) {
    return NextResponse.json({ error: "empty" }, { status: 400 });
  }

  // 全置き換え: 既存の名簿を削除してから新しい名簿を投入する。
  const { error: deleteError } = await supabase.from("student_roster").delete().neq("student_id", "");
  if (deleteError) {
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  const { error: insertError } = await supabase.from("student_roster").insert(cleaned);
  if (insertError) {
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ count: cleaned.length }, { status: 201 });
}
