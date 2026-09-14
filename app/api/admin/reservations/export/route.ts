import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRoleApi } from "@/lib/auth/admin-guard";
import type { ReservationStatus } from "@/types/database";

const VALID_STATUSES: ReservationStatus[] = ["pending_payment", "confirmed", "cancelled", "expired"];

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const guard = await requireRoleApi(supabase, ["staff", "admin"]);
  if (guard instanceof NextResponse) return guard;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const courtId = searchParams.get("court_id");
  const status = searchParams.get("status");

  let query = supabase
    .from("reservations")
    .select("id, reservation_date, start_time, end_time, status, amount, created_at, court_id, user_id, courts(name), profiles(full_name, student_id, email)")
    .order("reservation_date", { ascending: false })
    .order("start_time", { ascending: false });

  if (from) query = query.gte("reservation_date", from);
  if (to) query = query.lte("reservation_date", to);
  if (courtId) query = query.eq("court_id", courtId);
  if (status && VALID_STATUSES.includes(status as ReservationStatus)) {
    query = query.eq("status", status as ReservationStatus);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  const header = ["date", "start", "end", "court", "student_name", "student_id", "email", "status", "amount", "created_at"];
  const rows = (data ?? []).map((r) => {
    const court = r.courts as unknown as { name: string } | null;
    const profile = r.profiles as unknown as { full_name: string; student_id: string | null; email: string } | null;
    return [
      r.reservation_date,
      r.start_time,
      r.end_time,
      court?.name ?? "",
      profile?.full_name ?? "",
      profile?.student_id ?? "",
      profile?.email ?? "",
      r.status,
      String(r.amount),
      r.created_at,
    ]
      .map((v) => csvEscape(String(v)))
      .join(",");
  });

  const csv = "﻿" + [header.join(","), ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="reservations.csv"`,
    },
  });
}
