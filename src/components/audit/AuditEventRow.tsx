import { Badge } from "../ui/Badge";
import {
  actionAccent,
  actionIcon,
  actionVariant,
  entityLabel,
  formatAction,
  formatFullTime,
  relativeTime,
  type AuditLogLike,
} from "../../lib/auditDisplay";

type Props = {
  log: AuditLogLike;
  selected?: boolean;
  compact?: boolean;
  onClick?: () => void;
};

export function AuditEventRow({ log, selected, compact, onClick }: Props) {
  const accent = actionAccent(log.action);
  const className = `w-full text-left flex gap-3 px-4 py-3.5 transition border-l-[3px] ${
    selected
      ? "bg-[var(--color-saffron)]/8 border-l-[var(--color-saffron)]"
      : "border-l-transparent" + (onClick ? " hover:bg-[var(--color-cream)]/70" : "")
  }`;

  const content = (
    <>
      <span
        className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ring-1 ${accent}`}
        aria-hidden
      >
        {actionIcon(log.action)}
      </span>

      <span className="flex-1 min-w-0">
        <span className="flex flex-wrap items-center gap-2 mb-0.5">
          <Badge variant={actionVariant(log.action)}>{formatAction(log.action)}</Badge>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            {entityLabel(log.entityType)}
          </span>
        </span>

        <span className={`block font-medium text-[var(--color-ink)] ${compact ? "text-sm" : ""} truncate`}>
          {log.summary ?? `${formatAction(log.action)} ${entityLabel(log.entityType)}`}
        </span>

        {!compact && (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--color-muted)] mt-1">
            <span className="font-medium text-[var(--color-ink)]/80">{log.user?.name ?? "System"}</span>
            {log.user?.role && <span>· {log.user.role}</span>}
            <span title={formatFullTime(log.createdAt)}>· {relativeTime(log.createdAt)}</span>
            {log.ipAddress && <span>· {log.ipAddress}</span>}
          </span>
        )}
      </span>

      {compact && (
        <span className="text-xs text-[var(--color-muted)] shrink-0" title={formatFullTime(log.createdAt)}>
          {relativeTime(log.createdAt)}
        </span>
      )}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}
