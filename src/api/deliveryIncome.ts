import { api } from "./client";
import { num } from "../lib/numbers";
import type { ManualDeliveryIncome } from "../types";
import { mapTags } from "./expenses";

function mapRow(raw: Record<string, unknown>): ManualDeliveryIncome {
  return {
    id: String(raw.id),
    effectiveDate: String(raw.effectiveDate),
    platform: String(raw.platform),
    platformLabel: String(raw.platformLabel ?? raw.platform),
    grossAmount: num(raw.grossAmount),
    settledToCard: num(raw.settledToCard),
    settledOverridden: Boolean(raw.settledOverridden),
    notes: raw.notes != null ? String(raw.notes) : undefined,
    createdAt: raw.createdAt != null ? String(raw.createdAt) : undefined,
    tags: mapTags(raw.tags),
    commentCount: typeof raw.commentCount === "number" ? raw.commentCount : 0,
  };
}

export type ManualDeliveryPayload = {
  effectiveDate: string;
  platform: string;
  grossAmount: number;
  settledToCard?: number | null;
  notes?: string;
};

export async function listDeliveryIncome(from: string, to: string, tagIds?: string[]) {
  const params = new URLSearchParams({ from, to });
  for (const id of tagIds ?? []) params.append("tagId", id);
  const raw = await api<Record<string, unknown>[]>(`/delivery-income?${params}`);
  return raw.map(mapRow);
}

export async function createDeliveryIncome(payload: ManualDeliveryPayload) {
  const raw = await api<Record<string, unknown>>("/delivery-income", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return mapRow(raw);
}

export async function updateDeliveryIncome(id: string, payload: ManualDeliveryPayload) {
  const raw = await api<Record<string, unknown>>(`/delivery-income/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return mapRow(raw);
}

export async function deleteDeliveryIncome(id: string) {
  await api(`/delivery-income/${id}`, { method: "DELETE" });
}
