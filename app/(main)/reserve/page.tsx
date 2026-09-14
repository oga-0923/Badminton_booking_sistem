import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReserveCalendar } from "@/components/ReserveCalendar";

export default async function ReservePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (!profile) redirect("/profile");

  const [{ data: courts }, { data: settings }] = await Promise.all([
    supabase.from("courts").select("*").eq("is_active", true).order("name"),
    supabase.from("venue_settings").select("*").eq("id", 1).single(),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <ReserveCalendar
        userId={user.id}
        courts={courts ?? []}
        settings={
          settings ?? {
            id: 1,
            open_time: "18:00",
            close_time: "21:00",
            slot_duration_minutes: 60,
            booking_window_days: 14,
            cancellation_deadline_days_before: 1,
            cancellation_deadline_time: "23:59",
            price_per_slot: 0,
            pending_payment_timeout_minutes: 10,
            rental_fee_per_item: 10,
            updated_at: new Date().toISOString(),
          }
        }
      />
    </div>
  );
}
