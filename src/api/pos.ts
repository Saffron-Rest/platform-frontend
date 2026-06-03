import { api } from "./client";

export type PosSession = {
  id: string;
  cashierId: string;
  businessDay: string;
  status: "OPEN" | "CLOSED";
  openingFloat: number;
  closingFloat?: number;
  cashSalesTotal?: number;
  cardSalesTotal?: number;
  orderCount?: number;
  openedAt: string;
  closedAt?: string;
};

export type PosMenuItem = {
  id: string;
  categoryId: string;
  categoryName: string;
  categorySortOrder: number;
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

export type CashDrawerTransaction = {
  id: string;
  type: "IN" | "OUT";
  amount: number;
  reason: "BANK_DEPOSIT" | "SUPPLIER_PAYMENT" | "PETTY_CASH" | "CHANGE_FUND" | "OTHER";
  note?: string;
  createdAt: string;
};

export type PosOrder = {
  id: string;
  tableId?: string;
  cashierId: string;
  status: "OPEN" | "PARKED" | "PAYING" | "PAID" | "VOIDED";
  covers?: number;
  orderNote?: string;
  totalGross: number;
  totalVat: number;
  tipAmount: number;
  paymentTotal: number;
  paymentMethod?: string;
  amountTendered?: number;
  fiscalReceiptNumber?: string;
  buyerNip?: string;
  parkedAt?: string;
  parkedNote?: string;
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

export async function parkOrder(orderId: string, note?: string): Promise<PosOrder> {
  return api<PosOrder>(`/pos/orders/${orderId}/park`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

export async function resumeOrder(orderId: string): Promise<PosOrder> {
  return api<PosOrder>(`/pos/orders/${orderId}/resume`, { method: "POST" });
}

export async function searchByBarcode(code: string): Promise<PosMenuItem | null> {
  try {
    return await api<PosMenuItem>(`/pos/menu/barcode/${encodeURIComponent(code)}`);
  } catch {
    return null;
  }
}

// ─── Session ─────────────────────────────────────────────────────────────────

export async function getCurrentSession(): Promise<PosSession | null> {
  return api<PosSession | null>("/pos/session/current").catch(() => null);
}

export async function openSession(openingFloat: number): Promise<PosSession> {
  return api<PosSession>("/pos/session/open", {
    method: "POST",
    body: JSON.stringify({ openingFloat }),
  });
}

export async function closeSession(sessionId: string, closingFloat: number): Promise<PosSession> {
  return api<PosSession>("/pos/session/close", {
    method: "POST",
    body: JSON.stringify({ sessionId, closingFloat }),
  });
}

export async function recordCashMovement(payload: {
  sessionId: string;
  type: "IN" | "OUT";
  reason: string;
  amount: number;
  note?: string;
}): Promise<CashDrawerTransaction> {
  return api<CashDrawerTransaction>("/pos/session/cash", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
