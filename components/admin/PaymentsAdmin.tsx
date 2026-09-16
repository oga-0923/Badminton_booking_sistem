"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { courtDisplayName } from "@/lib/reservation/court-label";
import type { Court, EquipmentType, ReservationStatus } from "@/types/database";

interface ReservationRow {
  id: string;
  reservation_date: string;
  start_time: string;
  end_time: string;
  amount: number;
  paid: boolean;
  status: ReservationStatus;
  court_id: string;
  user_id: string;
  courts: { name: string } | { name: string }[] | null;
  profiles: { full_name: string; student_id: string | null } | { full_name: string; student_id: string | null }[] | null;
}

interface LoanRow {
  id: string;
  quantity: number;
  fee_amount: number;
  fee_collected: boolean;
  equipment_id: string;
  user_id: string;
  equipment: { name: string; type: EquipmentType } | { name: string; type: EquipmentType }[] | null;
  profiles: { full_name: string; student_id: string | null } | { full_name: string; student_id: string | null }[] | null;
}

function firstOf<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

const typeKey: Record<EquipmentType, "rental.racket" | "rental.shuttle"> = {
  racket: "rental.racket",
  shuttle: "rental.shuttle",
};

type PendingItem =
  | { kind: "reservation"; id: string; label: string; amount: number }
  | { kind: "loan"; id: string; label: string; amount: number };

export function PaymentsAdmin({ reservations, loans }: { reservations: ReservationRow[]; loans: LoanRow[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, setPending] = useState<PendingItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [onlyUnpaid, setOnlyUnpaid] = useState(true);

  const groups = useMemo(() => {
    const byUser = new Map<
      string,
      { name: string; studentId: string | null; reservations: ReservationRow[]; loans: LoanRow[] }
    >();

    for (const r of reservations) {
      const profile = firstOf(r.profiles);
      const key = r.user_id;
      if (!byUser.has(key)) {
        byUser.set(key, { name: profile?.full_name ?? "-", studentId: profile?.student_id ?? null, reservations: [], loans: [] });
      }
      byUser.get(key)!.reservations.push(r);
    }
    for (const l of loans) {
      const profile = firstOf(l.profiles);
      const key = l.user_id;
      if (!byUser.has(key)) {
        byUser.set(key, { name: profile?.full_name ?? "-", studentId: profile?.student_id ?? null, reservations: [], loans: [] });
      }
      byUser.get(key)!.loans.push(l);
    }

    let entries = Array.from(byUser.values());
    if (onlyUnpaid) {
      entries = entries
        .map((e) => ({
          ...e,
          reservations: e.reservations.filter((r) => r.amount > 0 && !r.paid),
          loans: e.loans.filter((l) => l.fee_amount > 0 && !l.fee_collected),
        }))
        .filter((e) => e.reservations.length > 0 || e.loans.length > 0);
    }
    return entries;
  }, [reservations, loans, onlyUnpaid]);

  const confirmPending = async (action: "cancel" | "pay") => {
    if (!pending) return;
    setBusy(true);
    try {
      if (action === "pay") {
        if (pending.kind === "reservation") {
          await fetch(`/api/admin/reservations/${pending.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paid: true }),
          });
        } else {
          await fetch(`/api/admin/loans/${pending.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fee_collected: true }),
          });
        }
      } else if (pending.kind === "reservation") {
        await fetch(`/api/admin/reservations/${pending.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cancel: true }),
        });
      }
      router.refresh();
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={onlyUnpaid} onChange={(e) => setOnlyUnpaid(e.target.checked)} className="h-4 w-4" />
        {t("admin.onlyUnpaid")}
      </label>

      {groups.length === 0 ? (
        <p className="text-sm text-slate-500">{t("admin.noPaymentItems")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((g, idx) => (
            <div key={idx} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
              <p className="mb-2 text-base font-semibold">
                {g.name}
                {g.studentId && <span className="ml-1 text-sm font-normal text-slate-500">({g.studentId})</span>}
              </p>
              <ul className="flex flex-col gap-2">
                {g.reservations.map((r) => {
                  const court = firstOf(r.courts);
                  const courtLabel = court ? courtDisplayName(court as Court, t) : r.court_id;
                  const unpaid = r.amount > 0 && !r.paid;
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        disabled={!unpaid}
                        onClick={() =>
                          setPending({
                            kind: "reservation",
                            id: r.id,
                            label: `${courtLabel} ${r.reservation_date} ${r.start_time.slice(0, 5)}-${r.end_time.slice(0, 5)}`,
                            amount: r.amount,
                          })
                        }
                        className={`flex w-full flex-col gap-1 rounded-md px-3 py-2.5 text-left ${
                          unpaid
                            ? "bg-red-100 text-red-900 hover:bg-red-200 dark:bg-red-950 dark:text-red-200"
                            : "bg-slate-50 text-slate-500 dark:bg-slate-900"
                        }`}
                      >
                        <span className="text-sm font-medium">{courtLabel}</span>
                        <span className="text-xs opacity-80">
                          {r.reservation_date} {r.start_time.slice(0, 5)}-{r.end_time.slice(0, 5)}
                        </span>
                        <span className="text-sm font-semibold">
                          {r.amount} {r.paid ? `· ${t("admin.paid")}` : unpaid ? `· ${t("admin.unpaid")}` : ""}
                        </span>
                      </button>
                    </li>
                  );
                })}
                {g.loans.map((l) => {
                  const eq = firstOf(l.equipment);
                  const unpaid = l.fee_amount > 0 && !l.fee_collected;
                  return (
                    <li key={l.id}>
                      <button
                        type="button"
                        disabled={!unpaid}
                        onClick={() =>
                          setPending({
                            kind: "loan",
                            id: l.id,
                            label: `${eq ? t(typeKey[eq.type]) : l.equipment_id} × ${l.quantity}`,
                            amount: l.fee_amount,
                          })
                        }
                        className={`flex w-full flex-col gap-1 rounded-md px-3 py-2.5 text-left ${
                          unpaid
                            ? "bg-red-100 text-red-900 hover:bg-red-200 dark:bg-red-950 dark:text-red-200"
                            : "bg-slate-50 text-slate-500 dark:bg-slate-900"
                        }`}
                      >
                        <span className="text-sm font-medium">
                          {eq ? t(typeKey[eq.type]) : l.equipment_id} × {l.quantity}
                        </span>
                        <span className="text-sm font-semibold">
                          {l.fee_amount} {l.fee_collected ? `· ${t("admin.paid")}` : unpaid ? `· ${t("admin.unpaid")}` : ""}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      {pending && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl dark:bg-slate-900">
            <h2 className="mb-2 text-lg font-bold">{pending.label}</h2>
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">{t("admin.paymentAmount", { amount: pending.amount })}</p>
            <div className="flex justify-end gap-2">
              {pending.kind === "reservation" && (
                <button
                  type="button"
                  onClick={() => confirmPending("cancel")}
                  disabled={busy}
                  className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
                >
                  {t("common.cancel")}
                </button>
              )}
              <button
                type="button"
                onClick={() => confirmPending("pay")}
                disabled={busy}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {t("admin.markPaid")}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setPending(null)}
              disabled={busy}
              className="mt-3 w-full text-center text-xs text-slate-400 hover:underline"
            >
              {t("common.close")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
