"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";

export function AdminNav({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useI18n();
  const pathname = usePathname();

  const items = [
    { href: "/admin", label: t("admin.dashboard") },
    { href: "/admin/checkin", label: t("admin.checkin") },
    { href: "/admin/payments", label: t("admin.payments") },
    { href: "/admin/courts", label: t("admin.courts") },
    { href: "/admin/reservations", label: t("admin.reservations") },
    { href: "/admin/rentals", label: t("admin.rentals") },
    { href: "/admin/roster", label: t("admin.roster") },
    ...(isAdmin ? [{ href: "/admin/users", label: t("admin.users") }] : []),
  ];

  return (
    <nav className="-mx-4 flex gap-2 overflow-x-auto border-b border-slate-200 px-4 pb-3 dark:border-slate-800">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${
            pathname === item.href
              ? "bg-emerald-600 text-white"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
