import { api } from "./client";
import { num } from "../lib/numbers";
import type { CardSettlement } from "../types";

function mapSettlement(raw: Record<string, unknown>): CardSettlement {
  return {
    id: String(raw.id),
    effectiveDate: String(raw.effectiveDate),
    grossAmount: num(raw.grossAmount),
    settledAmount: num(raw.settledAmount),
    delta: num(raw.delta),
    notes: raw.notes != null ? String(raw.notes) : undefined,
    createdAt: raw.createdAt != null ? String(raw.createdAt) : undefined,
  };
}

export type CardSettlementPayload = {
  effectiveDate: string;
  /** Snapshot of the source row's amount at reconciliation, or 0 for standalone. */
  grossAmount: number;
  /** What the bank actually credited. */
  settledAmount: number;
  /** Link to the ledger row this settlement overrides (e.g. SHIFT_CARD_SALES_SETTLED). */
  linkedKind?: string;
  linkedRefId?: string;
  notes?: string;
};

export async function listCardSettlements(from: string, to: string): Promise<CardSettlement[]> {
  const raw = await api<Record<string, unknown>[]>(
    `/card-settlements?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
  );
  return raw.map(mapSettlement);
}

export async function createCardSettlement(payload: CardSettlementPayload): Promise<CardSettlement> {
  const raw = await api<Record<string, unknown>>("/card-settlements", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return mapSettlement(raw);
}

export async function deleteCardSettlement(id: string): Promise<void> {
  await api(`/card-settlements/${id}`, { method: "DELETE" });
}
