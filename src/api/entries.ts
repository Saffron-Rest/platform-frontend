import { api } from "./client";
import type { AuditLogLike } from "../lib/auditDisplay";
import type { DailyEntry } from "../types";

// (Re-exported so callers don't need to know the underlying audit type.)
export type EntryAuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "SUBMIT"
  | "UNLOCK";

export type EntryAuditDetails = {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  changes?: Array<{ field: string; from: unknown; to: unknown }>;
  reason?: string;
  revertedFromAuditId?: string;
  revertedAction?: string;
  restored?: boolean;
  [k: string]: unknown;
};

export type EntryAuditLog = AuditLogLike & {
  action: EntryAuditAction | string;
  details?: EntryAuditDetails;
};

/**
 * Fetch the edit history for a single shift report. Server-side this is the
 * same filterable {@code /api/audit} endpoint used by the global audit page —
 * we pre-pin {@code entityType=DailyEntry} and the report id so callers get a
 * focused, chronological history.
 */
export async function fetchEntryAudits(
  entryId: string,
  opts: { limit?: number } = {},
): Promise<EntryAuditLog[]> {
  const params = new URLSearchParams({
    entityType: "DailyEntry",
    entityId: entryId,
    limit: String(opts.limit ?? 100),
  });
  const res = await api<{ items: EntryAuditLog[]; total: number }>(
    `/audit?${params.toString()}`,
  );
  return res.items ?? [];
}

/**
 * Roll a shift report back to the state captured by the given audit row's
 * {@code before} snapshot. Admin / manager only on the backend; callers
 * should hide the trigger UI for cashiers.
 */
export async function revertEntry(
  entryId: string,
  auditId: string,
  reason: string,
): Promise<Record<string, unknown>> {
  return api(`/entries/${entryId}/revert`, {
    method: "POST",
    body: JSON.stringify({ auditId, reason }),
  });
}

/**
 * Force the backend to recompute every derived field on a shift report
 * (closing balance, cash difference, treasury splits, …) and return the
 * fresh DTO. Used by the "Sync" buttons when a change made elsewhere
 * (manual deliveries, salary payments, treasury settings, edits from
 * another device) might not yet be reflected in the report's totals.
 *
 * <p>Cashiers may sync their own entry; admin / manager may sync any
 * entry — including locked ones. The endpoint never modifies user-typed
 * fields, only the calculated ones, so it's safe to call at any time.</p>
 */
export async function syncEntry(entryId: string): Promise<DailyEntry> {
  return api<DailyEntry>(`/entries/${entryId}/sync`, { method: "POST" });
}
