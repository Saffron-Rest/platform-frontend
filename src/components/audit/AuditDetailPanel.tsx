import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import {
  actionVariant,
  entityLabel,
  entityLink,
  formatAction,
  formatFullTime,
  type AuditLogLike,
} from "../../lib/auditDisplay";

type ChangeRow = { field: string; from: unknown; to: unknown };

export type AuditLogDetail = AuditLogLike & {
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
};

type Props = {
  log: AuditLogDetail | null;
  loading?: boolean;
  onClose: () => void;
  variant?: "panel" | "drawer";
};

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(2);
  return String(value);
}

function isMoneyField(field: string) {
  return /balance|sales|amount|expense|deposit|withdrawal|refund|difference|counted|payout/i.test(field);
}

export function AuditDetailPanel({ log, loading, onClose, variant = "panel" }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!log && !loading) {
    return (
      <div className="hidden lg:flex flex-col items-center justify-center h-full min-h-[20rem] text-center px-6">
        <p className="text-[var(--color-muted)] text-sm">Select an event to see who changed what and when.</p>
      </div>
    );
  }

  const link = log ? entityLink(log) : null;
  const changes = log?.details?.changes;
  const changeList = Array.isArray(changes) ? (changes as ChangeRow[]) : [];

  const inner = (
    <>
      {loading && (
        <div className="animate-pulse space-y-3 p-5">
          <div className="h-6 w-24 bg-black/10 rounded-full" />
          <div className="h-5 w-3/4 bg-black/10 rounded" />
          <div className="h-32 bg-black/5 rounded-xl" />
        </div>
      )}

      {log && !loading && (
        <div className="p-5 space-y-5">
          <div className="flex justify-between items-start gap-3">
            <div>
              <Badge variant={actionVariant(log.action)}>{formatAction(log.action)}</Badge>
              <h3 className="font-semibold text-lg mt-2 leading-snug">{log.summary}</h3>
              <p className="text-xs text-[var(--color-muted)] mt-1">{formatFullTime(log.createdAt)}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="lg:hidden p-2 -mr-2 rounded-lg text-[var(--color-muted)] hover:bg-black/5"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <Card padding="sm" className="!bg-[var(--color-cream)]/50 space-y-3">
            <dl className="text-sm grid gap-2">
              <div className="grid grid-cols-[5.5rem_1fr] gap-2">
                <dt className="text-[var(--color-muted)]">Actor</dt>
                <dd>
                  {log.user ? (
                    <>
                      <span className="font-medium">{log.user.name}</span>
                      {log.user.email && (
                        <span className="block text-xs text-[var(--color-muted)]">{log.user.email}</span>
                      )}
                    </>
                  ) : (
                    <span className="text-[var(--color-muted)]">System / unknown</span>
                  )}
                </dd>
              </div>
              <div className="grid grid-cols-[5.5rem_1fr] gap-2">
                <dt className="text-[var(--color-muted)]">Target</dt>
                <dd>
                  <span className="font-medium">{entityLabel(log.entityType)}</span>
                  {log.entityId && (
                    <span className="flex items-center gap-2 mt-1">
                      <code className="text-[10px] bg-white px-1.5 py-0.5 rounded border border-black/10 break-all">
                        {log.entityId}
                      </code>
                      <button
                        type="button"
                        className="text-[10px] text-[var(--color-saffron)] font-medium shrink-0"
                        onClick={() => navigator.clipboard.writeText(log.entityId!)}
                      >
                        Copy
                      </button>
                    </span>
                  )}
                </dd>
              </div>
              {log.ipAddress && (
                <div className="grid grid-cols-[5.5rem_1fr] gap-2">
                  <dt className="text-[var(--color-muted)]">IP</dt>
                  <dd className="font-mono text-xs">{log.ipAddress}</dd>
                </div>
              )}
            </dl>
            {link && (
              <Link
                to={link}
                className="inline-flex text-sm font-medium text-[var(--color-saffron)] hover:underline"
              >
                Open related report →
              </Link>
            )}
          </Card>

          {changeList.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)] mb-2">
                What changed ({changeList.length})
              </h4>
              <div className="rounded-xl border border-black/8 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[var(--color-cream)] text-left text-xs text-[var(--color-muted)]">
                      <th className="px-3 py-2 font-medium">Field</th>
                      <th className="px-3 py-2 font-medium">Before</th>
                      <th className="px-3 py-2 font-medium">After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {changeList.map((c) => (
                      <tr key={c.field} className="border-t border-black/5">
                        <td className="px-3 py-2 font-medium capitalize">{c.field.replace(/([A-Z])/g, " $1")}</td>
                        <td className="px-3 py-2 text-[var(--color-muted)] tabular-nums">
                          {isMoneyField(c.field) && typeof c.from === "number"
                            ? new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(c.from)
                            : formatValue(c.from)}
                        </td>
                        <td className="px-3 py-2 font-medium tabular-nums">
                          {isMoneyField(c.field) && typeof c.to === "number"
                            ? new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(c.to)
                            : formatValue(c.to)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {log.details?.reason != null && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-950">
              <span className="font-medium">Reason: </span>
              {String(log.details.reason)}
            </div>
          )}

          {log.details && (
            <details className="text-xs group">
              <summary className="cursor-pointer font-medium text-[var(--color-saffron)] list-none flex items-center gap-1">
                <span className="group-open:rotate-90 transition inline-block">›</span> Technical details (JSON)
              </summary>
              <pre className="mt-2 p-3 rounded-xl bg-black/[0.04] overflow-x-auto whitespace-pre-wrap break-all text-[11px] leading-relaxed max-h-48">
                {JSON.stringify(log.details, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </>
  );

  if (variant === "drawer") {
    return (
      <>
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={onClose} aria-hidden />
        <div className="fixed inset-x-0 bottom-0 z-50 lg:hidden max-h-[88vh] overflow-y-auto rounded-t-2xl bg-white shadow-2xl">
          <div className="sticky top-0 bg-white border-b border-black/5 px-4 py-2 flex justify-center">
            <span className="w-10 h-1 rounded-full bg-black/15" />
          </div>
          {inner}
          <div className="p-4 pb-8">
            <Button variant="secondary" fullWidth onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </>
    );
  }

  return <div className="h-full overflow-y-auto border-l border-black/5 bg-white">{inner}</div>;
}
