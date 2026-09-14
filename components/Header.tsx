"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { useUser } from "@/lib/supabase/useUser";
import { useProfileRole } from "@/lib/supabase/useProfileRole";
import { createClient } from "@/lib/supabase/client";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function Header() {
  const { t } = useI18n();
  const { user } = useUser();
  const role = useProfileRole(user?.id);
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex flex-col leading-tight">
          <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{t("app.name")}</span>
          <span className="text-xs text-slate-500">{t("app.tagline")}</span>
        </Link>

        <nav className="flex items-center gap-3 text-sm">
          {user ? (
            <>
              <Link href="/reserve" className="text-slate-600 hover:text-emerald-700 dark:text-slate-300">
                {t("nav.reserve")}
              </Link>
              <Link href="/rental" className="text-slate-600 hover:text-emerald-700 dark:text-slate-300">
                {t("nav.rental")}
              </Link>
              <Link href="/profile" className="text-slate-600 hover:text-emerald-700 dark:text-slate-300">
                {t("nav.profile")}
              </Link>
              {(role === "staff" || role === "admin") && (
                <Link href="/admin" className="text-slate-600 hover:text-emerald-700 dark:text-slate-300">
                  {t("nav.admin")}
                </Link>
              )}
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-md border border-slate-300 px-2.5 py-1 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {t("nav.logout")}
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-slate-600 hover:text-emerald-700 dark:text-slate-300">
                {t("nav.login")}
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-emerald-600 px-3 py-1.5 font-medium text-white hover:bg-emerald-700"
              >
                {t("nav.signup")}
              </Link>
            </>
          )}
          <LanguageSwitcher />
        </nav>
      </div>
    </header>
  );
}
