import type { DayHours, WeeklyHours } from "../types";

const DAY_KEYS = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
] as const;

/** Look up the weekday entry for an ISO date string (YYYY-MM-DD). */
export function dayFor(dateIso: string, weekly: WeeklyHours | null | undefined): DayHours | null {
  if (!weekly) return null;
  const d = new Date(`${dateIso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const key = DAY_KEYS[d.getDay()];
  return weekly[key] ?? null;
}

/** Resolved restaurant close time (HH:mm) for the given date, or null if not configured / closed. */
export function closeForDate(dateIso: string, weekly: WeeklyHours | null | undefined): string | null {
  const day = dayFor(dateIso, weekly);
  if (!day || day.closed) return null;
  return day.close;
}

/** Resolved restaurant open time (HH:mm) for the given date, or null if not configured / closed. */
export function openForDate(dateIso: string, weekly: WeeklyHours | null | undefined): string | null {
  const day = dayFor(dateIso, weekly);
  if (!day || day.closed) return null;
  return day.open;
}

/** Open hours between two HH:mm strings as a decimal (e.g. 13.50). Returns 0 on invalid input. */
export function hoursBetween(startHHMM: string | null | undefined, endHHMM: string | null | undefined): number {
  if (!startHHMM || !endHHMM) return 0;
  const [sh, sm] = startHHMM.split(":").map(Number);
  const [eh, em] = endHHMM.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;
  const minutes = eh * 60 + em - (sh * 60 + sm);
  if (minutes <= 0) return 0;
  return Math.round((minutes / 60) * 100) / 100;
}
