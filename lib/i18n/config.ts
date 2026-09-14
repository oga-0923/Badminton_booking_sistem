export const locales = ["ja", "en", "zh"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ja";

export const localeLabels: Record<Locale, string> = {
  ja: "日本語",
  en: "English",
  zh: "中文",
};
