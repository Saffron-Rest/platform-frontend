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
  | "CARD_SETTLEMENT"
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
  /** Standalone CARD_SETTLEMENT row metadata. */
  grossAmount?: number;
  settledAmount?: number;
  /** True when the row is waiting on the bank to actually credit it (delivery before
   *  reconciliation). Pending rows are shown but don't move the running balance. */
  pending?: boolean;
  /** Linked-settlement overrides applied on top of an existing card-income row. */
  settledOverride?: boolean;
  /** Amount the row would have had without the override (snapshot). */
  originalAmount?: number;
  /** Optional gross-sold figure recorded with the settlement (e.g. 2000 PLN). */
  settledGross?: number;
  /** ID of the persisted CardSettlement override (for delete). */
  settlementId?: string;
  /** Free-form note saved with the override. */
  settledNotes?: string;
  /** Bank deposit metadata when this row is part of a multi-day batch reconciliation. */
  bankDepositId?: string;
  bankDepositDate?: string;
  bankDepositSettled?: number;
  bankDepositGross?: number;
  bankDepositVariance?: number;
  bankDepositLinkCount?: number;
  bankDepositNotes?: string;
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
