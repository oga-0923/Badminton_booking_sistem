import { createClient } from "@/lib/supabase/server";
import { ReservationsAdmin } from "@/components/admin/ReservationsAdmin";

export default async function AdminReservationsPage() {
  const supabase = await createClient();

  const [{ data: courts }, { data: reservations }] = await Promise.all([
    supabase.from("courts").select("*").order("name"),
    supabase
      .from("reservations")
      .select("id, reservation_date, start_time, end_time, status, amount, court_id, user_id, courts(name), profiles(full_name, student_id)")
      .order("reservation_date", { ascending: false })
      .order("start_time", { ascending: false })
      .limit(200),
  ]);

  return <ReservationsAdmin courts={courts ?? []} reservations={reservations ?? []} />;
}
