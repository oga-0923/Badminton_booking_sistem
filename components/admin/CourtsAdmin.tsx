"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { courtDisplayName } from "@/lib/reservation/court-label";
import type { Court, CourtClosure } from "@/types/database";

interface CourtsAdminProps {
  courts: Court[];
  closures: CourtClosure[];
}

export function CourtsAdmin({ courts, closures }: CourtsAdminProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [newCourtName, setNewCourtName] = useState("");
  const [selectedCourtId, setSelectedCourtId] = useState(courts[0]?.id ?? "");
  const [closedDate, setClosedDate] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const addCourt = async () => {
    if (!newCourtName.trim()) return;
    setBusy(true);
    await fetch("/api/admin/courts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCourtName.trim() }),
    });
    setNewCourtName("");
    setBusy(false);
    router.refresh();
  };

  const toggleActive = async (court: Court) => {
    setBusy(true);
    await fetch(`/api/admin/courts/${court.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !court.is_active }),
    });
    setBusy(false);
    router.refresh();
  };

  const addClosure = async () => {
    if (!selectedCourtId || !closedDate) return;
    setBusy(true);
    await fetch("/api/admin/closures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ court_id: selectedCourtId, closed_date: closedDate, reason }),
    });
    setClosedDate("");
    setReason("");
    setBusy(false);
    router.refresh();
  };

  const deleteClosure = async (id: string) => {
    setBusy(true);
    await fetch(`/api/admin/closures/${id}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  };

  const courtName = (id: string) => {
    const court = courts.find((c) => c.id === id);
    return court ? courtDisplayName(court, t) : id;
  };

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="mb-3 text-lg font-bold">{t("admin.courts")}</h2>
        <ul className="mb-4 flex flex-col gap-2">
          {courts.map((court) => (
            <li
              key={court.id}
              className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 dark:border-slate-800"
            >
              <span>{courtDisplayName(court, t)}</span>
              <button
                type="button"
                onClick={() => toggleActive(court)}
                disabled={busy}
                className={`rounded-md px-3 py-1 text-sm ${
                  court.is_active
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
                    : "bg-slate-100 text-slate-500 dark:bg-slate-800"
                }`}
              >
                {court.is_active ? t("admin.active") : t("admin.inactive")}
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input
            type="text"
            value={newCourtName}
            onChange={(e) => setNewCourtName(e.target.value)}
            placeholder={t("admin.courtName")}
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
          <button
            type="button"
            onClick={addCourt}
            disabled={busy}
            className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            {t("admin.addCourt")}
          </button>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">{t("admin.closures")}</h2>
        <ul className="mb-4 flex flex-col gap-2">
          {closures.map((closure) => (
            <li
              key={closure.id}
              className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
            >
              <span>
                {courtName(closure.court_id)} — {closure.closed_date}
                {closure.reason ? ` (${closure.reason})` : ""}
              </span>
              <button
                type="button"
                onClick={() => deleteClosure(closure.id)}
                disabled={busy}
                className="text-red-600 hover:underline"
              >
                {t("admin.delete")}
              </button>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <select
            value={selectedCourtId}
            onChange={(e) => setSelectedCourtId(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            {courts.map((court) => (
              <option key={court.id} value={court.id}>
                {courtDisplayName(court, t)}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={closedDate}
            onChange={(e) => setClosedDate(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("admin.reason")}
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
          <button
            type="button"
            onClick={addClosure}
            disabled={busy}
            className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            {t("admin.addClosure")}
          </button>
        </div>
      </section>
    </div>
  );
}
