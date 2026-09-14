import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRoleApi } from "@/lib/auth/admin-guard";

export async function POST(request: Request) {
  const supabase = await createClient();
  const guard = await requireRoleApi(supabase, ["staff", "admin"]);
  if (guard instanceof NextResponse) return guard;

  const body = await request.json().catch(() => null);
  const type = body?.type;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const totalQuantity = Number(body?.total_quantity);

  if ((type !== "racket" && type !== "shuttle") || !name || !Number.isInteger(totalQuantity) || totalQuantity < 0) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("equipment")
    .insert({ type, name, total_quantity: totalQuantity })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ equipment: data }, { status: 201 });
}
