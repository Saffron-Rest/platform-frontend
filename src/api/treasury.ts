import { api } from "./client";

export type TreasuryLedgerSource = "CASH" | "CARD";

export type TreasuryLedgerCategory =
  | "INCOME"
  | "SHIFT_EXPENSE"
  | "STANDALONE_EXPENSE"
  | "SALARY"
  | "TRANSFER";

export type TreasuryLedgerKind =
  // Shift report rows
  | "SHIFT_CASH_SALES"
  | "SHIFT_CASH_REFUND"
  | "SHIFT_CARD_SALES_SETTLED"
  | "SHIFT_CARD_REFUND"
  | "SHIFT_PLATFORM_REFUND"
  | "SHIFT_DELIVERY_SETTLED"
  | "SHIFT_BANK_DEPOSIT"
  | "SHIFT_CASH_WITHDRAWAL"
  | "SHIFT_OWNER_WITHDRAWAL"
  | "SHIFT_EXPENSE"
  // Non-shift rows
  | "MANUAL_DELIVERY"
  | "STANDALONE_EXPENSE"
  | "SALARY_PAYOUT";

export type TreasuryLedgerRow = {
  date: string;
  kind: TreasuryLedgerKind;
  category: TreasuryLedgerCategory;
  label: string;
  amount: number;
  sign: "+" | "-";
  runningBalance: number;
  refRoute?: string;
  refLabel?: string;
  refId?: string;
  expenseCategory?: string;
  platform?: string;
  notes?: string;
};

export type TreasuryLedger = {
  source: TreasuryLedgerSource;
  from: string;
  to: string;
  openingBalance: number;
  closingBalance: number;
  currency: string;
  rows: TreasuryLedgerRow[];
};

export function getTreasuryLedger(params: {
  source: TreasuryLedgerSource;
  from: string;
  to: string;
}): Promise<TreasuryLedger> {
  const q = new URLSearchParams({
    source: params.source,
    from: params.from,
    to: params.to,
  });
  return api<TreasuryLedger>(`/treasury/ledger?${q.toString()}`);
}
