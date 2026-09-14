import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRoleApi } from "@/lib/auth/admin-guard";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: Request) {
  const supabase = await createClient();
  const guard = await requireRoleApi(supabase, ["staff", "admin"]);
  if (guard instanceof NextResponse) return guard;

  const body = await request.json().catch(() => null);
  const courtId = body?.court_id;
  const closedDate = body?.closed_date;
  const reason = typeof body?.reason === "string" ? body.reason.trim() || null : null;

  if (typeof courtId !== "string" || typeof closedDate !== "string" || !DATE_RE.test(closedDate)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("court_closures")
    .insert({ court_id: courtId, closed_date: closedDate, reason })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "already_closed" }, { status: 409 });
    }
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ closure: data }, { status: 201 });
}
