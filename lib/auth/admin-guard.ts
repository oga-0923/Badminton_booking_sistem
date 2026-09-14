import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * API Route Handler 用: スタッフ/管理者(またはadmin限定)でなければエラーレスポンスを返す。
 * 戻り値が null なら認可OK。
 */
export async function requireRoleApi(
  supabase: SupabaseServerClient,
  allowedRoles: UserRole[]
): Promise<{ userId: string } | NextResponse> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();

  if (!profile || !allowedRoles.includes(profile.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return { userId: user.id };
}
