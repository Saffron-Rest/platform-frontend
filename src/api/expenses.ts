import { api } from "./client";
import { num } from "../lib/numbers";
import { parsePaymentSource } from "../lib/paymentSource";
import type { ExpenseInvoice, ExpenseLine } from "../types";

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

export async function uploadExpenseInvoice(expenseId: string, file: File) {
  const fd = new FormData();
  fd.append("invoice", file);
  const raw = await api<Record<string, unknown>>(`/expenses/${expenseId}/invoice`, {
    method: "POST",
    body: fd,
  });
  return mapExpense(raw);
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

export async function deleteExpenseInvoice(expenseId: string, fileId: string) {
  const raw = await api<Record<string, unknown>>(
    `/expenses/${expenseId}/invoices/${fileId}`,
    { method: "DELETE" }
  );
  return mapExpense(raw);
}
