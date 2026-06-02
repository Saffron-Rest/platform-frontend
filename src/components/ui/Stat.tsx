import type { ReactNode } from "react";

export type StatTone = "neutral" | "positive" | "negative" | "warning" | "brand";
export type StatEmphasis = "default" | "hero";

const ACCENT: Record<StatTone, string> = {
  neutral: "border-l-transparent",
  positive: "border-l-emerald-500",
  negative: "border-l-[var(--color-danger)]",
  warning: "border-l-amber-500",
  brand: "border-l-[var(--color-saffron)]",
};

const VALUE_COLOR: Record<StatTone, string> = {
  neutral: "text-[var(--color-ink)]",
  positive: "text-emerald-700",
  negative: "text-[var(--color-danger)]",
  warning: "text-amber-700",
  brand: "text-[var(--color-saffron-dark)]",
};

type StatProps = {
  /** Short uppercase eyebrow above the value. */
  label: ReactNode;
  /** The headline number (or string for non-numeric metrics). Rendered
   *  with {@code tabular-nums} so digits don't shift width when values
   *  change. */
  value: ReactNode;
  /** Optional one-liner below the value (delta, period, supporting text). */
  hint?: ReactNode;
  /** Severity colouring. Drives both the left accent border and the
   *  value foreground colour. */
  tone?: StatTone;
  /** Visual weight. {@code hero} renders the value larger and uses a
   *  saffron-tinted card background — best for the lead KPI on a page. */
  emphasis?: StatEmphasis;
  /** Optional icon rendered top-right (e.g. category glyph). */
  icon?: ReactNode;
  /** Whole-tile click handler. When provided, the Stat becomes a button
   *  with hover/focus styling — useful for filter cards. */
  onClick?: () => void;
  /** Indicates the tile is currently filtering/highlighted. Pairs with
   *  {@code onClick}. */
  active?: boolean;
  className?: string;
};

/**
 * Single KPI tile. Replaces the six inline {@code StatTile / Stat /
 * StatBox / KpiTile} variants across {@code Dashboard}, {@code AdminPayables},
 * {@code AdminOwnerExpenses}, {@code AdminPosSimulator}, {@code AdminRecipes},
 * {@code AdminStock}, {@code TreasuryHistory}, {@code Reports}, etc.
 *
 * <p>Defaults are tuned for "label / number / hint" tiles in dashboards.
 * Pass {@code emphasis="hero"} for the headline metric on a page.</p>
 */
export function Stat({
  label,
  value,
  hint,
  tone = "neutral",
  emphasis = "default",
  icon,
  onClick,
  active,
  className = "",
}: StatProps) {
  const isHero = emphasis === "hero";
  const baseSurface = isHero
    ? "bg-[var(--color-saffron)]/5"
    : "bg-white";
  const activeRing = active
    ? "ring-2 ring-[var(--color-saffron)] shadow-[var(--shadow-soft)]"
    : "";
  const interactive = onClick
    ? "hover:border-[var(--color-saffron)]/40 hover:shadow-[var(--shadow-soft)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-saffron)] focus-visible:ring-offset-2"
    : "";
  const contents = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
          {label}
        </p>
        {icon ? (
          <span className="text-[var(--color-muted)] shrink-0">{icon}</span>
        ) : null}
      </div>
      <p
        className={`mt-1.5 ${isHero ? "text-3xl md:text-4xl" : "text-xl md:text-2xl"} font-semibold tabular-nums leading-tight ${VALUE_COLOR[tone]}`}
      >
        {value}
      </p>
      {hint ? (
        <p className="text-xs text-[var(--color-muted)] mt-1.5 leading-snug">{hint}</p>
      ) : null}
    </>
  );

  const className2 = [
    "relative w-full text-left rounded-xl border border-black/[0.06] border-l-4",
    ACCENT[tone],
    baseSurface,
    "p-4",
    activeRing,
    interactive,
    "transition",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active || undefined}
        className={className2}
      >
        {contents}
      </button>
    );
  }
  return <div className={className2}>{contents}</div>;
}

type StatGroupProps = {
  /** Number of columns at each breakpoint. Defaults to 2 / 3 / 4
   *  (mobile / tablet / desktop) which fits most dashboards. */
  cols?: { base?: 1 | 2; md?: 2 | 3 | 4; lg?: 2 | 3 | 4 | 5 };
  className?: string;
  children: ReactNode;
};

/** Responsive grid wrapper for {@link Stat} tiles. Removes the
 *  per-page {@code grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3}
 *  boilerplate and standardises the gap. */
export function StatGroup({ cols, className = "", children }: StatGroupProps) {
  const base = cols?.base === 1 ? "grid-cols-1" : "grid-cols-2";
  const md =
    cols?.md === 2
      ? "md:grid-cols-2"
      : cols?.md === 4
      ? "md:grid-cols-4"
      : "md:grid-cols-3";
  const lg =
    cols?.lg === 2
      ? "lg:grid-cols-2"
      : cols?.lg === 3
      ? "lg:grid-cols-3"
      : cols?.lg === 5
      ? "lg:grid-cols-5"
      : "lg:grid-cols-4";
  return (
    <div className={`grid gap-3 ${base} ${md} ${lg} ${className}`}>{children}</div>
  );
}
