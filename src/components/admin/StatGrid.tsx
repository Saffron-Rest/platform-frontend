import { fmt } from "../../lib/calc";

export type StatItem = {
  label: string;
  value: number;
  accent?: boolean;
  warn?: boolean;
  sub?: string;
};

export function StatGrid({ items, columns = 2 }: { items: StatItem[]; columns?: 2 | 3 | 4 }) {
  const colClass =
    columns === 4
      ? "grid-cols-2 lg:grid-cols-4"
      : columns === 3
        ? "grid-cols-2 md:grid-cols-3"
        : "grid-cols-2";

  return (
    <div className={`grid ${colClass} gap-3`}>
      {items.map((c) => (
        <div
          key={c.label}
          className={`rounded-2xl p-4 border ${
            c.accent
              ? "bg-[var(--color-saffron)] text-white border-transparent shadow-md shadow-[var(--color-saffron)]/20"
              : c.warn
                ? "bg-red-50 border-red-200"
                : "bg-white border-black/[0.06] shadow-sm"
          }`}
        >
          <p
            className={`text-[10px] font-semibold uppercase tracking-wide ${
              c.accent ? "text-white/80" : "text-[var(--color-muted)]"
            }`}
          >
            {c.label}
          </p>
          <p className="text-lg md:text-xl font-bold tabular-nums mt-1">{fmt(c.value)}</p>
          {c.sub && (
            <p className={`text-xs mt-1 ${c.accent ? "text-white/70" : "text-[var(--color-muted)]"}`}>
              {c.sub}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
