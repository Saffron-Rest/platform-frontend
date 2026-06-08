import { api } from "./client";

export type ForecastDay = {
  date: string;
  dayName: string;
  isToday: boolean;
  sampleSize: number;
  predictedSales?: number;
  low?: number;
  high?: number;
  trend?: "UP" | "DOWN" | "FLAT";
};

export async function getWeekForecast(days = 7): Promise<ForecastDay[]> {
  const res = await api<{ days: ForecastDay[] }>(`/analytics/forecast?days=${days}`);
  return res.days;
}
