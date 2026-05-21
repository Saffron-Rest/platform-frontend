import { api } from "./client";
import type { EntryFile } from "../types";

function mapFile(raw: Record<string, unknown>): EntryFile {
  return {
    id: String(raw.id),
    filename: String(raw.filename),
    category: raw.category != null ? String(raw.category) : undefined,
    entryId: raw.entryId != null ? String(raw.entryId) : undefined,
    createdAt: raw.createdAt != null ? String(raw.createdAt) : undefined,
  };
}

/** Upload a file directly to a shift entry, tagging it with a category (e.g. "pos-report"). */
export async function uploadEntryFile(
  entryId: string,
  file: File,
  category?: string
): Promise<EntryFile> {
  const fd = new FormData();
  fd.append("file", file);
  const query = category ? `?category=${encodeURIComponent(category)}` : "";
  const raw = await api<Record<string, unknown>>(`/files/${entryId}${query}`, {
    method: "POST",
    body: fd,
  });
  return mapFile(raw);
}

/** Delete an entry-attached file. Same auth as upload (not allowed when entry is locked, unless ops). */
export async function deleteEntryFile(fileId: string): Promise<void> {
  await api(`/files/${fileId}`, { method: "DELETE" });
}
