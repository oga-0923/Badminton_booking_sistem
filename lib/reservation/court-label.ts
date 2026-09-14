import type { Court } from "@/types/database";

/**
 * コート名は "コート1"のように日本語で登録されているため、
 * 番号部分だけを取り出して各言語の表記("Court 1" / "场地1")で表示する。
 * 番号が見つからない場合は登録名をそのまま表示する。
 */
export function courtDisplayName(court: Court, t: (key: string, vars?: Record<string, string | number>) => string): string {
  const match = court.name.match(/(\d+)\s*$/);
  if (!match) return court.name;
  return t("reserve.courtLabel", { n: match[1] });
}
