import { api } from "./client";
import type { TaggedEntityType } from "./tags";

export type Comment = {
  id: string;
  entityType: TaggedEntityType;
  entityId: string;
  body: string;
  authorId: string;
  authorName: string;
  authorEmail?: string | null;
  createdAt: string;
  editedAt?: string | null;
  canEdit: boolean;
};

function mapComment(raw: Record<string, unknown>): Comment {
  return {
    id: String(raw.id),
    entityType: raw.entityType as TaggedEntityType,
    entityId: String(raw.entityId),
    body: String(raw.body),
    authorId: String(raw.authorId),
    authorName: String(raw.authorName ?? "Unknown"),
    authorEmail: raw.authorEmail != null ? String(raw.authorEmail) : null,
    createdAt: String(raw.createdAt),
    editedAt: raw.editedAt != null ? String(raw.editedAt) : null,
    canEdit: Boolean(raw.canEdit),
  };
}

export async function listComments(entityType: TaggedEntityType, entityId: string) {
  const params = new URLSearchParams({ entityType, entityId });
  const raw = await api<Record<string, unknown>[]>(`/comments?${params}`);
  return raw.map(mapComment);
}

export async function createComment(
  entityType: TaggedEntityType,
  entityId: string,
  body: string
) {
  const raw = await api<Record<string, unknown>>("/comments", {
    method: "POST",
    body: JSON.stringify({ entityType, entityId, body }),
  });
  return mapComment(raw);
}

export async function updateComment(id: string, body: string) {
  const raw = await api<Record<string, unknown>>(`/comments/${id}`, {
    method: "PUT",
    body: JSON.stringify({ body }),
  });
  return mapComment(raw);
}

export async function deleteComment(id: string) {
  await api(`/comments/${id}`, { method: "DELETE" });
}
