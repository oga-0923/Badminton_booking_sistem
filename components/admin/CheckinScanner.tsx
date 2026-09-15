"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { useI18n } from "@/lib/i18n/context";
import { formatLocalDate } from "@/lib/date";
import type { EquipmentType, ReservationStatus } from "@/types/database";

interface CheckinInfo {
  id: string;
  court_name: string;
  reservation_date: string;
  start_time: string;
  end_time: string;
  status: ReservationStatus;
  full_name: string;
  student_id: string | null;
  checked_in_at: string | null;
  rentals: { type: EquipmentType; quantity: number }[];
}

const typeKey: Record<EquipmentType, "rental.racket" | "rental.shuttle"> = {
  racket: "rental.racket",
  shuttle: "rental.shuttle",
};

export function CheckinScanner() {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const scanningRef = useRef(true);
  const tickRef = useRef<() => void>(() => {});

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [info, setInfo] = useState<CheckinInfo | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleScanned = useCallback(async (reservationId: string) => {
    setLookupError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/checkin/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservation_id: reservationId }),
      });
      if (!res.ok) {
        setLookupError(t("admin.checkinNotFound"));
        return;
      }
      const data = await res.json();
      setInfo(data.info);
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    tickRef.current = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA && scanningRef.current) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code?.data) {
            scanningRef.current = false;
            void handleScanned(code.data);
          }
        }
      }
      rafRef.current = requestAnimationFrame(() => tickRef.current());
    };
  }, [handleScanned]);

  useEffect(() => {
    let stream: MediaStream | null = null;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play();
        }
        rafRef.current = requestAnimationFrame(() => tickRef.current());
      })
      .catch(() => {
        setCameraError(t("admin.cameraError"));
      });

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resumeScanning = () => {
    setInfo(null);
    setLookupError(null);
    scanningRef.current = true;
  };

  const approve = async () => {
    if (!info) return;
    setBusy(true);
    try {
      await fetch("/api/admin/checkin/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservation_id: info.id }),
      });
    } finally {
      setBusy(false);
      resumeScanning();
    }
  };

  const isToday = info && info.reservation_date === formatLocalDate(new Date());
  const isConfirmed = info?.status === "confirmed";

  return (
    <div className="flex flex-col gap-4">
      <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-lg bg-black">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        <canvas ref={canvasRef} className="hidden" />
        {cameraError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4 text-center text-sm text-white">
            {cameraError}
          </div>
        )}
      </div>

      {lookupError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-center text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {lookupError}
        </p>
      )}

      {info && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl dark:bg-slate-900">
            <h2 className="mb-1 text-lg font-bold">{info.full_name}</h2>
            <p className="mb-3 text-sm text-slate-500">{info.student_id ?? "-"}</p>

            <p className="text-sm">
              {info.court_name} — {info.reservation_date} {info.start_time.slice(0, 5)}-{info.end_time.slice(0, 5)}
            </p>

            {info.rentals.length > 0 && (
              <ul className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {info.rentals.map((r, i) => (
                  <li key={i}>
                    {t(typeKey[r.type])} × {r.quantity}
                  </li>
                ))}
              </ul>
            )}

            {!isConfirmed && (
              <p className="mt-2 rounded-md bg-red-50 px-2 py-1 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
                {t("admin.checkinNotConfirmed")} ({info.status})
              </p>
            )}
            {isConfirmed && !isToday && (
              <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                {t("admin.checkinWrongDate")}
              </p>
            )}
            {info.checked_in_at && (
              <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                {t("admin.checkinAlready")}
              </p>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={resumeScanning}
                disabled={busy}
                className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
              >
                {t("admin.denyEntry")}
              </button>
              <button
                type="button"
                onClick={approve}
                disabled={busy}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {t("admin.allowEntry")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
