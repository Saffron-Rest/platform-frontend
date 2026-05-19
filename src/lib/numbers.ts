import type { DailyEntry, EntryFormData } from "../types";

/** Coerce API/form values to a finite number; null/undefined/NaN → 0. */
export function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
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
