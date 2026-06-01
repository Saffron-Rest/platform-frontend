import { api, downloadUrl } from "./client";
import type { PaymentMethod, PayableCategory } from "./payables";

export type OwnerExpenseStatus = "PENDING" | "PARTIAL" | "REIMBURSED" | "VOID";

export type OwnerExpenseSummary = {
  id: string;
  ownerUserId: string;
  ownerName: string;
  expenseDate: string;
  category: PayableCategory;
  description: string;
  total: number;
  amountReimbursed: number;
  outstanding: number;
  status: OwnerExpenseStatus;
  reference?: string;
  receiptCount: number;
};

export type OwnerExpenseReimbursement = {
  id: string;
  paidDate: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
  createdAt?: string | null;
};

export type OwnerExpenseReceipt = {
  id: string;
  filename: string;
  createdAt?: string | null;
};

export type OwnerExpenseDetail = OwnerExpenseSummary & {
  notes?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  reimbursements: OwnerExpenseReimbursement[];
  receipts: OwnerExpenseReceipt[];
};

export type OwnerExpenseListResponse = {
  items: OwnerExpenseSummary[];
  totals: { count: number; outstanding: number };
  byOwner: Array<{ ownerUserId: string; ownerName: string; outstanding: number }>;
};

export type FileOwnerExpenseInput = {
  ownerUserId?: string | null;
  expenseDate: string;
  category: PayableCategory;
  description: string;
  total: number;
  reference?: string | null;
  notes?: string | null;
};

export type RecordReimbursementInput = {
  paidDate: string;
  amount: number;
  method?: PaymentMethod;
  reference?: string | null;
  notes?: string | null;
};

export async function listOwnerExpenses(
  status: "PENDING" | "REIMBURSED" | "VOID" | "ALL" = "PENDING",
  ownerId?: string,
): Promise<OwnerExpenseListResponse> {
  const params = new URLSearchParams({ status });
  if (ownerId) params.set("ownerId", ownerId);
  return api<OwnerExpenseListResponse>(`/owner-expenses?${params.toString()}`);
}

export async function getOwnerExpense(id: string): Promise<OwnerExpenseDetail> {
  return api<OwnerExpenseDetail>(`/owner-expenses/${encodeURIComponent(id)}`);
}

export async function fileOwnerExpense(input: FileOwnerExpenseInput): Promise<OwnerExpenseDetail> {
  return api<OwnerExpenseDetail>("/owner-expenses", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateOwnerExpense(
  id: string,
  body: Partial<{
    expenseDate: string;
    category: PayableCategory;
    description: string;
    total: number;
    reference: string | null;
    notes: string | null;
  }>,
): Promise<OwnerExpenseDetail> {
  return api<OwnerExpenseDetail>(`/owner-expenses/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function voidOwnerExpense(id: string, reason?: string): Promise<OwnerExpenseDetail> {
  return api<OwnerExpenseDetail>(`/owner-expenses/${encodeURIComponent(id)}/void`, {
    method: "POST",
    body: JSON.stringify({ reason: reason ?? "" }),
  });
}

export async function recordOwnerReimbursement(
  id: string,
  input: RecordReimbursementInput,
): Promise<OwnerExpenseDetail> {
  return api<OwnerExpenseDetail>(`/owner-expenses/${encodeURIComponent(id)}/reimbursements`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateOwnerReimbursement(
  id: string,
  reimbursementId: string,
  patch: Partial<RecordReimbursementInput>,
): Promise<OwnerExpenseDetail> {
  return api<OwnerExpenseDetail>(
    `/owner-expenses/${encodeURIComponent(id)}/reimbursements/${encodeURIComponent(reimbursementId)}`,
    {
      method: "PUT",
      body: JSON.stringify(patch),
    },
  );
}

export async function deleteOwnerReimbursement(
  id: string,
  reimbursementId: string,
): Promise<OwnerExpenseDetail> {
  return api<OwnerExpenseDetail>(
    `/owner-expenses/${encodeURIComponent(id)}/reimbursements/${encodeURIComponent(reimbursementId)}`,
    { method: "DELETE" },
  );
}

/**
 * Attach a receipt photo / PDF to an owner expense.
 *
 * <p>Same backend storage as the existing receipt-file infrastructure
 * (entry receipts, expense invoices) so file links and downloads share
 * a single auth-enforced endpoint.</p>
 */
export async function uploadOwnerExpenseReceipt(
  id: string,
  file: File,
): Promise<OwnerExpenseDetail> {
  const fd = new FormData();
  fd.append("receipt", file);
  return api<OwnerExpenseDetail>(`/owner-expenses/${encodeURIComponent(id)}/receipts`, {
    method: "POST",
    body: fd,
  });
}

export async function deleteOwnerExpenseReceipt(
  id: string,
  fileId: string,
): Promise<OwnerExpenseDetail> {
  return api<OwnerExpenseDetail>(
    `/owner-expenses/${encodeURIComponent(id)}/receipts/${encodeURIComponent(fileId)}`,
    { method: "DELETE" },
  );
}

export function ownerExpenseReceiptUrl(fileId: string): string {
  return downloadUrl(`/files/download/${encodeURIComponent(fileId)}`);
}
