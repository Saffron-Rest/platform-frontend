import { fmt } from "../../lib/calc";

type Props = {
  opening: number;
  sales: number;
  expected: number;
  actual: number;
  difference: number;
  closingOnly?: boolean;
};

export function ReportSummaryBar({
  opening,
  sales,
  expected,
  actual,
  difference,
  closingOnly,
}: Props) {
  const short =
    difference < -0.01 ? "short" : difference > 0.01 ? "over" : "ok";

  return (
    <div
      data-tour="tour-entry-summary"
      // On mobile we sit just below the sticky mini-header (h-14 = 3.5rem).
      // z-20 < the header's z-30 so even if the offset is briefly wrong on
      // an in-app keyboard close, the header still wins.
      className="sticky top-14 z-20 -mx-4 px-4 py-2.5 mb-4 bg-[var(--color-cream)]/95 backdrop-blur-md border-b border-black/5 md:static md:top-auto md:mx-0 md:px-0 md:rounded-2xl md:border md:bg-white md:shadow-sm"
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        <div className="px-2 py-1.5 rounded-xl bg-white/80 md:bg-[var(--color-cream)]/50">
          <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Opening</p>
          <p className="text-sm font-bold tabular-nums">{fmt(opening)}</p>
        </div>
        {!closingOnly && (
          <div className="px-2 py-1.5 rounded-xl bg-white/80 md:bg-[var(--color-cream)]/50">
            <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Sales</p>
            <p className="text-sm font-bold tabular-nums">{fmt(sales)}</p>
          </div>
        )}
        <div className="px-2 py-1.5 rounded-xl bg-white/80 md:bg-[var(--color-cream)]/50">
          <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Expected</p>
          <p className="text-sm font-bold tabular-nums">{fmt(expected)}</p>
        </div>
        <div
          className={`px-2 py-1.5 rounded-xl col-span-2 sm:col-span-1 ${
            short === "short"
              ? "bg-red-50 text-[var(--color-danger)]"
              : short === "over"
                ? "bg-emerald-50 text-[var(--color-success)]"
                : "bg-[var(--color-saffron)]/15 text-[var(--color-saffron-dark)]"
          }`}
        >
          <p className="text-[10px] uppercase tracking-wide opacity-80">Difference</p>
          <p className="text-sm font-bold tabular-nums">{fmt(difference)}</p>
        </div>
      </div>
      {actual > 0 && (
        <p className="text-[10px] text-center text-[var(--color-muted)] mt-1.5">
          Counted: <strong className="text-[var(--color-ink)]">{fmt(actual)}</strong>
        </p>
      )}
    </div>
  );
}
