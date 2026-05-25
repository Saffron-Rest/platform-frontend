import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchEntryAudits,
  revertEntry,
  type EntryAuditLog,
} from "../../api/entries";
import {
  actionAccent,
  actionIcon,
  formatAction,
  formatFullTime,
  relativeTime,
} from "../../lib/auditDisplay";

type ChangeRow = { field: string; from: unknown; to: unknown };

type Props = {
  /** When `false` the drawer is unmounted (so we never display stale data). */
  open: boolean;
  /** Required while {@code open}; the report whose history we're showing. */
  entryId: string | null;
  /** Short human label for the header (e.g. "Anna · 2026-05-20"). */
  title?: string;
  /** Whether the current user has permission to revert entries (admin / manager). */
  canRevert: boolean;
  onClose: () => void;
  /** Fired after a successful revert. Parent should re-fetch the report. */
  onReverted?: () => void;
};

/** Money formatter shared across the diff table. */
const MONEY = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
});

function isMoneyField(field: string) {
  return /balance|sales|amount|expense|deposit|withdrawal|refund|difference|counted|payout|settled/i.test(
    field,
  );
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number")
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  return String(value);
}

function formatChangeCell(field: string, value: unknown) {
  if (isMoneyField(field) && typeof value === "number") {
    return MONEY.format(value);
  }
  return formatValue(value);
}

/** Why a given log row can't be reverted (returns null when it *can*). */
function revertBlockedReason(log: EntryAuditLog): string | null {
  if (log.action === "CREATE") return "Reverting a creation isn't supported — remove the draft instead.";
  if (log.action === "LOGIN" || log.action === "LOGIN_FAILED" || log.action === "EXPORT" || log.action === "SYNC")
    return "This event has no field-level changes to undo.";
  // UPDATE / DELETE / SUBMIT / UNLOCK — all revertable on the backend.
  return null;
}

function actionHeadline(log: EntryAuditLog): string {
  switch (log.action) {
    case "CREATE":
      return "Report created";
    case "UPDATE":
      // Always show what actually changed when we know it — falls back to the
      // server-computed summary (e.g. "Updated DailyEntry (3 fields)").
      return log.summary || "Report edited";
    case "SUBMIT":
      return "Report submitted (locked)";
    case "UNLOCK":
      return "Report unlocked (back to draft)";
    case "DELETE":
      return "Report removed (soft delete)";
    default:
      return log.summary || formatAction(String(log.action));
  }
}

