import type { PosMenuItem, PosOrder, PosTable } from "../../api/pos";

export type PosScreen = "hub" | "tables" | "delivery" | "order" | "checkout" | "open-orders";

export type OrderType = "DINE_IN" | "TAKEAWAY" | "DELIVERY";

export type CartLine = {
  menuItemId: string;
  itemName: string;
  unitPrice: number;
  vatRatePct: number;
  quantity: number;
};

export type OrderDraft = {
  table: PosTable | null;
  orderType: OrderType;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  specialRequests: string;
  covers: string;
  orderNote: string;
  cart: CartLine[];
  activeOrder: PosOrder | null;
};

export const emptyDraft = (): OrderDraft => ({
  table: null,
  orderType: "DINE_IN",
  customerName: "",
  customerPhone: "",
  deliveryAddress: "",
  specialRequests: "",
  covers: "",
  orderNote: "",
  cart: [],
  activeOrder: null,
});

export type MenuGrouped = { id: string; name: string; items: PosMenuItem[] }[];
