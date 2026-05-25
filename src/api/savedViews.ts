import { api } from "./client";

export type SavedView = {
  id: string;
  page: string;
  name: string;
  /** Raw JSON string the page knows how to deserialize. */
  filters: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SavedViewPayload = {
  page: string;
  name: string;
  /** Object the page provides — we stringify here. */
  filters: unknown;
  isDefault?: boolean;
};

function mapView(raw: Record<string, unknown>): SavedView {
  return {
    id: String(raw.id),
    page: String(raw.page),
    name: String(raw.name),
    filters: String(raw.filters),
    isDefault: Boolean(raw.isDefault),
    createdAt: String(raw.createdAt),
    updatedAt: String(raw.updatedAt),
  };
}

export async function listSavedViews(page: string) {
  const raw = await api<Record<string, unknown>[]>(
    `/saved-views?page=${encodeURIComponent(page)}`
  );
  return raw.map(mapView);
}

export async function createSavedView(payload: SavedViewPayload) {
  const raw = await api<Record<string, unknown>>("/saved-views", {
    method: "POST",
    body: JSON.stringify({
      page: payload.page,
      name: payload.name,
      filters: JSON.stringify(payload.filters),
      isDefault: payload.isDefault,
    }),
  });
  return mapView(raw);
}

export async function updateSavedView(
  id: string,
  payload: { name?: string; filters?: unknown; isDefault?: boolean }
) {
  const raw = await api<Record<string, unknown>>(`/saved-views/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      name: payload.name,
      filters: payload.filters !== undefined ? JSON.stringify(payload.filters) : undefined,
      isDefault: payload.isDefault,
    }),
  });
  return mapView(raw);
}

export async function deleteSavedView(id: string) {
  await api(`/saved-views/${id}`, { method: "DELETE" });
}
