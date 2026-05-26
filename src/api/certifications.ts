import { api } from "./client";

export type CertStatus = "OK" | "SOON" | "URGENT" | "EXPIRED" | "NO_EXPIRY";

export type EmployeeCert = {
  id: string;
  userId: string;
  userName: string | null;
  type: string;
  number: string | null;
  issuer: string | null;
  issuedOn: string | null;
  expiresOn: string | null;
  notes: string | null;
  filePath: string | null;
  status: CertStatus;
  daysUntilExpiry: number | null;
  createdAt: string;
  updatedAt: string;
};

export type CertPayload = {
  userId: string;
  type: string;
  number?: string | null;
  issuer?: string | null;
  issuedOn?: string | null;
  expiresOn?: string | null;
  notes?: string | null;
  filePath?: string | null;
};

export async function listCerts(userId?: string) {
  const qs = userId ? `?userId=${encodeURIComponent(userId)}` : "";
  return api<EmployeeCert[]>(`/certifications${qs}`);
}

export async function listCertTypes() {
  return api<string[]>(`/certifications/types`);
}

export async function createCert(payload: CertPayload) {
  return api<EmployeeCert>(`/certifications`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCert(id: string, payload: Partial<CertPayload>) {
  return api<EmployeeCert>(`/certifications/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteCert(id: string) {
  return api<{ deleted: string }>(`/certifications/${id}`, { method: "DELETE" });
}

export async function uploadCertFile(file: File) {
  const form = new FormData();
  form.append("file", file);
  return api<{ path: string }>(`/certifications/upload`, { method: "POST", body: form });
}
