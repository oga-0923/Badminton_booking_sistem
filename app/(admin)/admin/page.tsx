import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const [{ count: courtsCount }, { count: reservationsCount }, { count: activeLoansCount }] = await Promise.all([
    supabase.from("courts").select("*", { count: "exact", head: true }),
    supabase.from("reservations").select("*", { count: "exact", head: true }).eq("status", "confirmed"),
    supabase.from("equipment_loans").select("*", { count: "exact", head: true }).eq("status", "borrowed"),
  ]);

  const stats = [
    { label: "コート数", value: courtsCount ?? 0, href: "/admin/courts" },
    { label: "確定予約数", value: reservationsCount ?? 0, href: "/admin/reservations" },
    { label: "貸出中の備品", value: activeLoansCount ?? 0, href: "/admin/rentals" },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {stats.map((stat) => (
        <Link
          key={stat.href}
          href={stat.href}
          className="rounded-lg border border-slate-200 p-4 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
        >
          <p className="text-sm text-slate-500">{stat.label}</p>
          <p className="mt-1 text-3xl font-bold">{stat.value}</p>
        </Link>
      ))}
    </div>
  );
}
