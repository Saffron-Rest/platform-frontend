import { api } from "./client";

export type PayoutRequestStatus = "PENDING" | "APPROVED" | "DECLINED";

export type PayoutRequest = {
  id: string;
  userId: string;
  userName?: string;
  requestedAmount: number;
  requestedDate: string;
  status: PayoutRequestStatus;
  notes?: string;
  adminNotes?: string;
  reviewedAt?: string;
  salaryPaymentId?: string;
  createdAt: string;
};

export type MyEarnings = {
  from: string;
  to: string;
  name: string;
  payType: string;
  payAmount: number;
  totalHours: number;
  totalPay: number;
  earnedToDate: number;
  paidAmount: number;
  remainingPay: number;
  owedNow: number;
  fullyPaid: boolean;
  shifts: {
    date: string;
    hours: number;
    hoursLabel: string;
    pay: number;
    payNote: string;
    payType: string;
    tillCloseAssumed: boolean;
  }[];
  payments: {
    id: string;
    amount: number;
    paidDate: string;
    source: string;
    notes?: string;
  }[];
  requests: PayoutRequest[];
};

export async function getMyEarnings(from: string, to: string): Promise<MyEarnings> {
  return api<MyEarnings>(`/earnings/me?from=${from}&to=${to}`);
}

export async function createPayoutRequest(amount: number, notes?: string): Promise<PayoutRequest> {
  return api<PayoutRequest>("/earnings/me/requests", {
    method: "POST",
    body: JSON.stringify({ amount, notes: notes ?? null }),
  });
}

export async function listPayoutRequests(status?: string): Promise<PayoutRequest[]> {
  const qs = status ? `?status=${status}` : "";
  return api<PayoutRequest[]>(`/earnings/requests${qs}`);
}

export async function approvePayoutRequest(
  id: string,
  source: "CASH" | "CARD",
  adminNotes?: string,
): Promise<{ request: PayoutRequest; payment: unknown }> {
  return api(`/earnings/requests/${id}/approve`, {
    method: "POST",
    body: JSON.stringify({ source, adminNotes: adminNotes ?? null }),
  });
}

export async function declinePayoutRequest(
  id: string,
  adminNotes?: string,
): Promise<PayoutRequest> {
  return api<PayoutRequest>(`/earnings/requests/${id}/decline`, {
    method: "POST",
    body: JSON.stringify({ adminNotes: adminNotes ?? null }),
  });
}

export async function setEarningsAccess(userId: string, enabled: boolean): Promise<void> {
  await api(`/earnings/access/${userId}`, {
    method: "POST",
    body: JSON.stringify({ enabled }),
  });
}
