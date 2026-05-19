import type { PaymentSource } from "../types";

export const PAYMENT_SOURCES: { value: PaymentSource; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "CARD", label: "Card" },
];

export function parsePaymentSource(raw: unknown): PaymentSource {
  return raw === "CARD" ? "CARD" : "CASH";
}
