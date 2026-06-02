import type { ReactNode } from "react";
import { num } from "../../lib/numbers";

/**
 * Locale + currency for the platform. Centralized here so a future
 * "switch to EUR" rollout (or an admin-set restaurant locale) only
 * touches this file and {@code lib/calc.ts#fmt}. Mirror those constants
 * if either ever diverges.
 */
const LOCALE = "pl-PL";
const CURRENCY = "PLN";

const moneyFormatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY,
  minimumFractionDigits: 2,
});

const compactFormatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY,
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
  notation: "compact",
});

const noCurrencyFormatter = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type MoneyProps = {
  value: number | string | null | undefined;
  /** When {@code true}, drops the currency symbol — useful in dense
   *  tables that have a column header like "Amount (PLN)". */
  noCurrency?: boolean;
  /** Compact notation, e.g. "1.2k zł" — for KPI tiles where space is
   *  tight. Always emits the currency symbol. */
  compact?: boolean;
  /** Visual emphasis. Defaults to {@code default}; pass {@code muted}
   *  to render in muted ink and {@code strong} for bold values. */
  emphasis?: "default" | "muted" | "strong";
  className?: string;
};

/**
 * Renders a monetary amount with consistent locale formatting,
 * {@code tabular-nums}, and a sensible default emphasis. Always use
 * this primitive for displayed money so columns line up vertically and
 * a future locale change is a single-file edit.
 *
 * <p>For form input, keep using {@code AmountField} / {@code MoneyInput}
 * — those parse user-typed money. {@link Money} is display-only.</p>
 */
export function Money({
  value,
  noCurrency,
  compact,
  emphasis = "default",
  className = "",
}: MoneyProps) {
  const n = num(value);
  const formatted = compact
    ? compactFormatter.format(n)
    : noCurrency
    ? noCurrencyFormatter.format(n)
    : moneyFormatter.format(n);
  const emphasisClass =
    emphasis === "muted"
      ? "text-[var(--color-muted)]"
      : emphasis === "strong"
      ? "font-semibold text-[var(--color-ink)]"
      : "text-[var(--color-ink)]";
  return (
    <span className={`tabular-nums whitespace-nowrap ${emphasisClass} ${className}`}>
      {formatted}
    </span>
  );
}

type MoneyDeltaProps = {
  value: number | string | null | undefined;
  /** Always render an explicit "+" on positive values. Default {@code true}. */
  showSign?: boolean;
  /** Inverse-colour mode: positive renders red, negative renders green.
   *  Useful for "Outstanding" columns where positive numbers are bad. */
  invert?: boolean;
  /** Render with the currency symbol. Default {@code true}. */
  withCurrency?: boolean;
  className?: string;
  /** Optional prefix slot — useful for arrows or icons. */
  icon?: ReactNode;
};

/**
 * Money value with sign-aware colouring. Replaces inline patterns like
 * {@code <span className={n>=0 ? "text-emerald-700" : "text-rose-700"}>}
 * scattered across {@code TreasuryHistory}, {@code Dashboard}, and
 * {@code FinanceLedger}.
 */
export function MoneyDelta({
  value,
  showSign = true,
  invert = false,
  withCurrency = true,
  icon,
  className = "",
}: MoneyDeltaProps) {
  const n = num(value);
  const positive = n > 0;
  const negative = n < 0;
  const sign = positive ? "+" : negative ? "−" : "";
  const abs = Math.abs(n);
  const formatted = withCurrency
    ? moneyFormatter.format(abs)
    : noCurrencyFormatter.format(abs);
  const goodColor = "text-emerald-700";
  const badColor = "text-[var(--color-danger)]";
  const colour = positive
    ? invert
      ? badColor
      : goodColor
    : negative
    ? invert
      ? goodColor
      : badColor
    : "text-[var(--color-muted)]";
  return (
    <span className={`inline-flex items-center gap-1 tabular-nums whitespace-nowrap font-semibold ${colour} ${className}`}>
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      <span>
        {showSign && sign}
        {formatted}
      </span>
    </span>
  );
}
