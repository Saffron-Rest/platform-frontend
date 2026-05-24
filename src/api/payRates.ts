import { api } from "./client";
import type { PayRateHistoryEntry, PayType } from "../types";

export type PayRateInput = {
  payType: PayType;
  payAmount: number;
  effectiveFrom: string;
  notes?: string;
};

export function listPayRates(userId: string): Promise<PayRateHistoryEntry[]> {
  return api<PayRateHistoryEntry[]>(`/users/${userId}/pay-rates`);
}

export function addPayRate(userId: string, input: PayRateInput): Promise<PayRateHistoryEntry[]> {
  return api<PayRateHistoryEntry[]>(`/users/${userId}/pay-rates`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deletePayRate(userId: string, entryId: string): Promise<PayRateHistoryEntry[]> {
  return api<PayRateHistoryEntry[]>(`/users/${userId}/pay-rates/${entryId}`, {
    method: "DELETE",
  });
}
