import { api } from "./client";

/** A calendar day on which the restaurant was deliberately closed. */
export type RestaurantClosure = {
  /** ISO date YYYY-MM-DD. */
  date: string;
  reason: string;
  createdBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export async function listRestaurantClosures(): Promise<RestaurantClosure[]> {
  return api<RestaurantClosure[]>("/restaurant-closures");
}

export async function createRestaurantClosure(
  date: string,
  reason: string,
): Promise<RestaurantClosure> {
  return api<RestaurantClosure>("/restaurant-closures", {
    method: "POST",
    body: JSON.stringify({ date, reason }),
  });
}

export async function updateRestaurantClosure(
  date: string,
  reason: string,
): Promise<RestaurantClosure> {
  return api<RestaurantClosure>(`/restaurant-closures/${encodeURIComponent(date)}`, {
    method: "PUT",
    body: JSON.stringify({ reason }),
  });
}

export async function deleteRestaurantClosure(date: string): Promise<void> {
  await api(`/restaurant-closures/${encodeURIComponent(date)}`, {
    method: "DELETE",
  });
}
