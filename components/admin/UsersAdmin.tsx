"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import type { UserRole } from "@/types/database";

interface ProfileRow {
  id: string;
  full_name: string;
  email: string;
  student_id: string | null;
  role: UserRole;
  is_fee_exempt: boolean;
}

const ROLES: UserRole[] = ["student", "staff", "admin"];

export function UsersAdmin({ profiles, currentUserId }: { profiles: ProfileRow[]; currentUserId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  const updateUser = async (id: string, body: { role?: UserRole; is_fee_exempt?: boolean }) => {
    setBusyId(id);
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusyId(null);
    router.refresh();
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
      <table className="w-full min-w-[680px] border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-900">
            <th className="border-b border-slate-200 px-3 py-2 text-left dark:border-slate-800">氏名</th>
            <th className="border-b border-slate-200 px-3 py-2 text-left dark:border-slate-800">メール</th>
            <th className="border-b border-slate-200 px-3 py-2 text-left dark:border-slate-800">学籍番号</th>
            <th className="border-b border-slate-200 px-3 py-2 text-left dark:border-slate-800">{t("admin.role")}</th>
            <th className="border-b border-slate-200 px-3 py-2 text-left dark:border-slate-800">
              {t("admin.feeExempt")}
            </th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((p) => (
            <tr key={p.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
              <td className="px-3 py-2">{p.full_name}</td>
              <td className="px-3 py-2">{p.email}</td>
              <td className="px-3 py-2">{p.student_id ?? "-"}</td>
              <td className="px-3 py-2">
                <select
                  value={p.role}
                  disabled={busyId === p.id || p.id === currentUserId}
                  onChange={(e) => updateUser(p.id, { role: e.target.value as UserRole })}
                  className="rounded-md border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-2">
                <input
                  type="checkbox"
                  checked={p.is_fee_exempt}
                  disabled={busyId === p.id}
                  onChange={(e) => updateUser(p.id, { is_fee_exempt: e.target.checked })}
                  className="h-4 w-4"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
