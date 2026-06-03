import { api } from "./client";

export type PosMenuItem = {
  id: string;
  categoryId: string;
  name: string;
  sku?: string;
  sellPrice: number;
  vatRatePct: number;
  dietaryTags?: string;
  allergens?: string;
  imagePath?: string;
  posDisplayOrder: number;
};

export type PosTable = {
  id: string;
  name: string;
  area?: string;
  gridX: number;
  gridY: number;
  seats: number;
  occupied: boolean;
  openOrderId?: string;
};

export type PosOrderLine = {
  id: string;
  menuItemId?: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  vatRatePct: number;
  discountAmount: number;
  lineGross?: number;
  vatNetAmount?: number;
  vatAmount?: number;
  note?: string;
};

export type PosOrder = {
  id: string;
  tableId?: string;
  cashierId: string;
  status: "OPEN" | "PAYING" | "PAID" | "VOIDED";
  covers?: number;
  orderNote?: string;
  totalGross: number;
  totalVat: number;
  paymentMethod?: string;
  amountTendered?: number;
  fiscalReceiptNumber?: string;
  buyerNip?: string;
  openedAt: string;
  paidAt?: string;
  lines: PosOrderLine[];
};

export async function getPosMenu(): Promise<PosMenuItem[]> {
  return api<PosMenuItem[]>("/pos/menu");
}

export async function getPosTables(): Promise<PosTable[]> {
  return api<PosTable[]>("/pos/tables");
}

export async function getOpenOrders(): Promise<PosOrder[]> {
  return api<PosOrder[]>("/pos/orders");
}

export async function getOrder(id: string): Promise<PosOrder> {
  return api<PosOrder>(`/pos/orders/${id}`);
}

export async function createOrder(payload: {
  tableId?: string;
  covers?: number;
  orderNote?: string;
  lines?: Array<{
    menuItemId?: string;
    itemName?: string;
    quantity?: number;
    discountAmount?: number;
    note?: string;
  }>;
}): Promise<PosOrder> {
  return api<PosOrder>("/pos/orders", { method: "POST", body: JSON.stringify(payload) });
}

export async function addLine(
  orderId: string,
  line: { menuItemId?: string; itemName?: string; quantity?: number; note?: string }
): Promise<PosOrder> {
  return api<PosOrder>(`/pos/orders/${orderId}/lines`, {
    method: "POST",
    body: JSON.stringify(line),
  });
}

export async function removeLine(orderId: string, lineId: string): Promise<PosOrder> {
  return api<PosOrder>(`/pos/orders/${orderId}/lines/${lineId}`, { method: "DELETE" });
}

export async function payOrder(
  orderId: string,
  payload: { paymentMethod: string; amountTendered?: number; buyerNip?: string; fiscalReceiptNumber?: string }
): Promise<PosOrder> {
  return api<PosOrder>(`/pos/orders/${orderId}/pay`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function voidOrder(orderId: string): Promise<PosOrder> {
  return api<PosOrder>(`/pos/orders/${orderId}/void`, { method: "POST" });
}
