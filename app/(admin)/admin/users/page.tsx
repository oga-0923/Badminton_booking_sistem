import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UsersAdmin } from "@/components/admin/UsersAdmin";

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: myProfile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (myProfile?.role !== "admin") redirect("/admin");

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, student_id, role, is_fee_exempt")
    .order("full_name");

  return <UsersAdmin profiles={profiles ?? []} currentUserId={user.id} />;
}
