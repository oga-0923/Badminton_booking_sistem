import { createClient } from "@/lib/supabase/server";
import { PaymentsAdmin } from "@/components/admin/PaymentsAdmin";

export default async function AdminPaymentsPage() {
  const supabase = await createClient();

  const [{ data: reservations }, { data: loans }] = await Promise.all([
    supabase
      .from("reservations")
      .select(
        "id, reservation_date, start_time, end_time, amount, paid, status, court_id, user_id, courts(name), profiles(full_name, student_id)"
      )
      .eq("status", "confirmed")
      .order("reservation_date", { ascending: false })
      .limit(200),
    supabase
      .from("equipment_loans")
      .select(
        "id, quantity, fee_amount, fee_collected, status, equipment_id, user_id, equipment(name, type), profiles(full_name, student_id)"
      )
      .eq("status", "borrowed"),
  ]);

  return <PaymentsAdmin reservations={reservations ?? []} loans={loans ?? []} />;
}
