"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, ShoppingBag, User, LogOut, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { useUser } from "@/lib/supabase/useUser";
import { useProfileRole } from "@/lib/supabase/useProfileRole";
import { createClient } from "@/lib/supabase/client";

export function BottomNav() {
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUser();
  const role = useProfileRole(user?.id);

  if (!user) return null;

  const isAdminOrStaff = role === "staff" || role === "admin";
  const isAdminSection = pathname.startsWith("/admin");

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const itemClass = (active: boolean) =>
    `flex flex-col items-center gap-0.5 py-2 text-[11px] ${
      active ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"
    }`;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)] dark:border-slate-800 dark:bg-slate-900/95">
      <div className={`mx-auto grid ${isAdminOrStaff ? "grid-cols-5" : "grid-cols-4"} max-w-md`}>
        <Link href="/reserve" className={itemClass(pathname === "/reserve")}>
          <CalendarDays className="h-5 w-5" aria-hidden />
          {t("nav.bottomReserver")}
        </Link>
        <Link href="/rental" className={itemClass(pathname === "/rental")}>
          <ShoppingBag className="h-5 w-5" aria-hidden />
          {t("nav.rental")}
        </Link>
        <Link href="/profile" className={itemClass(pathname === "/profile")}>
          <User className="h-5 w-5" aria-hidden />
          {t("nav.profile")}
        </Link>
        {isAdminOrStaff && (
          <Link href="/admin/payments" className={itemClass(isAdminSection)}>
            <ShieldCheck className="h-5 w-5" aria-hidden />
            {t("nav.bottomAdmin")}
          </Link>
        )}
        <button type="button" onClick={handleLogout} className={itemClass(false)}>
          <LogOut className="h-5 w-5" aria-hidden />
          {t("nav.logout")}
        </button>
      </div>
    </nav>
  );
}
