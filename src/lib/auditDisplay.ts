export type AuditLogLike = {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  summary?: string;
  createdAt: string;
  user?: { name: string; email?: string; role?: string };
  ipAddress?: string;
  details?: Record<string, unknown>;
};

export function formatAction(action: string) {
  return action.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function entityLabel(type: string) {
  const labels: Record<string, string> = {
    DailyEntry: "Cash report",
    ExpenseItem: "Expense",
    User: "Team member",
    Settings: "Settings",
    Report: "Export",
    Auth: "Sign-in",
    StockItem: "Stock item",
  };
  return labels[type] ?? type;
}

export function actionVariant(action: string): "draft" | "locked" | "inactive" | "neutral" {
  if (action === "DELETE" || action === "LOGIN_FAILED") return "inactive";
  if (action === "SUBMIT" || action === "LOGIN") return "locked";
  if (action === "UNLOCK" || action === "EXPORT") return "draft";
  return "neutral";
}

export function actionAccent(action: string): string {
  switch (action) {
    case "LOGIN_FAILED":
    case "DELETE":
      return "bg-red-100 text-red-800 ring-red-200";
    case "LOGIN":
    case "SUBMIT":
      return "bg-emerald-100 text-emerald-800 ring-emerald-200";
    case "EXPORT":
    case "UNLOCK":
      return "bg-amber-100 text-amber-900 ring-amber-200";
    case "CREATE":
      return "bg-blue-100 text-blue-800 ring-blue-200";
    case "STOCK_ADJUST":
      return "bg-violet-100 text-violet-800 ring-violet-200";
    case "STOCK_REVERT":
      return "bg-orange-100 text-orange-800 ring-orange-200";
    default:
      return "bg-[var(--color-cream)] text-[var(--color-ink)] ring-black/10";
  }
}

export function actionIcon(action: string): string {
  switch (action) {
    case "LOGIN":
      return "→";
    case "LOGIN_FAILED":
      return "!";
    case "CREATE":
      return "+";
    case "UPDATE":
    case "SYNC":
      return "↻";
    case "DELETE":
      return "×";
    case "SUBMIT":
      return "✓";
    case "UNLOCK":
      return "○";
    case "EXPORT":
      return "↓";
    case "STOCK_ADJUST":
      return "±";
    case "STOCK_REVERT":
      return "↶";
    default:
      return "•";
  }
}

export function relativeTime(iso: string) {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const sec = Math.floor((now - then) / 1000);
  if (sec < 60) return "Just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatFullTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function dayGroupKey(iso: string) {
  return iso.slice(0, 10);
}

export function formatDayGroup(isoDate: string) {
  const d = new Date(isoDate + "T12:00:00");
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toISOString().slice(0, 10);
  if (isoDate === todayKey) return "Today";
  if (isoDate === yesterdayKey) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

export function entityLink(log: AuditLogLike): string | null {
  if (log.entityType === "DailyEntry" && log.entityId) return `/entry/${log.entityId}`;
  if (log.entityType === "DailyEntry" && log.details && typeof log.details === "object") {
    const entryId = (log.details as Record<string, unknown>).entryId;
    if (typeof entryId === "string") return `/entry/${entryId}`;
  }
  return null;
}
