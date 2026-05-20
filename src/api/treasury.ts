import { api } from "./client";

export type TreasuryLedgerKind =
  | "SHIFT_REPORT"
  | "MANUAL_DELIVERY"
  | "STANDALONE_EXPENSE"
  | "SALARY_PAYOUT";

export type TreasuryLedgerSource = "CASH" | "CARD";

export type TreasuryLedgerRow = {
  date: string;
  kind: TreasuryLedgerKind;
  label: string;
  amount: number;
  sign: "+" | "-";
  runningBalance: number;
  refRoute?: string;
  refLabel?: string;
  refId?: string;
  category?: string;
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
