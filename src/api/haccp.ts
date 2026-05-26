import { api } from "./client";

export type HaccpKind =
  | "FRIDGE_TEMP"
  | "FREEZER_TEMP"
  | "COOK_TEMP"
  | "CLEANING"
  | "DELIVERY"
  | "PEST_CONTROL"
  | "OTHER";

export type HaccpStatus = "OK" | "ATTENTION" | "CORRECTIVE_ACTION";

export type HaccpLog = {
  id: string;
  kind: HaccpKind;
  recordedOn: string;
  recordedAt: string;
  recordedById: string;
  recordedByName: string | null;
  location: string | null;
  temperatureC: number | null;
  status: HaccpStatus;
  notes: string | null;
  photoPath: string | null;
  data: unknown;
  createdAt: string;
};

export type HaccpPayload = {
  kind: HaccpKind;
  recordedOn?: string;
  location?: string | null;
  temperatureC?: number | null;
  status?: HaccpStatus;
  notes?: string | null;
  photoPath?: string | null;
  data?: unknown;
};

export const KIND_LABEL: Record<HaccpKind, string> = {
  FRIDGE_TEMP: "Fridge temp",
  FREEZER_TEMP: "Freezer temp",
  COOK_TEMP: "Cook temp",
  CLEANING: "Cleaning",
  DELIVERY: "Delivery",
  PEST_CONTROL: "Pest control",
  OTHER: "Other",
};

export async function listHaccp(from?: string, to?: string, kind?: HaccpKind) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (kind) params.set("kind", kind);
  const qs = params.toString();
  return api<HaccpLog[]>(`/haccp${qs ? `?${qs}` : ""}`);
}

export async function createHaccp(payload: HaccpPayload) {
  return api<HaccpLog>(`/haccp`, { method: "POST", body: JSON.stringify(payload) });
}

export async function updateHaccp(id: string, payload: Partial<HaccpPayload>) {
  return api<HaccpLog>(`/haccp/${id}`, { method: "PUT", body: JSON.stringify(payload) });
}

export async function deleteHaccp(id: string) {
  return api<{ deleted: string }>(`/haccp/${id}`, { method: "DELETE" });
}

export async function uploadHaccpPhoto(file: File) {
  const form = new FormData();
  form.append("file", file);
  return api<{ path: string }>(`/haccp/upload`, { method: "POST", body: form });
}

/** Returns a Blob you can save / open. The auth header is automatically
 *  attached by the api() client so we route through it. */
export async function exportHaccpPdf(from: string, to: string): Promise<Blob> {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const API_BASE =
    (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "/api";
  const r = await fetch(`${API_BASE}/haccp/export.pdf?from=${from}&to=${to}`, { headers });
  if (!r.ok) throw new Error(`Export failed (${r.status})`);
  return r.blob();
}
