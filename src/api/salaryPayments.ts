import { api } from "./client";
import type { PaymentSource, SalaryPaymentRecord, TreasuryOverview } from "../types";

export type UpdateSalaryPaymentInput = {
  amount?: number;
  paidDate?: string;
  source?: PaymentSource;
  periodFrom?: string;
  periodTo?: string;
  notes?: string;
  /** Send true to clear periodFrom/periodTo. */
  clearPeriod?: boolean;
  /** Send true to clear notes. */
  clearNotes?: boolean;
};

export type SalaryPaymentMutationResult = {
  payment?: SalaryPaymentRecord;
  treasury: TreasuryOverview;
  ok?: boolean;
};

export function updateSalaryPayment(
  id: string,
  input: UpdateSalaryPaymentInput
): Promise<SalaryPaymentMutationResult> {
  return api<SalaryPaymentMutationResult>(`/treasury/salary-payments/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteSalaryPayment(id: string): Promise<SalaryPaymentMutationResult> {
  return api<SalaryPaymentMutationResult>(`/treasury/salary-payments/${id}`, {
    method: "DELETE",
  });
}
