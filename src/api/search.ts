import { api } from "./client";

export type SearchHitType =
  | "entry"
  | "expense"
  | "payout"
  | "delivery"
  | "user"
  | "tag"
  | "comment"
  | "audit";

export type SearchHit = {
  type: SearchHitType;
  id: string;
  title: string;
  subtitle?: string;
  url: string;
  score: number;
  when?: string | null;
  color?: string | null;
};

export type SearchResponse = {
  query: string;
  total: number;
  groups: Partial<Record<string, SearchHit[]>>;
};

export async function search(query: string, types?: SearchHitType[]) {
  if (!query.trim()) return { query, total: 0, groups: {} } satisfies SearchResponse;
  const params = new URLSearchParams({ q: query });
  for (const t of types ?? []) params.append("type", t);
  return api<SearchResponse>(`/search?${params}`);
}
