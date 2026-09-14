"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { createClient } from "@/lib/supabase/client";
import { buildTimeSlots } from "@/lib/reservation/slots";
import { courtDisplayName } from "@/lib/reservation/court-label";
import { canCancel } from "@/lib/reservation/rules";
import { formatLocalDate } from "@/lib/date";
import { X } from "lucide-react";
import type { Court, VenueSettings } from "@/types/database";

interface ReserveCalendarProps {
  userId: string;
  courts: Court[];
  settings: VenueSettings;
}

interface AvailabilityRow {
  court_id: string;
  start_time: string;
  end_time: string;
  status: "pending_payment" | "confirmed";
  is_own: boolean;
}

interface OwnReservation {
  id: string;
  court_id: string;
  start_time: string;
}

type PendingAction =
  | { type: "book"; courtId: string; courtName: string; start: string; end: string }
  | { type: "cancel"; reservationId: string; courtName: string; start: string; end: string };

export function ReserveCalendar({ userId, courts, settings }: ReserveCalendarProps) {
  const { t, locale } = useI18n();
  const [date, setDate] = useState(() => formatLocalDate(new Date()));
  const [availability, setAvailability] = useState<AvailabilityRow[]>([]);
  const [ownReservations, setOwnReservations] = useState<OwnReservation[]>([]);
  const [closedCourtIds, setClosedCourtIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const slots = useMemo(() => buildTimeSlots(settings), [settings]);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const [{ data: avail }, { data: own }, { data: closures }] = await Promise.all([
      supabase.rpc("get_availability", { p_date: date }),
      supabase
        .from("reservations")
        .select("id, court_id, start_time")
        .eq("user_id", userId)
        .eq("reservation_date", date)
        .in("status", ["confirmed", "pending_payment"]),
      supabase.from("court_closures").select("court_id").eq("closed_date", date),
    ]);

    setAvailability((avail as AvailabilityRow[]) ?? []);
    setOwnReservations((own as OwnReservation[]) ?? []);
    setClosedCourtIds(new Set((closures ?? []).map((c) => c.court_id)));
    setLoading(false);
  }, [date, userId]);

  useEffect(() => {
    // 日付が変わるたびに Supabase から最新の空き状況を同期する。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const shiftDate = (deltaDays: number) => {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + deltaDays);
    setDate(formatLocalDate(d));
    setMessage(null);
  };

  const findOccupancy = (courtId: string, start: string) =>
    availability.find((a) => a.court_id === courtId && a.start_time.slice(0, 5) === start);

  const findOwn = (courtId: string, start: string) =>
    ownReservations.find((r) => r.court_id === courtId && r.start_time.slice(0, 5) === start);

  const openBookConfirm = (court: Court, start: string, end: string) => {
    setMessage(null);
    setPending({ type: "book", courtId: court.id, courtName: courtDisplayName(court, t), start, end });
  };

  const openCancelConfirm = (court: Court, reservationId: string, start: string, end: string) => {
    setMessage(null);
    setPending({ type: "cancel", reservationId, courtName: courtDisplayName(court, t), start, end });
  };

  const confirmPending = async () => {
    if (!pending) return;
    setSubmitting(true);

    try {
      if (pending.type === "book") {
        const res = await fetch("/api/reservations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ court_id: pending.courtId, reservation_date: date, start_time: pending.start }),
        });
        if (res.status === 409) {
          setMessage({ type: "error", text: t("reserve.slotTaken") });
        } else if (!res.ok) {
          setMessage({ type: "error", text: t("common.error") });
        } else {
          setMessage({ type: "success", text: t("reserve.bookSuccess") });
        }
      } else {
        const res = await fetch(`/api/reservations/${pending.reservationId}`, { method: "PATCH" });
        if (res.status === 403) {
          setMessage({ type: "error", text: t("reserve.cancelDeadlinePassed") });
        } else if (!res.ok) {
          setMessage({ type: "error", text: t("common.error") });
        } else {
          setMessage({ type: "success", text: t("reserve.cancelSuccess") });
        }
      }
      await load();
    } finally {
      setSubmitting(false);
      setPending(null);
    }
  };

  const dateLabel = useMemo(() => {
    const d = new Date(date + "T00:00:00");
    return d.toLocaleDateString(locale === "ja" ? "ja-JP" : locale === "zh" ? "zh-CN" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
    });
  }, [date, locale]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t("reserve.title")}</h1>
        <div className="flex items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => shiftDate(-1)}
            className="rounded-md border border-slate-300 px-2 py-1 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            {t("reserve.prevDay")}
          </button>
          <span className="min-w-[10rem] text-center font-medium">{dateLabel}</span>
          <button
            type="button"
            onClick={() => shiftDate(1)}
            className="rounded-md border border-slate-300 px-2 py-1 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            {t("reserve.nextDay")}
          </button>
          <button
            type="button"
            onClick={() => setDate(formatLocalDate(new Date()))}
            className="rounded-md bg-slate-100 px-2 py-1 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
          >
            {t("reserve.today")}
          </button>
        </div>
      </div>

      {message && (
        <p
          className={`rounded-md px-3 py-2 text-sm ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
              : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
          }`}
        >
          {message.text}
        </p>
      )}

      {courts.length === 0 ? (
        <p className="text-slate-500">{t("reserve.noCourts")}</p>
      ) : loading ? (
        <p className="text-slate-500">{t("reserve.loading")}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900">
                <th className="border-b border-slate-200 px-3 py-2 text-left font-medium dark:border-slate-800">
                  {t("reserve.time")}
                </th>
                {courts.map((court) => (
                  <th
                    key={court.id}
                    className="border-b border-slate-200 px-3 py-2 text-left font-medium dark:border-slate-800"
                  >
                    {courtDisplayName(court, t)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slots.map((slot) => (
                <tr key={slot.start} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                  <td className="px-3 py-2 font-medium text-slate-500">
                    {slot.start}–{slot.end}
                  </td>
                  {courts.map((court) => {
                    const own = findOwn(court.id, slot.start);
                    const occupied = findOccupancy(court.id, slot.start);
                    const closed = closedCourtIds.has(court.id);

                    if (closed) {
                      return (
                        <td key={court.id} className="px-3 py-2">
                          <span className="block w-full rounded-md bg-slate-50 px-2 py-1.5 text-center text-slate-300 dark:bg-slate-900 dark:text-slate-600">
                            {t("reserve.closed")}
                          </span>
                        </td>
                      );
                    }

                    if (own) {
                      const cancellable = canCancel(date, settings);
                      if (!cancellable) {
                        return (
                          <td key={court.id} className="px-3 py-2">
                            <span className="block w-full rounded-md bg-emerald-50 px-2 py-1.5 text-center text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                              {t("reserve.yourBooking")}
                            </span>
                          </td>
                        );
                      }
                      return (
                        <td key={court.id} className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => openCancelConfirm(court, own.id, slot.start, slot.end)}
                            title={t("reserve.tapToCancel")}
                            className="flex w-full items-center justify-center gap-1 rounded-md bg-emerald-100 px-2 py-1.5 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900 dark:text-emerald-200"
                          >
                            {t("reserve.yourBooking")}
                            <X className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </td>
                      );
                    }

                    if (occupied) {
                      return (
                        <td key={court.id} className="px-3 py-2">
                          <span className="block w-full rounded-md bg-slate-100 px-2 py-1.5 text-center text-slate-400 dark:bg-slate-800">
                            {t("reserve.booked")}
                          </span>
                        </td>
                      );
                    }

                    return (
                      <td key={court.id} className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => openBookConfirm(court, slot.start, slot.end)}
                          className="w-full rounded-md border border-emerald-300 px-2 py-1.5 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-950"
                        >
                          {t("reserve.available")}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pending && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl dark:bg-slate-900">
            <h2 className="mb-2 text-lg font-bold">
              {pending.type === "book" ? t("reserve.confirmBookTitle") : t("reserve.confirmCancelTitle")}
            </h2>
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
              {t(pending.type === "book" ? "reserve.confirmBookBody" : "reserve.confirmCancelBody", {
                court: pending.courtName,
                date: dateLabel,
                start: pending.start,
                end: pending.end,
              })}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPending(null)}
                disabled={submitting}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={confirmPending}
                disabled={submitting}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {t("common.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
