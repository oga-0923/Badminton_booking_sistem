"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface ProfileFormProps {
  userId: string;
  email: string;
  initial: { full_name: string; student_id: string | null; phone: string | null } | null;
}

export function ProfileForm({ userId, email, initial }: ProfileFormProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [fullName, setFullName] = useState(initial?.full_name ?? "");
  const [studentId, setStudentId] = useState(initial?.student_id ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const trimmed = studentId.trim();
    if (!trimmed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVerified(null);
      return;
    }

    setChecking(true);
    const timer = setTimeout(() => {
      const supabase = createClient();
      supabase.rpc("check_student_id", { p_student_id: trimmed }).then(({ data }) => {
        setVerified(Boolean(data));
        setChecking(false);
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [studentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);

    if (!fullName.trim()) {
      setError(t("profile.required"));
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: upsertError } = await supabase.from("profiles").upsert({
      id: userId,
      email,
      full_name: fullName.trim(),
      student_id: studentId.trim() || null,
      phone: phone.trim() || null,
    });
    setLoading(false);

    if (upsertError) {
      setError(t("common.error"));
      return;
    }

    setSaved(true);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t("profile.title")}</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          {t("auth.email")}
          <input
            type="email"
            value={email}
            disabled
            className="rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-slate-500 dark:border-slate-700 dark:bg-slate-800"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          {t("profile.fullName")}
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          {t("profile.studentId")}
          <input
            type="text"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          />
          {studentId.trim() && !checking && verified !== null && (
            <span
              className={`flex items-center gap-1 text-xs ${
                verified ? "text-emerald-600" : "text-amber-600"
              }`}
            >
              {verified ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  {t("profile.studentIdVerified")}
                </>
              ) : (
                <>
                  <XCircle className="h-3.5 w-3.5" aria-hidden />
                  {t("profile.studentIdNotVerified")}
                </>
              )}
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1 text-sm">
          {t("profile.phone")}
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>

        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          {t("profile.paymentNote")}
        </p>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-emerald-600">{t("profile.saved")}</p>}

        <button
          type="submit"
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {t("profile.save")}
        </button>
      </form>
    </div>
  );
}
