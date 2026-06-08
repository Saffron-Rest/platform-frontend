import { api } from "./client";

export type Supplier = {
  id: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  vatId?: string;
  address?: string;
  paymentTermsDays: number;
  bankAccountNumber?: string;
  bankName?: string;
  bankBicSwift?: string;
  notes?: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type SupplierInput = {
  name: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  vatId?: string | null;
  address?: string | null;
  paymentTermsDays: number;
  bankAccountNumber?: string | null;
  bankName?: string | null;
  bankBicSwift?: string | null;
  notes?: string | null;
  active?: boolean;
};

export async function listSuppliers(includeInactive = false): Promise<Supplier[]> {
  const qs = includeInactive ? "?includeInactive=true" : "";
  return api<Supplier[]>(`/suppliers${qs}`);
}

export async function createSupplier(input: SupplierInput): Promise<Supplier> {
  return api<Supplier>("/suppliers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateSupplier(id: string, input: Partial<SupplierInput>): Promise<Supplier> {
  return api<Supplier>(`/suppliers/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function deactivateSupplier(id: string): Promise<void> {
  await api(`/suppliers/${encodeURIComponent(id)}/deactivate`, { method: "POST" });
}

export async function reactivateSupplier(id: string): Promise<void> {
  await api(`/suppliers/${encodeURIComponent(id)}/reactivate`, { method: "POST" });
}
