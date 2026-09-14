import type { VenueSettings } from "@/types/database";
import { formatLocalDate } from "@/lib/date";

/**
 * キャンセル可能な期限 (例: 前日23:59) の日時を計算する。
 */
export function getCancellationDeadline(
  reservationDate: string,
  settings: Pick<VenueSettings, "cancellation_deadline_days_before" | "cancellation_deadline_time">
): Date {
  const [h, m] = settings.cancellation_deadline_time.slice(0, 5).split(":").map(Number);
  const deadline = new Date(`${reservationDate}T00:00:00`);
  deadline.setDate(deadline.getDate() - settings.cancellation_deadline_days_before);
  deadline.setHours(h, m, 59, 999);
  return deadline;
}

export function canCancel(
  reservationDate: string,
  settings: Pick<VenueSettings, "cancellation_deadline_days_before" | "cancellation_deadline_time">,
  now: Date = new Date()
): boolean {
  return now.getTime() <= getCancellationDeadline(reservationDate, settings).getTime();
}

export function isWithinBookingWindow(
  reservationDate: string,
  settings: Pick<VenueSettings, "booking_window_days">,
  now: Date = new Date()
): boolean {
  const today = new Date(formatLocalDate(now) + "T00:00:00");
  const target = new Date(reservationDate + "T00:00:00");
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  return diffDays >= 0 && diffDays <= settings.booking_window_days;
}
