"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";

function parseCsv(text: string): { student_id: string; full_name: string | null; email: string | null }[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [studentId, fullName, email] = line.split(",").map((v) => v?.trim() ?? "");
      return {
        student_id: studentId ?? "",
        full_name: fullName || null,
        email: email || null,
      };
    })
    .filter((r) => r.student_id.length > 0);
}

export function RosterAdmin({ currentCount }: { currentCount: number }) {
  const { t } = useI18n();
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleReplace = async () => {
    const rows = parseCsv(text);
    if (rows.length === 0) {
      setMessage({ type: "error", text: t("admin.rosterEmpty") });
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      if (!res.ok) {
        setMessage({ type: "error", text: t("common.error") });
      } else {
        const data = await res.json();
        setMessage({ type: "success", text: t("admin.rosterReplaced", { n: data.count }) });
        setText("");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold">{t("admin.roster")}</h2>
        <p className="mt-1 text-sm text-slate-500">{t("admin.rosterCurrentCount", { n: currentCount })}</p>
        <p className="mt-1 text-sm text-slate-500">{t("admin.rosterFormat")}</p>
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

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"2021001,山田太郎,yamada@example.ac.jp\n2021002,田中花子,tanaka@example.ac.jp"}
        rows={12}
        className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-900"
      />

      <button
        type="button"
        onClick={handleReplace}
        disabled={busy}
        className="self-start rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {t("admin.rosterReplaceButton")}
      </button>
    </div>
  );
}
