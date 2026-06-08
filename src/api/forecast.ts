import { api } from "./client";

export type ForecastDay = {
  date: string;
  dayName: string;
  isToday: boolean;
  sampleSize: number;
  history: number[];
  predictedSales?: number;
  median?: number;
  p25?: number;
  p75?: number;
  low?: number;
  high?: number;
  errorPct?: number;
  trend?: "UP" | "DOWN" | "FLAT";
  confidence?: "HIGH" | "MEDIUM" | "LOW";
  cashPct?: number;
  cardPct?: number;
  deliveryPct?: number;
};

export type WeekSummary = {
  total: number;
  cash: number;
  card: number;
  delivery: number;
  daysWithData: number;
  avgPerDay: number;
};

export type ForecastResponse = {
  days: ForecastDay[];
  weekSummary: WeekSummary;
};

export async function getWeekForecast(days = 7): Promise<ForecastResponse> {
  return api<ForecastResponse>(`/analytics/forecast?days=${days}`);
}
