import { api } from "./client";

export type AccountingHub = {
  overduePayables: { count: number; totalOutstanding: number };
  dueSoonPayables: { count: number; totalOutstanding: number; withinDays: number };
  oldDraftEntries: { count: number };
  pendingOwnerExpenses: { count: number; totalOutstanding: number };
  unmatchedPosItems: { count: number };
  stockAlerts: { outOfStock: number; lowStock: number };
  thisMonth?: {
    period: string;
    grossRevenue: number;
    netRevenue: number;
    grossProfit: number;
    operatingProfit: number;
    netProfit: number;
    grossMarginPct: number;
    netMarginPct: number;
  };
};

export async function getAccountingHub(): Promise<AccountingHub> {
  return api<AccountingHub>("/accounting/hub");
}
