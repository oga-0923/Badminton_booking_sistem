import type { VenueSettings } from "@/types/database";

export interface TimeSlot {
  start: string; // "HH:MM"
  end: string; // "HH:MM"
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function toHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function buildTimeSlots(settings: Pick<VenueSettings, "open_time" | "close_time" | "slot_duration_minutes">): TimeSlot[] {
  const open = toMinutes(settings.open_time.slice(0, 5));
  const close = toMinutes(settings.close_time.slice(0, 5));
  const duration = settings.slot_duration_minutes;

  const slots: TimeSlot[] = [];
  for (let start = open; start + duration <= close; start += duration) {
    slots.push({ start: toHHMM(start), end: toHHMM(start + duration) });
  }
  return slots;
}

export function addMinutesToTime(hhmm: string, minutesToAdd: number): string {
  return toHHMM(toMinutes(hhmm) + minutesToAdd);
}

export function isSlotAligned(
  hhmm: string,
  settings: Pick<VenueSettings, "open_time" | "close_time" | "slot_duration_minutes">
): boolean {
  return buildTimeSlots(settings).some((s) => s.start === hhmm.slice(0, 5));
}
