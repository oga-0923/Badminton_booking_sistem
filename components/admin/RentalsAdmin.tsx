"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import type { Equipment, EquipmentType, LoanStatus } from "@/types/database";

interface LoanRow {
  id: string;
  equipment_id: string;
  quantity: number;
  status: LoanStatus;
  has_student_id: boolean;
  fee_amount: number;
  fee_collected: boolean;
  borrowed_at: string;
  profiles: { full_name: string; student_id: string | null } | { full_name: string; student_id: string | null }[] | null;
}

function firstOf<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

const typeKey: Record<EquipmentType, "rental.racket" | "rental.shuttle"> = {
  racket: "rental.racket",
  shuttle: "rental.shuttle",
};

export function RentalsAdmin({ equipment, loans }: { equipment: Equipment[]; loans: LoanRow[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [newType, setNewType] = useState<EquipmentType>("racket");
  const [newName, setNewName] = useState("");
  const [newQuantity, setNewQuantity] = useState(1);
  const [busy, setBusy] = useState(false);

  const equipmentName = (id: string) => {
    const item = equipment.find((e) => e.id === id);
    return item ? `${t(typeKey[item.type])} (${item.name})` : id;
  };

  const addEquipment = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    await fetch("/api/admin/equipment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: newType, name: newName.trim(), total_quantity: newQuantity }),
    });
    setNewName("");
    setNewQuantity(1);
    setBusy(false);
    router.refresh();
  };

  const updateQuantity = async (id: string, totalQuantity: number) => {
    setBusy(true);
    await fetch(`/api/admin/equipment/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ total_quantity: totalQuantity }),
    });
    setBusy(false);
    router.refresh();
  };

  const markReturned = async (id: string) => {
    setBusy(true);
    await fetch(`/api/admin/loans/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mark_returned: true }),
    });
    setBusy(false);
    router.refresh();
  };

  const toggleFeeCollected = async (id: string, collected: boolean) => {
    setBusy(true);
    await fetch(`/api/admin/loans/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fee_collected: collected }),
    });
    setBusy(false);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="mb-3 text-lg font-bold">{t("admin.rentals")}</h2>
        <ul className="mb-4 flex flex-col gap-2">
          {equipment.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
            >
              <span>
                {t(typeKey[item.type])} ({item.name})
              </span>
              <input
                type="number"
                min={0}
                defaultValue={item.total_quantity}
                onBlur={(e) => {
                  const value = Number(e.target.value);
                  if (Number.isInteger(value) && value !== item.total_quantity) {
                    updateQuantity(item.id, value);
                  }
                }}
                className="w-20 rounded-md border border-slate-300 px-2 py-1 text-center dark:border-slate-700 dark:bg-slate-900"
              />
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as EquipmentType)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="racket">{t("rental.racket")}</option>
            <option value="shuttle">{t("rental.shuttle")}</option>
          </select>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t("admin.equipmentName")}
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
          <input
            type="number"
            min={0}
            value={newQuantity}
            onChange={(e) => setNewQuantity(Number(e.target.value) || 0)}
            className="w-20 rounded-md border border-slate-300 px-2 py-2 text-center text-sm dark:border-slate-700 dark:bg-slate-900"
          />
          <button
            type="button"
            onClick={addEquipment}
            disabled={busy}
            className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            {t("admin.addEquipment")}
          </button>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">{t("admin.activeLoans")}</h2>
        {loans.length === 0 ? (
          <p className="text-sm text-slate-500">{t("rental.noLoans")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {loans.map((loan) => {
              const profile = firstOf(loan.profiles);
              return (
                <li
                  key={loan.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
                >
                  <span>
                    {profile?.full_name ?? "-"} ({profile?.student_id ?? "-"}) — {equipmentName(loan.equipment_id)} ×{" "}
                    {loan.quantity}
                  </span>
                  <div className="flex items-center gap-2">
                    {loan.fee_amount > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleFeeCollected(loan.id, !loan.fee_collected)}
                        disabled={busy}
                        className={`rounded-md px-2 py-1 text-xs ${
                          loan.fee_collected
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                        }`}
                      >
                        {loan.fee_amount} — {loan.fee_collected ? t("admin.feeCollected") : t("admin.feeNotCollected")}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => markReturned(loan.id)}
                      disabled={busy}
                      className="rounded-md bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
                    >
                      {t("admin.markReturned")}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
