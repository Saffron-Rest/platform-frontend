import { api } from "./client";

export type PayableStatus = "UNPAID" | "PARTIAL" | "PAID" | "VOID";

export type PaymentMethod = "CASH" | "CARD" | "BANK_TRANSFER" | "CHEQUE" | "OTHER";

/** Same set used by ExpenseItem on the backend. */
export type PayableCategory =
  | "SUPPLIER"
  | "SUPPLIES"
  | "STAFF_MEALS"
  | "DELIVERY"
  | "PETTY_CASH"
  | "UTILITIES"
  | "CLEANING"
  | "MAINTENANCE"
  | "RENT"
  | "MARKETING"
  | "OTHER";

export type PayableLine = {
  id?: string;
  /** When set, creating the invoice posts a stock PURCHASE for this line. */
  stockItemId?: string | null;
  description: string;
  quantity: number;
  unit: string;
  unitCost: number;
  lineTotal: number;
  vatPct?: number | null;
  vatAmount?: number | null;
  stockMovementId?: string | null;
};

export type PayablePayment = {
  id: string;
  paymentDate: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
  createdAt?: string | null;
};

export type PayableSummary = {
  id: string;
  supplier: { id: string; name: string };
  invoiceNumber?: string;
  invoiceDate: string;
  dueDate: string;
  category: PayableCategory;
  subtotal: number;
  vat: number;
  total: number;
  amountPaid: number;
  outstanding: number;
  status: PayableStatus;
  overdue: boolean;
  daysPastDue?: number;
};

export type PayableDetail = PayableSummary & {
  notes?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  lines: PayableLine[];
  payments: PayablePayment[];
};

export type PayableListResponse = {
  items: PayableSummary[];
  totals: {
    count: number;
    outstanding: number;
    overdueAmount: number;
    overdueCount: number;
  };
};

export type PayableAging = {
  current: number;
  d1to7: number;
  d8to30: number;
  d31to60: number;
  d60plus: number;
  total: number;
};

export type CreatePayableInput = {
  supplierId: string;
  invoiceNumber?: string | null;
  invoiceDate: string;
  dueDate?: string | null;
  category?: PayableCategory;
  subtotal?: number | null;
  vat?: number | null;
  /** Optional override; computed from Σ lines + VAT when omitted. */
  total?: number | null;
  notes?: string | null;
  lines: Array<{
    stockItemId?: string | null;
    description?: string | null;
    quantity: number;
    unit?: string;
    unitCost: number;
    lineTotal?: number;
    vatPct?: number | null;
  }>;
};

export type RecordPaymentInput = {
  paymentDate: string;
  amount: number;
  method?: PaymentMethod;
  reference?: string | null;
  notes?: string | null;
};

export async function listPayables(
  status: "OUTSTANDING" | "PAID" | "VOID" | "ALL" = "OUTSTANDING",
  supplierId?: string,
): Promise<PayableListResponse> {
  const params = new URLSearchParams({ status });
  if (supplierId) params.set("supplierId", supplierId);
  return api<PayableListResponse>(`/payables?${params.toString()}`);
}

export async function getPayable(id: string): Promise<PayableDetail> {
  return api<PayableDetail>(`/payables/${encodeURIComponent(id)}`);
}

export async function getPayableAging(): Promise<PayableAging> {
  return api<PayableAging>("/payables/aging");
}

export async function createPayable(input: CreatePayableInput): Promise<PayableDetail> {
  return api<PayableDetail>("/payables", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updatePayable(
  id: string,
  body: Partial<{
    invoiceNumber: string | null;
    dueDate: string;
    category: PayableCategory;
    total: number;
    vat: number;
    notes: string | null;
  }>,
): Promise<PayableDetail> {
  return api<PayableDetail>(`/payables/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function voidPayable(id: string, reason?: string): Promise<PayableDetail> {
  return api<PayableDetail>(`/payables/${encodeURIComponent(id)}/void`, {
    method: "POST",
    body: JSON.stringify({ reason: reason ?? "" }),
  });
}

export async function recordPayablePayment(
  id: string,
  input: RecordPaymentInput,
): Promise<PayableDetail> {
  return api<PayableDetail>(`/payables/${encodeURIComponent(id)}/payments`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function deletePayablePayment(id: string, paymentId: string): Promise<PayableDetail> {
  return api<PayableDetail>(
    `/payables/${encodeURIComponent(id)}/payments/${encodeURIComponent(paymentId)}`,
    { method: "DELETE" },
  );
}
