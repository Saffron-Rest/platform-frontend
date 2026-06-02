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

async function materializeForUpload(file: File): Promise<File> {
  try {
    const buf = await file.arrayBuffer();
    return new File([buf], file.name, {
      type: file.type || "application/octet-stream",
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}

/** Upload a file directly to a shift entry, tagging it with a category (e.g. "pos-report"). */
export async function uploadEntryFile(
  entryId: string,
  file: File,
  category?: string
): Promise<EntryFile> {
  const payload = await materializeForUpload(file);
  const fd = new FormData();
  fd.append("file", payload);
  const query = category ? `?category=${encodeURIComponent(category)}` : "";
  try {
    const raw = await api<Record<string, unknown>>(`/files/${entryId}${query}`, {
      method: "POST",
      body: fd,
    });
    return mapFile(raw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/ERR_UPLOAD_FILE_CHANGED|file.*chang|NotReadableError/i.test(msg)) {
      throw new Error(
        `Could not upload "${file.name}" — the file changed or was moved. Please pick it again.`
      );
    }
    throw e;
  }
}

/** Delete an entry-attached file. Same auth as upload (not allowed when entry is locked, unless ops). */
export async function deleteEntryFile(fileId: string): Promise<void> {
  await api(`/files/${fileId}`, { method: "DELETE" });
}
