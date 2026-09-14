/**
 * ローカルタイムゾーンでの日付を "YYYY-MM-DD" 形式で返す。
 * `Date.prototype.toISOString()` はUTCに変換するため、UTC+の地域(日本・台湾など)では
 * 日付が1日ずれることがあるので使用しない。
 */
export function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
