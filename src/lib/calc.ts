import { num } from "./numbers";
import type { DailyEntry, EntryFormData, ExpenseLine, PaymentSource } from "../types";

export function totalSales(d: EntryFormData) {
  return (
    d.cashSales +
    d.cardSales +
    d.woltSales +
    d.boltSales +
    d.uberEatsSales +
    d.glovoSales +
    d.otherPlatformSales
  );
}

export function totalSalesFromEntry(e: DailyEntry) {
  return (
    e.cashSales +
    e.cardSales +
    e.woltSales +
    e.boltSales +
    e.uberEatsSales +
    e.glovoSales +
    e.otherPlatformSales
  );
}

export function totalReturns(d: EntryFormData) {
  return d.cashRefunds + d.cardRefunds + d.platformRefunds;
}

export function totalPayouts(d: EntryFormData) {
  return d.bankDeposit + d.cashWithdrawal + d.ownerWithdrawal;
}

export function totalExpenseLines(expenses: ExpenseLine[]) {
  return expenses.reduce((s, e) => s + (e.amount || 0), 0);
}

export function expenseTotalBySource(expenses: ExpenseLine[], source: PaymentSource) {
  return expenses
    .filter((e) => (e.paymentSource || "CASH") === source)
    .reduce((s, e) => s + (e.amount || 0), 0);
}

export function totalExpenses(d: EntryFormData, expenses: ExpenseLine[]) {
  return totalPayouts(d) + totalExpenseLines(expenses);
}

/** Expected cash in drawer (platform sales excluded). */
export function closingBalance(d: EntryFormData, expenses: ExpenseLine[]) {
  return (
    d.openingBalance +
    d.cashSales -
    d.cashRefunds -
    expenseTotalBySource(expenses, "CASH") -
    totalPayouts(d)
  );
}

/** Card account net: card sales − card refunds − card-paid expenses. */
export function cardBalance(d: EntryFormData, expenses: ExpenseLine[]) {
  return d.cardSales - d.cardRefunds - expenseTotalBySource(expenses, "CARD");
}

export function cashDifference(d: EntryFormData, expenses: ExpenseLine[]) {
  return d.actualCashCounted - closingBalance(d, expenses);
}

export function fmt(n: number) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    minimumFractionDigits: 2,
  }).format(num(n));
}
