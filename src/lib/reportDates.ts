const todayIso = () => new Date().toISOString().slice(0, 10);

export function formatReportDateLong(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatReportDateShort(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Human label: Today, Yesterday, or formatted short date. */
export function reportDateRelativeLabel(dateStr: string): string {
  const today = todayIso();
  if (dateStr === today) return "Today";
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const yesterday = y.toISOString().slice(0, 10);
  if (dateStr === yesterday) return "Yesterday";
  const d = new Date(dateStr + "T12:00:00");
  const now = new Date(today + "T12:00:00");
  const diffDays = Math.round((now.getTime() - d.getTime()) / 86400000);
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`;
  return formatReportDateShort(dateStr);
}