export function EntryHistoryDrawer({
  open,
  entryId,
  title,
  canRevert,
  onClose,
  onReverted,
}: Props) {
  const [items, setItems] = useState<EntryAuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [revertingId, setRevertingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!entryId) return;
    setLoading(true);
    setError("");
    try {
      const rows = await fetchEntryAudits(entryId);
      setItems(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load history");
    } finally {
      setLoading(false);
    }
  }, [entryId]);

  useEffect(() => {
    if (open) {
      setExpandedId(null);
      setRevertingId(null);
      void load();
    }
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleRevert = useCallback(
    async (log: EntryAuditLog) => {
      if (!entryId) return;
      const blocked = revertBlockedReason(log);
      if (blocked) {
        setError(blocked);
        return;
      }
      // Tailored confirm copy per action so admins know exactly what will flip.
      const intro =
        log.action === "DELETE"
          ? "Restore this removed report and roll it back to the values it had before deletion?"
          : log.action === "SUBMIT"
            ? "Unlock this report (back to draft) — undoes the submit?"
            : log.action === "UNLOCK"
              ? "Re-lock this report (submit again) — undoes the unlock?"
              : "Roll the report back to the values shown under 'Before'?\n\n" +
                "Note: expense lines and attachments are NOT reverted — only the report's sales, refunds, deposits, opening, count, settled-to-card overrides, notes and status.";
      const reason = window.prompt(
        `${intro}\n\nEnter a short reason (min 3 chars):`,
        "",
      );
      if (reason == null) return;
      const trimmed = reason.trim();
      if (trimmed.length < 3) {
        setError("Revert reason must be at least 3 characters.");
        return;
      }
      setRevertingId(log.id);
      setError("");
      try {
        await revertEntry(entryId, log.id, trimmed);
        onReverted?.();
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not revert");
      } finally {
        setRevertingId(null);
      }
    },
    [entryId, load, onReverted],
  );

  const renderedItems = useMemo(() => items, [items]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex" aria-modal="true" role="dialog">
      <button
        type="button"
        className="flex-1 bg-black/40"
        onClick={onClose}
        aria-label="Close history"
      />
      <aside className="w-full sm:w-[460px] bg-white flex flex-col shadow-2xl">
        <header className="px-4 py-3 border-b border-black/10 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate">Edit history</h3>
            {title && (
              <p className="text-xs text-[var(--color-muted)] truncate">{title}</p>
            )}
          </div>
          <span className="text-xs text-[var(--color-muted)] tabular-nums">
            {items.length}
          </span>
          <button
            type="button"
            className="text-[var(--color-muted)] hover:text-[var(--color-ink)] text-lg leading-none"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        {error && (
          <div className="mx-4 mt-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-800 px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-[var(--color-cream)]/30">
          {loading && (
            <p className="text-sm text-[var(--color-muted)] text-center py-6">
              Loading history…
            </p>
          )}
          {!loading && renderedItems.length === 0 && (
            <p className="text-sm text-[var(--color-muted)] text-center py-6">
              No history yet. Edits will appear here as the report changes.
            </p>
          )}
          {renderedItems.map((log) => {
            const isExpanded = expandedId === log.id;
            const changes = Array.isArray(log.details?.changes)
              ? (log.details!.changes as ChangeRow[])
              : [];
            const blocked = revertBlockedReason(log);
            const reverting = revertingId === log.id;
            const isRevertedAction = typeof log.details?.revertedFromAuditId === "string";
            return (
              <article
                key={log.id}
                className="rounded-2xl bg-white border border-black/5 shadow-sm overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  className="w-full text-left px-3 py-2.5 flex items-start gap-3 hover:bg-[var(--color-cream)]/40"
                >
                  <span
                    className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ring-1 shrink-0 ${actionAccent(String(log.action))}`}
                    aria-hidden
                  >
                    {actionIcon(String(log.action))}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold leading-snug">
                        {actionHeadline(log)}
                      </p>
                      {isRevertedAction && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 ring-1 ring-amber-200">
                          Revert
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--color-muted)] mt-0.5">
                      {log.user?.name ?? "System"} · {relativeTime(log.createdAt)}
                    </p>
                    {changes.length > 0 && !isExpanded && (
                      <p className="text-[11px] text-[var(--color-muted)] mt-1">
                        {changes.length} field{changes.length === 1 ? "" : "s"} changed
                      </p>
                    )}
                  </div>
                  <span
                    className="text-xs text-[var(--color-muted)] shrink-0 mt-1"
                    aria-hidden
                  >
                    {isExpanded ? "▾" : "▸"}
                  </span>
                </button>

                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-black/5 bg-[var(--color-cream)]/40 space-y-3">
                    <div className="text-[11px] text-[var(--color-muted)] pt-2">
                      {formatFullTime(log.createdAt)}
                      {log.ipAddress && <> · {log.ipAddress}</>}
                    </div>

                    {typeof log.details?.reason === "string" && (
                      <div className="rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-[12px] text-amber-950">
                        <span className="font-medium">Reason: </span>
                        {String(log.details.reason)}
                      </div>
                    )}

                    {changes.length > 0 ? (
                      <div className="rounded-xl border border-black/8 overflow-hidden bg-white">
                        <table className="w-full text-[12px]">
                          <thead>
                            <tr className="bg-[var(--color-cream)] text-left text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
                              <th className="px-2.5 py-1.5 font-medium">Field</th>
                              <th className="px-2.5 py-1.5 font-medium">Before</th>
                              <th className="px-2.5 py-1.5 font-medium">After</th>
                            </tr>
                          </thead>
                          <tbody>
                            {changes.map((c) => (
                              <tr key={c.field} className="border-t border-black/5">
                                <td className="px-2.5 py-1.5 font-medium capitalize">
                                  {c.field.replace(/([A-Z])/g, " $1")}
                                </td>
                                <td className="px-2.5 py-1.5 text-[var(--color-muted)] tabular-nums">
                                  {formatChangeCell(c.field, c.from)}
                                </td>
                                <td className="px-2.5 py-1.5 font-medium tabular-nums">
                                  {formatChangeCell(c.field, c.to)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-[12px] text-[var(--color-muted)] italic">
                        No field-level diff for this event.
                      </p>
                    )}

                    {canRevert && (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          disabled={!!blocked || reverting}
                          onClick={() => void handleRevert(log)}
                          className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-md bg-amber-100 text-amber-900 ring-1 ring-amber-200 hover:bg-amber-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          title={blocked ?? "Roll the report back to the 'before' values"}
                        >
                          {reverting ? "Reverting…" : "Revert this change"}
                        </button>
                        {blocked && (
                          <span className="text-[11px] text-[var(--color-muted)]">
                            {blocked}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
