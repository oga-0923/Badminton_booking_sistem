"use client";

import { useEffect, useState } from "react";
import { createClient } from "./client";
import type { UserRole } from "@/types/database";

export function useProfileRole(userId: string | undefined) {
  const [role, setRole] = useState<UserRole | null>(null);

  useEffect(() => {
    if (!userId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRole(null);
      return;
    }

    const supabase = createClient();
    let cancelled = false;

    supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setRole(data?.role ?? null);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return role;
}
