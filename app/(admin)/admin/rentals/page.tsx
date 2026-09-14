import { createClient } from "@/lib/supabase/server";
import { RentalsAdmin } from "@/components/admin/RentalsAdmin";

export default async function AdminRentalsPage() {
  const supabase = await createClient();

  const [{ data: equipment }, { data: loans }] = await Promise.all([
    supabase.from("equipment").select("*").order("type"),
    supabase
      .from("equipment_loans")
      .select("id, equipment_id, quantity, status, has_student_id, fee_amount, fee_collected, borrowed_at, profiles(full_name, student_id)")
      .eq("status", "borrowed")
      .order("borrowed_at", { ascending: false }),
  ]);

  return <RentalsAdmin equipment={equipment ?? []} loans={loans ?? []} />;
}
