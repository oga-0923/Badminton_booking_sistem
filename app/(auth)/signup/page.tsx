"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";
import { createClient } from "@/lib/supabase/client";
import { isAllowedUniversityEmail } from "@/lib/auth/email-domain";
import { Loader2 } from "lucide-react";

export default function SignupPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isAllowedUniversityEmail(email)) {
      setError(t("auth.invalidDomain"));
      return;
    }

    if (password !== passwordConfirm) {
      setError(t("auth.passwordMismatch"));
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);

    if (signUpError) {
      setError(t("auth.genericError"));
      return;
    }

    setDone(true);
  };

  if (done) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 px-4 py-12 text-center">
        <h1 className="text-2xl font-bold">{t("auth.signupTitle")}</h1>
        <p className="text-slate-600 dark:text-slate-300">{t("auth.checkEmail")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-12">
      <h1 className="text-2xl font-bold">{t("auth.signupTitle")}</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          {t("auth.email")}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          />
          <span className="text-xs text-slate-400">{t("auth.emailHint")}</span>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          {t("auth.password")}
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          {t("auth.passwordConfirm")}
          <input
            type="password"
            required
            minLength={8}
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {t("auth.submitSignup")}
        </button>
      </form>

      <p className="text-sm text-slate-500">
        {t("auth.hasAccount")}{" "}
        <Link href="/login" className="text-emerald-700 underline">
          {t("auth.goLogin")}
        </Link>
      </p>
    </div>
  );
}
