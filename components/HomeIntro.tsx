"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";

export function HomeIntro() {
  const { t } = useI18n();

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-4 py-24 text-center">
      <h1 className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">{t("app.name")}</h1>
      <p className="text-lg text-slate-600 dark:text-slate-300">{t("app.tagline")}</p>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="rounded-md border border-slate-300 px-5 py-2 font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          {t("nav.login")}
        </Link>
        <Link
          href="/signup"
          className="rounded-md bg-emerald-600 px-5 py-2 font-medium text-white hover:bg-emerald-700"
        >
          {t("nav.signup")}
        </Link>
      </div>
    </div>
  );
}
