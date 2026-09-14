"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { defaultLocale, locales, type Locale } from "./config";
import ja from "./dictionaries/ja";
import en from "./dictionaries/en";
import zh from "./dictionaries/zh";
import type { Dictionary } from "./dictionaries/types";

const dictionaries: Record<Locale, Dictionary> = { ja, en, zh };

const STORAGE_KEY = "tsumeato-locale";

function getByPath(obj: unknown, path: string): string | undefined {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj) as string | undefined;
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function detectInitialLocale(): Locale {
  if (typeof window === "undefined") return defaultLocale;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored && (locales as readonly string[]).includes(stored)) return stored as Locale;
  const nav = window.navigator.language.slice(0, 2);
  if ((locales as readonly string[]).includes(nav)) return nav as Locale;
  return defaultLocale;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);

  useEffect(() => {
    // サーバー側と初回クライアントレンダリングを一致させるため、
    // localStorage/navigator に依存する初期値はマウント後に設定する。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocaleState(detectInitialLocale());
  }, []);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
      document.cookie = `${STORAGE_KEY}=${next}; path=/; max-age=31536000`;
    } catch {
      // localStorage 無効時は無視
    }
  };

  const t = useMemo(() => {
    const dict = dictionaries[locale];
    return (key: string, vars?: Record<string, string | number>) => {
      let value = getByPath(dict, key) ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          value = value.replace(`{${k}}`, String(v));
        }
      }
      return value;
    };
  }, [locale]);

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
