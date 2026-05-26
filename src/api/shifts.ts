import { api } from "./client";

export type BulkAssignPayload = {
  from: string;
  to: string;
  /** Empty/undefined = all 7 days. */
  weekdays?: Weekday[];
  userIds: string[];
  startTime: string;
  endTime?: string | null;
  tillClose: boolean;
  /** When true, days where this cashier already has a shift are skipped. */
  skipExisting: boolean;
};

export type Weekday =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

export type BulkResult = {
  created: number;
  updated: number;
  skipped: number;
  affectedDays: number;
  skippedDates?: string[];
};

export type CopyWeekPayload = {
  sourceWeekStart: string;
  targetWeekStart: string;
  overwrite: boolean;
};

export type ClearRangeResult = {
  deleted: number;
  affectedDays: number;
};

export async function bulkAssignShifts(payload: BulkAssignPayload) {
  return api<BulkResult>(`/shifts/bulk-assign`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function copyWeekShifts(payload: CopyWeekPayload) {
  return api<BulkResult>(`/shifts/copy-week`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function clearShiftRange(from: string, to: string, userId?: string) {
  const params = new URLSearchParams({ from, to });
  if (userId) params.set("userId", userId);
  return api<ClearRangeResult>(`/shifts/range?${params.toString()}`, {
    method: "DELETE",
  });
}

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  MONDAY: "Mon",
  TUESDAY: "Tue",
  WEDNESDAY: "Wed",
  THURSDAY: "Thu",
  FRIDAY: "Fri",
  SATURDAY: "Sat",
  SUNDAY: "Sun",
};

export const WEEKDAY_ORDER: Weekday[] = [
  "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY",
];
