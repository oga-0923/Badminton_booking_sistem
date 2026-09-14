"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import type { Equipment, EquipmentLoan } from "@/types/database";

interface RentalFormProps {
  equipment: (Equipment & { available: number })[];
  myLoans: Pick<EquipmentLoan, "id" | "equipment_id" | "quantity" | "status" | "fee_amount" | "borrowed_at">[];
  isFree: boolean;
  feePerItem: number;
}

const typeKey: Record<Equipment["type"], "rental.racket" | "rental.shuttle"> = {
  racket: "rental.racket",
  shuttle: "rental.shuttle",
};

export function RentalForm({ equipment, myLoans, isFree, feePerItem }: RentalFormProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const equipmentName = (item: Equipment) => t(typeKey[item.type]);
  const findLoanEquipment = (equipmentId: string) => equipment.find((e) => e.id === equipmentId);

  const handleSubmit = async (item: Equipment & { available: number }) => {
    const quantity = quantities[item.id] ?? 1;
    setMessage(null);
    setSubmittingId(item.id);

    try {
      const res = await fetch("/api/rentals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ equipment_id: item.id, quantity }),
      });

      if (res.status === 409) {
        setMessage({ type: "error", text: t("rental.insufficientStock") });
      } else if (!res.ok) {
        setMessage({ type: "error", text: t("common.error") });
      } else {
        setMessage({ type: "success", text: t("rental.success") });
        router.refresh();
      }
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("rental.title")}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("rental.intro")}</p>
      </div>

      <div
        className={`rounded-md border px-3 py-2 text-sm ${
          isFree
            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
            : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
        }`}
      >
        <p>{isFree ? t("rental.verifiedStudent") : t("rental.notVerifiedStudent")}</p>
        {!isFree && <p className="mt-1 text-xs opacity-80">{t("rental.hasStudentIdHint")}</p>}
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

      <div className="flex flex-col gap-3">
        {equipment.map((item) => {
          const quantity = quantities[item.id] ?? 1;
          const fee = isFree ? 0 : feePerItem * quantity;
          return (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800"
            >
              <div>
                <p className="font-medium">{equipmentName(item)}</p>
                <p className="text-xs text-slate-500">{t("rental.available", { n: item.available })}</p>
                <p className="text-xs text-slate-500">
                  {fee === 0 ? t("rental.feeFree") : t("rental.feeCharged", { amount: fee })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={Math.max(item.available, 1)}
                  value={quantity}
                  onChange={(e) =>
                    setQuantities((q) => ({ ...q, [item.id]: Math.max(1, Number(e.target.value) || 1) }))
                  }
                  className="w-16 rounded-md border border-slate-300 px-2 py-1 text-center dark:border-slate-700 dark:bg-slate-900"
                />
                <button
                  type="button"
                  onClick={() => handleSubmit(item)}
                  disabled={item.available < 1 || submittingId === item.id}
                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {t("rental.submit")}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div>
        <h2 className="mb-2 text-lg font-bold">{t("rental.yourLoans")}</h2>
        {myLoans.length === 0 ? (
          <p className="text-sm text-slate-500">{t("rental.noLoans")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {myLoans.map((loan) => {
              const item = findLoanEquipment(loan.equipment_id);
              return (
                <li
                  key={loan.id}
                  className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
                >
                  <span>
                    {item ? equipmentName(item) : loan.equipment_id} × {loan.quantity}
                  </span>
                  <span className="text-xs text-slate-500">
                    {loan.status === "borrowed" ? t("rental.statusBorrowed") : t("rental.statusReturned")}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
