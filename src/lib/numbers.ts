import type { DailyEntry, EntryFormData } from "../types";

/** Coerce API/form values to a finite number; null/undefined/NaN → 0. */
export function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Accepts user input like `12`, `12.5`, `12,5`, `1.234,56` (PL-style) and partial
 *  strings like `12.`. Returns `null` while the value is incomplete/invalid so the
 *  parent state isn't clobbered mid-typing. Empty string → 0. */
export function parseMoneyInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return 0;
  // Allow at most one decimal separator (period or comma), digits, optional minus.
  if (!/^-?\d*[.,]?\d*$/.test(trimmed)) return null;
  // Strip a trailing separator so "12." is treated as partial (parent keeps last value).
  if (/[.,]$/.test(trimmed)) return null;
  const normalised = trimmed.replace(",", ".");
  if (normalised === "" || normalised === "-" || normalised === ".") return null;
  const n = Number(normalised);
  return Number.isFinite(n) ? n : null;
}

/** Format a number for display in a money input: empty when 0, otherwise keep
 *  trailing decimals if the user typed them. */
export function formatMoneyForInput(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "";
  return String(value);
}

export function entryToFormData(e: DailyEntry): EntryFormData {
  return {
    openingBalance: num(e.openingBalance),
    cashSales: num(e.cashSales),
    cardSales: num(e.cardSales),
    woltSales: num(e.woltSales),
    boltSales: num(e.boltSales),
    uberEatsSales: num(e.uberEatsSales),
    glovoSales: num(e.glovoSales),
    otherPlatformSales: num(e.otherPlatformSales),
    woltSettledToCard: e.woltSettledToCard ?? null,
    boltSettledToCard: e.boltSettledToCard ?? null,
    uberEatsSettledToCard: e.uberEatsSettledToCard ?? null,
    glovoSettledToCard: e.glovoSettledToCard ?? null,
    otherSettledToCard: e.otherSettledToCard ?? null,
    cashRefunds: num(e.cashRefunds),
    cardRefunds: num(e.cardRefunds),
    platformRefunds: num(e.platformRefunds),
    bankDeposit: num(e.bankDeposit),
    cashWithdrawal: num(e.cashWithdrawal),
    ownerWithdrawal: num(e.ownerWithdrawal),
    actualCashCounted: num(e.actualCashCounted),
    notes: e.notes || "",
  };
}
