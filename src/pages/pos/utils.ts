import type { CartLine } from "./types";

export function nipValid(nip: string) {
  const d = nip.replace(/\D/g, "");
  if (d.length !== 10) return false;
  return [6, 5, 7, 2, 3, 4, 5, 6, 7].reduce((s, v, i) => s + v * Number(d[i]), 0) % 11 === Number(d[9]);
}

export function cartTotals(cart: CartLine[], tip = 0) {
  const subtotal = cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const vat = cart.reduce((s, l) => {
    const g = l.unitPrice * l.quantity;
    return s + g - g / (1 + l.vatRatePct / 100);
  }, 0);
  const count = cart.reduce((s, l) => s + l.quantity, 0);
  return { subtotal, vat, tip, total: subtotal + tip, count };
}

export function orderLabel(draft: { table: { name: string } | null; orderType: string }) {
  if (draft.table) return draft.table.name;
  if (draft.orderType === "DELIVERY") return "Delivery";
  if (draft.orderType === "TAKEAWAY") return "Takeaway";
  return "Quick sale";
}
