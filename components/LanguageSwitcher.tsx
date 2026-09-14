"use client";

import { useI18n } from "@/lib/i18n/context";
import { locales, localeLabels } from "@/lib/i18n/config";
import { Languages } from "lucide-react";

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <Languages className="h-4 w-4 text-slate-400" aria-hidden />
      {locales.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          className={`rounded-full px-2 py-0.5 transition ${
            locale === l
              ? "bg-emerald-600 text-white"
              : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
          }`}
          aria-pressed={locale === l}
        >
          {localeLabels[l]}
        </button>
      ))}
    </div>
  );
}
