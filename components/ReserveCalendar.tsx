"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { useI18n } from "@/lib/i18n/context";
import { createClient } from "@/lib/supabase/client";
import { buildTimeSlots } from "@/lib/reservation/slots";
import { courtDisplayName } from "@/lib/reservation/court-label";
import { isSlotBookable } from "@/lib/reservation/rules";
import { formatLocalDate } from "@/lib/date";
import { X, QrCode } from "lucide-react";
import type { Court, Equipment, VenueSettings } from "@/types/database";

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
  | { type: "manage"; reservationId: string; courtName: string; start: string; end: string }
  | { type: "qr"; reservationId: string; courtName: string; start: string; end: string };

interface QrRentalItem {
  type: Equipment["type"];
  quantity: number;
}

type ViewMode = "day" | "week" | "month";

interface DaySummary {
  booked: number;
  own: boolean;
}

function getWeekDates(dateStr: string): string[] {
  const d = new Date(dateStr + "T00:00:00");
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - d.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(sunday);
    x.setDate(sunday.getDate() + i);
    return formatLocalDate(x);
  });
}

function getMonthGrid(dateStr: string): (string | null)[] {
  const d = new Date(dateStr + "T00:00:00");
  const year = d.getFullYear();
  const month = d.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstOfMonth.getDay(); i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(formatLocalDate(new Date(year, month, day)));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function ReserveCalendar({ userId, courts, settings }: ReserveCalendarProps) {
  const { t, locale } = useI18n();
  const [date, setDate] = useState(() => formatLocalDate(new Date()));
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [daySummaries, setDaySummaries] = useState<Record<string, DaySummary>>({});
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [availability, setAvailability] = useState<AvailabilityRow[]>([]);
  const [ownReservations, setOwnReservations] = useState<OwnReservation[]>([]);
  const [closedCourtIds, setClosedCourtIds] = useState<Set<string>>(new Set());
  const [equipmentAvailability, setEquipmentAvailability] = useState<(Equipment & { available: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [racketQty, setRacketQty] = useState(0);
  const [shuttleQty, setShuttleQty] = useState(0);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [reservationRentals, setReservationRentals] = useState<QrRentalItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const slots = useMemo(() => buildTimeSlots(settings), [settings]);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const [{ data: avail }, { data: own }, { data: closures }, { data: equipment }, { data: equipmentAvail }] =
      await Promise.all([
        supabase.rpc("get_availability", { p_date: date }),
        supabase
          .from("reservations")
          .select("id, court_id, start_time")
          .eq("user_id", userId)
          .eq("reservation_date", date)
          .in("status", ["confirmed", "pending_payment"]),
        supabase.from("court_closures").select("court_id").eq("closed_date", date),
        supabase.from("equipment").select("*").order("type"),
        supabase.rpc("get_equipment_availability", { p_date: date }),
      ]);

    setAvailability((avail as AvailabilityRow[]) ?? []);
    setOwnReservations((own as OwnReservation[]) ?? []);
    setClosedCourtIds(new Set((closures ?? []).map((c) => c.court_id)));

    const availableByEquipment = new Map<string, number>();
    for (const row of equipmentAvail ?? []) {
      availableByEquipment.set(row.equipment_id, row.available);
    }
    setEquipmentAvailability(
      (equipment ?? []).map((e) => ({ ...e, available: availableByEquipment.get(e.id) ?? e.total_quantity }))
    );

    setLoading(false);
  }, [date, userId]);

  useEffect(() => {
    // 日付が変わるたびに Supabase から最新の空き状況を同期する。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const totalSlotsPerDay = slots.length * courts.length;

  useEffect(() => {
    if (viewMode === "day") return;

    const dates = viewMode === "week" ? getWeekDates(date) : getMonthGrid(date).filter((d): d is string => d !== null);

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSummaryLoading(true);
    const supabase = createClient();

    Promise.all(
      dates.map(async (d) => {
        const { data } = await supabase.rpc("get_availability", { p_date: d });
        const rows = (data as AvailabilityRow[]) ?? [];
        return [d, { booked: rows.length, own: rows.some((r) => r.is_own) }] as const;
      })
    ).then((results) => {
      setDaySummaries(Object.fromEntries(results));
      setSummaryLoading(false);
    });
  }, [viewMode, date]);

  useEffect(() => {
    if (pending?.type === "qr") {
      QRCode.toDataURL(pending.reservationId, { width: 240, margin: 1 }).then((url) => {
        setQrDataUrl(url);
      });
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQrDataUrl(null);
    }

    if (pending?.type !== "manage" && pending?.type !== "qr") {
      setReservationRentals([]);
      return;
    }

    const supabase = createClient();
    supabase
      .from("equipment_loans")
      .select("quantity, equipment(type)")
      .eq("reservation_id", pending.reservationId)
      .eq("status", "borrowed")
      .then(({ data }) => {
        setReservationRentals(
          (data ?? []).map((r) => {
            const eq = Array.isArray(r.equipment) ? r.equipment[0] : r.equipment;
            return { type: eq?.type ?? "racket", quantity: r.quantity };
          })
        );
      });
  }, [pending]);

  const shiftDate = (delta: number) => {
    const d = new Date(date + "T00:00:00");
    if (viewMode === "day") d.setDate(d.getDate() + delta);
    else if (viewMode === "week") d.setDate(d.getDate() + delta * 7);
    else d.setMonth(d.getMonth() + delta);
    setDate(formatLocalDate(d));
    setMessage(null);
  };

  const jumpToDay = (d: string) => {
    setDate(d);
    setViewMode("day");
    setMessage(null);
  };

  const findOccupancy = (courtId: string, start: string) =>
    availability.find((a) => a.court_id === courtId && a.start_time.slice(0, 5) === start);

  const findOwn = (courtId: string, start: string) =>
    ownReservations.find((r) => r.court_id === courtId && r.start_time.slice(0, 5) === start);

  const racket = equipmentAvailability.find((e) => e.type === "racket");
  const shuttle = equipmentAvailability.find((e) => e.type === "shuttle");

  const openBookConfirm = (court: Court, start: string, end: string) => {
    setMessage(null);
    setRacketQty(0);
    setShuttleQty(0);
    setPending({ type: "book", courtId: court.id, courtName: courtDisplayName(court, t), start, end });
  };

  const openManage = (court: Court, reservationId: string, start: string, end: string) => {
    setMessage(null);
    setPending({ type: "manage", reservationId, courtName: courtDisplayName(court, t), start, end });
  };

  const submitBooking = async () => {
    if (pending?.type !== "book") return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          court_id: pending.courtId,
          reservation_date: date,
          start_time: pending.start,
          racket_quantity: racketQty,
          shuttle_quantity: shuttleQty,
        }),
      });
      if (res.status === 409) {
        setMessage({ type: "error", text: t("reserve.slotTaken") });
      } else if (!res.ok) {
        setMessage({ type: "error", text: t("common.error") });
      } else {
        setMessage({ type: "success", text: t("reserve.bookSuccess") });
      }
      await load();
    } finally {
      setSubmitting(false);
      setPending(null);
    }
  };

  const discardReservation = async () => {
    if (pending?.type !== "manage") return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/reservations/${pending.reservationId}`, { method: "PATCH" });
      if (res.status === 403) {
        setMessage({ type: "error", text: t("reserve.cancelDeadlinePassed") });
      } else if (!res.ok) {
        setMessage({ type: "error", text: t("common.error") });
      } else {
        setMessage({ type: "success", text: t("reserve.cancelSuccess") });
      }
      await load();
    } finally {
      setSubmitting(false);
      setPending(null);
    }
  };

  const localeTag = locale === "ja" ? "ja-JP" : locale === "zh" ? "zh-CN" : "en-US";

  const dateLabel = useMemo(() => {
    const d = new Date(date + "T00:00:00");
    return d.toLocaleDateString(localeTag, { year: "numeric", month: "long", day: "numeric", weekday: "short" });
  }, [date, localeTag]);

  const headerLabel = useMemo(() => {
    if (viewMode === "day") return dateLabel;
    if (viewMode === "month") {
      const d = new Date(date + "T00:00:00");
      return d.toLocaleDateString(localeTag, { year: "numeric", month: "long" });
    }
    const weekDates = getWeekDates(date);
    const start = new Date(weekDates[0] + "T00:00:00");
    const end = new Date(weekDates[6] + "T00:00:00");
    const fmt = (x: Date) => x.toLocaleDateString(localeTag, { month: "short", day: "numeric" });
    return `${fmt(start)} – ${fmt(end)}`;
  }, [date, viewMode, dateLabel, localeTag]);

  const weekdayLabels = useMemo(() => {
    const base = getWeekDates(date);
    return base.map((d) => new Date(d + "T00:00:00").toLocaleDateString(localeTag, { weekday: "short" }));
  }, [date, localeTag]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">{t("reserve.title")}</h1>
          <div className="flex rounded-md border border-slate-200 text-xs dark:border-slate-700">
            {(["day", "week", "month"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`px-2.5 py-1.5 first:rounded-l-md last:rounded-r-md ${
                  viewMode === mode
                    ? "bg-emerald-600 text-white"
                    : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                {t(`reserve.view${mode.charAt(0).toUpperCase()}${mode.slice(1)}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => shiftDate(-1)}
            className="rounded-md border border-slate-300 px-2 py-1 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            {t("reserve.prevDay")}
          </button>
          <span className="min-w-[9rem] text-center font-medium">{headerLabel}</span>
          <button
            type="button"
            onClick={() => shiftDate(1)}
            className="rounded-md border border-slate-300 px-2 py-1 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            {t("reserve.nextDay")}
          </button>
          <button
            type="button"
            onClick={() => jumpToDay(formatLocalDate(new Date()))}
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
      ) : viewMode !== "day" ? (
        summaryLoading ? (
          <p className="text-slate-500">{t("reserve.loading")}</p>
        ) : viewMode === "week" ? (
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {getWeekDates(date).map((d, i) => {
              const summary = daySummaries[d];
              const isToday = d === formatLocalDate(new Date());
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => jumpToDay(d)}
                  className={`flex flex-col items-center gap-1 rounded-lg border px-1 py-3 text-center ${
                    isToday
                      ? "border-emerald-400 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-950"
                      : "border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                  }`}
                >
                  <span className="text-xs text-slate-500">{weekdayLabels[i]}</span>
                  <span className="text-sm font-semibold">{Number(d.slice(8, 10))}</span>
                  {summary?.own && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />}
                  <span className="text-[11px] text-slate-400">
                    {totalSlotsPerDay - (summary?.booked ?? 0)}/{totalSlotsPerDay}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <div className="grid grid-cols-7 gap-1.5 text-center text-xs text-slate-500 sm:gap-2">
              {weekdayLabels.map((w) => (
                <span key={w}>{w}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {getMonthGrid(date).map((d, i) => {
                if (!d) return <div key={i} />;
                const summary = daySummaries[d];
                const isToday = d === formatLocalDate(new Date());
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => jumpToDay(d)}
                    className={`flex flex-col items-center gap-0.5 rounded-md border px-0.5 py-2 text-center ${
                      isToday
                        ? "border-emerald-400 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-950"
                        : "border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                    }`}
                  >
                    <span className="text-sm font-semibold">{Number(d.slice(8, 10))}</span>
                    {summary?.own && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />}
                    <span className="text-[10px] text-slate-400">
                      {totalSlotsPerDay - (summary?.booked ?? 0)}/{totalSlotsPerDay}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )
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
              {slots.map((slot) => {
                const bookable = isSlotBookable(date, slot.start);
                return (
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
                        return (
                          <td key={court.id} className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => openManage(court, own.id, slot.start, slot.end)}
                              className="flex w-full items-center justify-center gap-1 rounded-md bg-emerald-100 px-2 py-1.5 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900 dark:text-emerald-200"
                            >
                              {t("reserve.yourBooking")}
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

                      if (!bookable) {
                        return (
                          <td key={court.id} className="px-3 py-2">
                            <span className="block w-full rounded-md bg-slate-50 px-2 py-1.5 text-center text-slate-300 dark:bg-slate-900 dark:text-slate-600">
                              —
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pending?.type === "book" && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl dark:bg-slate-900">
            <h2 className="mb-2 text-lg font-bold">{t("reserve.confirmBookTitle")}</h2>
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
              {t("reserve.confirmBookBody", {
                court: pending.courtName,
                date: dateLabel,
                start: pending.start,
                end: pending.end,
              })}
            </p>

            <div className="mb-4 flex flex-col gap-2 rounded-md border border-slate-200 p-3 dark:border-slate-700">
              <p className="text-xs font-medium text-slate-500">{t("reserve.rentalWithBooking")}</p>
              {racket && (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>
                      {t("rental.racket")} ({t("rental.available", { n: racket.available })})
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={racketQty}
                      onChange={(e) => setRacketQty(Math.max(0, Number(e.target.value) || 0))}
                      className="w-16 rounded-md border border-slate-300 px-2 py-1 text-center dark:border-slate-700 dark:bg-slate-900"
                    />
                  </div>
                  {racketQty > racket.available && (
                    <p className="text-xs text-red-600">{t("rental.insufficientStock")}</p>
                  )}
                </div>
              )}
              {shuttle && (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>
                      {t("rental.shuttle")} ({t("rental.available", { n: shuttle.available })})
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={shuttleQty}
                      onChange={(e) => setShuttleQty(Math.max(0, Number(e.target.value) || 0))}
                      className="w-16 rounded-md border border-slate-300 px-2 py-1 text-center dark:border-slate-700 dark:bg-slate-900"
                    />
                  </div>
                  {shuttleQty > shuttle.available && (
                    <p className="text-xs text-red-600">{t("rental.insufficientStock")}</p>
                  )}
                </div>
              )}
              {!racket && !shuttle && <p className="text-xs text-slate-400">{t("reserve.noEquipment")}</p>}
            </div>

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
                onClick={submitBooking}
                disabled={
                  submitting ||
                  (racket ? racketQty > racket.available : false) ||
                  (shuttle ? shuttleQty > shuttle.available : false)
                }
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {t("common.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {pending?.type === "manage" && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl dark:bg-slate-900">
            <h2 className="mb-2 text-lg font-bold">{pending.courtName}</h2>
            <p className="mb-2 text-sm text-slate-600 dark:text-slate-300">
              {dateLabel} {pending.start}–{pending.end}
            </p>
            {reservationRentals.length > 0 && (
              <ul className="mb-4 text-sm text-slate-600 dark:text-slate-300">
                {reservationRentals.map((r, i) => (
                  <li key={i}>
                    {t(r.type === "racket" ? "rental.racket" : "rental.shuttle")} × {r.quantity}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setPending(null)}
                disabled={submitting}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                {t("common.close")}
              </button>
              <button
                type="button"
                onClick={discardReservation}
                disabled={submitting}
                className="flex items-center justify-center gap-1 rounded-md border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                {t("reserve.discardBooking")}
              </button>
              <button
                type="button"
                onClick={() =>
                  setPending({
                    type: "qr",
                    reservationId: pending.reservationId,
                    courtName: pending.courtName,
                    start: pending.start,
                    end: pending.end,
                  })
                }
                className="flex items-center justify-center gap-2 rounded-md bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600"
              >
                <QrCode className="h-4 w-4" aria-hidden />
                {t("reserve.showQr")}
              </button>
            </div>
          </div>
        </div>
      )}

      {pending?.type === "qr" && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4">
          <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-lg bg-white p-5 shadow-xl dark:bg-slate-900">
            <h2 className="text-lg font-bold">{t("reserve.showQr")}</h2>
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt="QR" className="h-60 w-60" />
            ) : (
              <div className="flex h-60 w-60 items-center justify-center text-sm text-slate-400">
                {t("common.loading")}
              </div>
            )}

            <div className="w-full rounded-md border border-slate-200 p-3 text-sm dark:border-slate-700">
              <p className="mb-1 text-xs font-medium text-slate-500">{t("reserve.reservationInfo")}</p>
              <p>{pending.courtName}</p>
              <p>
                {dateLabel} {pending.start}–{pending.end}
              </p>
              {reservationRentals.length > 0 && (
                <ul className="mt-1 text-slate-600 dark:text-slate-300">
                  {reservationRentals.map((r, i) => (
                    <li key={i}>
                      {t(r.type === "racket" ? "rental.racket" : "rental.shuttle")} × {r.quantity}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <p className="text-center text-xs text-slate-500">{t("reserve.qrHint")}</p>
            <button
              type="button"
              onClick={() => setPending(null)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              {t("common.close")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
