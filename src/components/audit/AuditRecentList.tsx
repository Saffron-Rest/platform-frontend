import { Link } from "react-router-dom";
import { AuditEventRow } from "./AuditEventRow";
import type { AuditLogLike } from "../../lib/auditDisplay";

type Props = {
  logs: AuditLogLike[];
  onSelect?: (id: string) => void;
};

export function AuditRecentList({ logs, onSelect }: Props) {
  if (logs.length === 0) {
    return (
      <p className="text-sm text-[var(--color-muted)] py-4 text-center">No recent activity recorded yet.</p>
    );
  }

  return (
    <div className="rounded-xl border border-black/6 overflow-hidden divide-y divide-black/5">
      {logs.map((log) => (
        <AuditEventRow
          key={log.id}
          log={log}
          compact
          onClick={onSelect ? () => onSelect(log.id) : undefined}
        />
      ))}
      <Link
        to="/admin/audit"
        className="block text-center py-3 text-sm font-medium text-[var(--color-saffron)] bg-[var(--color-cream)]/40 hover:bg-[var(--color-cream)] transition"
      >
        View full audit trail →
      </Link>
    </div>
  );
}
