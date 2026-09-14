import { createClient } from "@/lib/supabase/server";
import { formatLocalDate } from "@/lib/date";
import { CourtsAdmin } from "@/components/admin/CourtsAdmin";

export default async function AdminCourtsPage() {
  const supabase = await createClient();

  const [{ data: courts }, { data: closures }] = await Promise.all([
    supabase.from("courts").select("*").order("name"),
    supabase.from("court_closures").select("*").gte("closed_date", formatLocalDate(new Date())).order("closed_date"),
  ]);

  return <CourtsAdmin courts={courts ?? []} closures={closures ?? []} />;
}
