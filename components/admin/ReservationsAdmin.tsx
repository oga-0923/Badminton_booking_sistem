"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { courtDisplayName } from "@/lib/reservation/court-label";
import type { Court, ReservationStatus } from "@/types/database";

interface ReservationRow {
  id: string;
  reservation_date: string;
  start_time: string;
  end_time: string;
  status: ReservationStatus;
  amount: number;
  court_id: string;
  user_id: string;
  courts: { name: string } | { name: string }[] | null;
  profiles: { full_name: string; student_id: string | null } | { full_name: string; student_id: string | null }[] | null;
}

function firstOf<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

interface ReservationsAdminProps {
  courts: Court[];
  reservations: ReservationRow[];
}

const STATUSES: ReservationStatus[] = ["pending_payment", "confirmed", "cancelled", "expired"];

export function ReservationsAdmin({ courts, reservations }: ReservationsAdminProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [courtId, setCourtId] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [pendingCancel, setPendingCancel] = useState<ReservationRow | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    return reservations.filter((r) => {
      if (courtId && r.court_id !== courtId) return false;
      if (status && r.status !== status) return false;
      if (from && r.reservation_date < from) return false;
      if (to && r.reservation_date > to) return false;
      return true;
    });
  }, [reservations, courtId, status, from, to]);

  const exportUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (courtId) params.set("court_id", courtId);
    if (status) params.set("status", status);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return `/api/admin/reservations/export?${params.toString()}`;
  }, [courtId, status, from, to]);

  const courtName = (id: string) => {
    const court = courts.find((c) => c.id === id);
    return court ? courtDisplayName(court, t) : id;
  };

  const confirmCancel = async () => {
    if (!pendingCancel) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/reservations/${pendingCancel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancel: true }),
      });
      router.refresh();
    } finally {
      setBusy(false);
      setPendingCancel(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-2">
        <select
          value={courtId}
          onChange={(e) => setCourtId(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <option value="">{t("admin.all")}</option>
          {courts.map((c) => (
            <option key={c.id} value={c.id}>
              {courtDisplayName(c, t)}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <option value="">{t("admin.all")}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        />
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        />
        <a
          href={exportUrl}
          className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          {t("admin.exportCsv")}
        </a>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full min-w-[680px] border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-900">
              <th className="border-b border-slate-200 px-3 py-2 text-left dark:border-slate-800">日付</th>
              <th className="border-b border-slate-200 px-3 py-2 text-left dark:border-slate-800">時間</th>
              <th className="border-b border-slate-200 px-3 py-2 text-left dark:border-slate-800">コート</th>
              <th className="border-b border-slate-200 px-3 py-2 text-left dark:border-slate-800">氏名/学籍番号</th>
              <th className="border-b border-slate-200 px-3 py-2 text-left dark:border-slate-800">状態</th>
              <th className="border-b border-slate-200 px-3 py-2 text-left dark:border-slate-800">金額</th>
              <th className="border-b border-slate-200 px-3 py-2 text-left dark:border-slate-800"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const profile = firstOf(r.profiles);
              return (
                <tr key={r.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                  <td className="px-3 py-2">{r.reservation_date}</td>
                  <td className="px-3 py-2">
                    {r.start_time.slice(0, 5)}–{r.end_time.slice(0, 5)}
                  </td>
                  <td className="px-3 py-2">{courtName(r.court_id)}</td>
                  <td className="px-3 py-2">
                    {profile?.full_name ?? "-"} {profile?.student_id ? `(${profile.student_id})` : ""}
                  </td>
                  <td className="px-3 py-2">{r.status}</td>
                  <td className="px-3 py-2">{r.amount}</td>
                  <td className="px-3 py-2">
                    {r.status === "confirmed" && (
                      <button
                        type="button"
                        onClick={() => setPendingCancel(r)}
                        className="text-red-600 hover:underline"
                      >
                        {t("admin.cancelReservation")}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pendingCancel && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl dark:bg-slate-900">
            <h2 className="mb-2 text-lg font-bold">{t("admin.cancelReservation")}</h2>
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
              {courtName(pendingCancel.court_id)} {pendingCancel.reservation_date}{" "}
              {pendingCancel.start_time.slice(0, 5)}-{pendingCancel.end_time.slice(0, 5)}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingCancel(null)}
                disabled={busy}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                {t("common.close")}
              </button>
              <button
                type="button"
                onClick={confirmCancel}
                disabled={busy}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {t("admin.cancelReservation")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
