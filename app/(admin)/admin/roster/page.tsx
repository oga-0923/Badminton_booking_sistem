import { createClient } from "@/lib/supabase/server";
import { RosterAdmin } from "@/components/admin/RosterAdmin";

export default async function AdminRosterPage() {
  const supabase = await createClient();

  const { count } = await supabase.from("student_roster").select("*", { count: "exact", head: true });

  return <RosterAdmin currentCount={count ?? 0} />;
}
