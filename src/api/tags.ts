import { api } from "./client";

/** Server payload for a tag. `usageCount` is only present in the
 *  /api/tags list — embedded tag references on records skip it. */
export type Tag = {
  id: string;
  name: string;
  color?: string | null;
  description?: string | null;
  usageCount?: number;
  createdAt?: string | null;
};

export type TaggedEntityType =
  | "ENTRY"
  | "EXPENSE"
  | "SALARY_PAYMENT"
  | "MANUAL_DELIVERY"
  | "BANK_DEPOSIT"
  | "CARD_SETTLEMENT";

export type TagPayload = {
  name?: string;
  color?: string | null;
  description?: string | null;
};

export async function listTags() {
  return api<Tag[]>("/tags");
}

export async function createTag(payload: TagPayload) {
  return api<Tag>("/tags", { method: "POST", body: JSON.stringify(payload) });
}

export async function updateTag(id: string, payload: TagPayload) {
  return api<Tag>(`/tags/${id}`, { method: "PUT", body: JSON.stringify(payload) });
}

export async function deleteTag(id: string) {
  await api(`/tags/${id}`, { method: "DELETE" });
}

export async function assignTag(
  tagId: string,
  entityType: TaggedEntityType,
  entityId: string
) {
  await api(`/tags/${tagId}/assign`, {
    method: "POST",
    body: JSON.stringify({ entityType, entityId }),
  });
}

export async function unassignTag(
  tagId: string,
  entityType: TaggedEntityType,
  entityId: string
) {
  await api(`/tags/${tagId}/unassign`, {
    method: "POST",
    body: JSON.stringify({ entityType, entityId }),
  });
}

export async function bulkAssignTag(
  tagId: string,
  entityType: TaggedEntityType,
  entityIds: string[]
) {
  await api(`/tags/${tagId}/bulk-assign`, {
    method: "POST",
    body: JSON.stringify({ entityType, entityIds }),
  });
}

/** Replace the full tag set on a record in one call — used by the picker
 *  when the user opens it, edits multiple checkboxes, and applies. */
export async function setTagsForEntity(
  entityType: TaggedEntityType,
  entityId: string,
  tagIds: string[]
) {
  await api(`/tags/assignments`, {
    method: "PUT",
    body: JSON.stringify({ entityType, entityId, tagIds }),
  });
}
