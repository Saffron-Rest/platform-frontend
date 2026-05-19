import type { EntryFormData, TreasurySettings } from "../types";

const PLATFORM_ROWS: {
  key: keyof TreasurySettings["platformSettlementRates"];
  salesKey: keyof EntryFormData;
  settledKey: keyof EntryFormData;
  label: string;
}[] = [
  { key: "wolt", salesKey: "woltSales", settledKey: "woltSettledToCard", label: "Wolt" },
  { key: "bolt", salesKey: "boltSales", settledKey: "boltSettledToCard", label: "Bolt Food" },
  { key: "uberEats", salesKey: "uberEatsSales", settledKey: "uberEatsSettledToCard", label: "Uber Eats" },
  { key: "glovo", salesKey: "glovoSales", settledKey: "glovoSettledToCard", label: "Glovo" },
  { key: "other", salesKey: "otherPlatformSales", settledKey: "otherSettledToCard", label: "Other" },
];

export { PLATFORM_ROWS };

export function suggestedPlatformToCard(sales: number, rate: number) {
  return Math.round(sales * rate * 100) / 100;
}

export function platformSettledToCard(
  data: EntryFormData,
  platformKey: string,
  salesKey: keyof EntryFormData,
  settledKey: keyof EntryFormData,
  rates: Record<string, number>
): number {
  const manual = data[settledKey];
  if (manual != null && typeof manual === "number") return manual;
  const sales = data[salesKey];
  if (typeof sales !== "number") return 0;
  return suggestedPlatformToCard(sales, rates[platformKey] ?? 0.5);
}

export function totalDeliverySettledToCard(
  data: EntryFormData,
  rates: Record<string, number>
): number {
  return PLATFORM_ROWS.reduce(
    (sum, row) => sum + platformSettledToCard(data, row.key, row.salesKey, row.settledKey, rates),
    0
  );
}

export function treasuryCardNet(
  data: EntryFormData,
  cardExpenses: number,
  settings: Pick<TreasurySettings, "cardSalesSettlementRate" | "platformSettlementRates">
): number {
  const cardIn = data.cardSales * (settings.cardSalesSettlementRate ?? 1);
  const deliveryIn = totalDeliverySettledToCard(data, settings.platformSettlementRates);
  return cardIn + deliveryIn - data.cardRefunds - cardExpenses;
}
