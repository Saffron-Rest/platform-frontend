import { api } from "./client";
import { num } from "../lib/numbers";
import { parsePaymentSource } from "../lib/paymentSource";
import type { ExpenseInvoice, ExpenseLine } from "../types";
import type { Tag } from "./tags";

function mapInvoice(raw: Record<string, unknown>): ExpenseInvoice {
  return { id: String(raw.id), filename: String(raw.filename) };
}

function mapExpense(raw: Record<string, unknown>): ExpenseLine {
  const list = raw.invoices as Record<string, unknown>[] | undefined;
  const invoices = list?.length
    ? list.map(mapInvoice)
    : raw.invoice
      ? [mapInvoice(raw.invoice as Record<string, unknown>)]
      : [];
  return {
    id: raw.id as string,
    category: String(raw.category),
    description: String(raw.description),
    amount: num(raw.amount),
    paymentSource: parsePaymentSource(raw.paymentSource),
    invoices,
    invoice: invoices[0],
  };
}

/** Skip blank placeholder lines; keep saved lines and anything with amount or description. */
export function expensesForSync(expenses: ExpenseLine[]): ExpenseLine[] {
  return expenses.filter(
    (e) => Boolean(e.id) || e.amount > 0 || Boolean(e.description?.trim())
  );
}

export async function syncExpenses(entryId: string, expenses: ExpenseLine[]) {
  const payload = expensesForSync(expenses).map((e) => ({
    ...(e.id ? { id: e.id } : {}),
    category: e.category,
    description: e.description,
    amount: e.amount,
    paymentSource: e.paymentSource || "CASH",
  }));
  const raw = await api<Record<string, unknown>[]>(`/expenses/entry/${entryId}/sync`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return raw.map(mapExpense);
}

/** Re-read the file into memory right before upload so the browser doesn't
 *  hit ERR_UPLOAD_FILE_CHANGED when the on-disk copy moved or was rewritten
 *  (common with camera temp files on mobile). */
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

export async function uploadExpenseInvoice(expenseId: string, file: File) {
  const payload = await materializeForUpload(file);
  const fd = new FormData();
  fd.append("invoice", payload);
  try {
    const raw = await api<Record<string, unknown>>(`/expenses/${expenseId}/invoice`, {
      method: "POST",
      body: fd,
    });
    return mapExpense(raw);
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

export async function uploadPendingInvoices(before: ExpenseLine[], synced: ExpenseLine[]) {
  const result: ExpenseLine[] = [];

  for (let i = 0; i < synced.length; i++) {
    const serverLine = synced[i];
    const local =
      before.find((b) => b.id && b.id === serverLine.id) ??
      before[i] ??
      before.find(
        (b) =>
          !b.id &&
          b.description === serverLine.description &&
          b.amount === serverLine.amount
      );

    const pending = [
      ...(local?.pendingFiles ?? []),
      ...(local?.pendingFile ? [local.pendingFile] : []),
    ];

    let line = serverLine;
    const expenseId = line.id;
    if (expenseId) {
      for (const file of pending) {
        line = await uploadExpenseInvoice(expenseId, file);
      }
    }
    result.push(line);
  }

  return result.length ? result : synced;
}

export async function loadExpenses(entryId: string) {
  const raw = await api<Record<string, unknown>[]>(`/expenses/entry/${entryId}`);
  return raw.map(mapExpense);
}

export type LedgerExpense = ExpenseLine & {
  effectiveDate?: string;
  standalone?: boolean;
  entryId?: string;
  entryDate?: string;
  tags?: Tag[];
  commentCount?: number;
};

/** Bulk-delete a list of standalone expenses. The backend returns an
 *  itemised report so the UI can surface partial failures. */
export async function bulkDeleteStandaloneExpenses(ids: string[]) {
  return api<{ deleted: string[]; failed: { id: string; reason: string }[] }>(
    "/expenses/standalone/bulk-delete",
    {
      method: "POST",
      body: JSON.stringify({ ids }),
    }
  );
}

/** Tag list returned alongside a record. Exported so other endpoints
 *  (deposits, settlements, …) can use the same shape. */
export function mapTags(raw: unknown): Tag[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    name: String(r.name),
    color: r.color != null ? String(r.color) : null,
  }));
}

function mapLedgerExpense(raw: Record<string, unknown>): LedgerExpense {
  const base = mapExpense(raw);
  return {
    ...base,
    effectiveDate: raw.effectiveDate != null ? String(raw.effectiveDate) : undefined,
    standalone: Boolean(raw.standalone),
    entryId: raw.entryId != null ? String(raw.entryId) : undefined,
    entryDate: raw.entryDate != null ? String(raw.entryDate) : undefined,
    tags: mapTags(raw.tags),
    commentCount: typeof raw.commentCount === "number" ? raw.commentCount : 0,
  };
}

export async function listAllExpenses(from: string, to: string, tagIds?: string[]) {
  const params = new URLSearchParams({ from, to });
  for (const id of tagIds ?? []) params.append("tagId", id);
  const raw = await api<Record<string, unknown>[]>(`/expenses?${params}`);
  return raw.map(mapLedgerExpense);
}

export type StandaloneExpensePayload = {
  effectiveDate: string;
  category: string;
  description: string;
  amount: number;
  paymentSource: string;
};

export async function createStandaloneExpense(
  payload: StandaloneExpensePayload,
  invoices?: File | File[]
) {
  const files = invoices
    ? Array.isArray(invoices)
      ? invoices
      : [invoices]
    : [];
  const raw = await api<Record<string, unknown>>("/expenses/standalone/json", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  let row = mapLedgerExpense(raw);
  for (const file of files) {
    if (row.id) {
      const updated = await uploadExpenseInvoice(row.id, file);
      row = { ...row, ...updated };
    }
  }
  return row;
}

export async function updateStandaloneExpense(
  id: string,
  payload: StandaloneExpensePayload
) {
  const raw = await api<Record<string, unknown>>(`/expenses/standalone/${id}/json`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return mapLedgerExpense(raw);
}

export async function deleteStandaloneExpense(id: string) {
  await api(`/expenses/standalone/${id}`, { method: "DELETE" });
}

export async function deleteExpenseInvoice(expenseId: string, fileId: string) {
  const raw = await api<Record<string, unknown>>(
    `/expenses/${expenseId}/invoices/${fileId}`,
    { method: "DELETE" }
  );
  return mapExpense(raw);
}
