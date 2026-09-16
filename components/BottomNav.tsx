"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { useUser } from "@/lib/supabase/useUser";
import { useProfileRole } from "@/lib/supabase/useProfileRole";

export function BottomNav() {
  const { t } = useI18n();
  const pathname = usePathname();
  const { user } = useUser();
  const role = useProfileRole(user?.id);

  if (!user) return null;

  const isAdminOrStaff = role === "staff" || role === "admin";
  const isAdminSection = pathname.startsWith("/admin");

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)] dark:border-slate-800 dark:bg-slate-900/95 md:hidden">
      <div className={`mx-auto grid ${isAdminOrStaff ? "grid-cols-2" : "grid-cols-1"} max-w-md`}>
        <Link
          href="/reserve"
          className={`flex flex-col items-center gap-0.5 py-2 text-xs ${
            !isAdminSection ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"
          }`}
        >
          <CalendarDays className="h-5 w-5" aria-hidden />
          {t("nav.bottomReserver")}
        </Link>
        {isAdminOrStaff && (
          <Link
            href="/admin/payments"
            className={`flex flex-col items-center gap-0.5 py-2 text-xs ${
              isAdminSection ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"
            }`}
          >
            <ShieldCheck className="h-5 w-5" aria-hidden />
            {t("nav.bottomAdmin")}
          </Link>
        )}
      </div>
    </nav>
  );
}
