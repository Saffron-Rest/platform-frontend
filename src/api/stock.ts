import { api } from "./client";

/**
 * Status badge computed by the backend:
 *   OK       — on-hand above threshold (or threshold disabled)
 *   LOW      — on-hand <= lowStockThreshold
 *   OUT      — on-hand <= 0
 *   ARCHIVED — item.active = false
 */
export type StockStatus = "OK" | "LOW" | "OUT" | "ARCHIVED";

export type StockItem = {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  menuItemId: string | null;
  menuItemName?: string | null;
  category: string | null;
  onHand: number;
  lowStockThreshold: number | null;
  parLevel: number | null;
  unitCost: number | null;
  notes: string | null;
  active: boolean;
  status: StockStatus;
  inventoryValue: number | null;
  lastMovementAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StockMovementType =
  | "SALE"
  | "PURCHASE"
  | "ADJUST"
  | "WASTE"
  | "TRANSFER"
  | "INTERNAL_USE"
  | "OPENING_COUNT"
  | "REVERT";

export type StockMovement = {
  id: string;
  stockItemId: string;
  type: StockMovementType;
  delta: number;
  balanceAfter: number;
  referenceType: string | null;
  referenceId: string | null;
  reason: string | null;
  userId: string | null;
  reverted: boolean;
  revertedAt: string | null;
  createdAt: string;
};

export type StockItemPayload = {
  name: string;
  sku?: string | null;
  unit?: string;
  menuItemId?: string | null;
  category?: string | null;
  onHand?: number;
  lowStockThreshold?: number | null;
  parLevel?: number | null;
  unitCost?: number | null;
  notes?: string | null;
  active?: boolean;
};

export type AdjustPayload = {
  delta: number;
  type?: StockMovementType;
  reason: string;
  referenceType?: string | null;
  referenceId?: string | null;
};

export async function listStock() {
  return api<StockItem[]>(`/stock`);
}

export async function getStock(id: string) {
  return api<StockItem>(`/stock/${id}`);
}

export async function createStock(payload: StockItemPayload) {
  return api<StockItem>(`/stock`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateStock(id: string, payload: StockItemPayload) {
  return api<StockItem>(`/stock/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function archiveStock(id: string) {
  return api<{ archived: string }>(`/stock/${id}`, { method: "DELETE" });
}

/**
 * Permanently remove an archived stock item AND its movement history.
 * Admin-only on the backend. The optional reason is recorded in the
 * audit log so future questions of "where did Y go?" have an answer.
 */
export async function deleteStockPermanently(id: string, reason?: string) {
  return api<{ deleted: string }>(`/stock/${id}/permanent`, {
    method: "DELETE",
    body: JSON.stringify({ reason: reason ?? null }),
  });
}

export async function listMovements(id: string, limit = 100) {
  return api<StockMovement[]>(`/stock/${id}/movements?limit=${limit}`);
}

export async function adjustStock(id: string, payload: AdjustPayload) {
  return api<{ item: StockItem; movement: StockMovement }>(`/stock/${id}/adjust`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function setOnHand(id: string, onHand: number, reason: string) {
  return api<{ item: StockItem; movement: StockMovement }>(`/stock/${id}/set-on-hand`, {
    method: "POST",
    body: JSON.stringify({ onHand, reason }),
  });
}

export async function revertMovement(movementId: string, reason: string) {
  return api<{ item: StockItem; movement: StockMovement }>(
    `/stock/movements/${movementId}/revert`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    }
  );
}

export function movementTypeLabel(t: StockMovementType): string {
  switch (t) {
    case "SALE": return "POS sale";
    case "PURCHASE": return "Purchase";
    case "ADJUST": return "Adjustment";
    case "WASTE": return "Waste";
    case "TRANSFER": return "Transfer";
    case "INTERNAL_USE": return "Internal use";
    case "OPENING_COUNT": return "Opening count";
    case "REVERT": return "Revert";
  }
}
