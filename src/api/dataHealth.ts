import { api } from "./client";

export type HealthSeverity = "low" | "medium" | "high";

export type HealthItem = {
  id: string;
  severity: HealthSeverity;
  title: string;
  description: string;
  url: string;
  when?: string | null;
};

export type DataHealth = {
  generatedAt: string;
  total: number;
  highSeverity: number;
  groups: Partial<Record<string, HealthItem[]>>;
};

export async function fetchDataHealth() {
  return api<DataHealth>("/admin/data-health");
}
