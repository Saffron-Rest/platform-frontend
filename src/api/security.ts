import { api } from "./client";

export type TotpStatus = {
  enabled: boolean;
  hasPendingEnrollment: boolean;
  enabledAt: string | null;
  lastUsedAt: string | null;
};

export type EnrollmentResponse = {
  secret: string;
  otpauthUri: string;
  issuer: string;
  account: string;
};

export async function getTotpStatus() {
  return api<TotpStatus>(`/security/totp`);
}

export async function beginTotpEnrollment() {
  return api<EnrollmentResponse>(`/security/totp/enroll`, { method: "POST" });
}

export async function confirmTotpEnrollment(code: string) {
  return api<TotpStatus>(`/security/totp/confirm`, {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export async function selfDisableTotp(code: string) {
  return api<TotpStatus>(`/security/totp/disable`, {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export async function adminDisableTotp(userId: string) {
  return api<TotpStatus>(`/security/totp/${userId}`, { method: "DELETE" });
}

export async function getTotpStatusFor(userId: string) {
  return api<TotpStatus>(`/security/totp/${userId}`);
}
