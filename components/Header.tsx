"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";
import { useUser } from "@/lib/supabase/useUser";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function Header() {
  const { t } = useI18n();
  const { user } = useUser();

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex flex-col leading-tight">
          <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{t("app.name")}</span>
          <span className="text-xs text-slate-500">{t("app.tagline")}</span>
        </Link>

        <nav className="flex items-center gap-3 text-sm">
          {!user && (
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
