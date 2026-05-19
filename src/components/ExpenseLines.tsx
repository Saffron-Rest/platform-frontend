import { EXPENSE_CATEGORIES, type ExpenseCategory } from "../lib/expenseCategories";
import { PAYMENT_SOURCES } from "../lib/paymentSource";
import { deleteExpenseInvoice } from "../api/expenses";
import { InvoiceGallery } from "./expense/InvoiceGallery";
import type { ExpenseLine, PaymentSource } from "../types";
import { expenseTotalBySource, fmt, totalExpenseLines } from "../lib/calc";
import { num } from "../lib/numbers";
import { Button } from "./ui/Button";

type Props = {
  expenses: ExpenseLine[];
  onChange: (expenses: ExpenseLine[]) => void;
  /** Disable amount, category, description fields */
  disabled?: boolean;
  /** Allow adding/removing receipt photos (admin can do this on locked reports) */
  invoicesEditable?: boolean;
};

const emptyLine = (): ExpenseLine => ({
  category: "OTHER",
  description: "",
  amount: 0,
  paymentSource: "CASH",
});

export function ExpenseLines({ expenses, onChange, disabled, invoicesEditable }: Props) {
  const total = totalExpenseLines(expenses);
  const fromCash = expenseTotalBySource(expenses, "CASH");
  const fromCard = expenseTotalBySource(expenses, "CARD");
  const canEditInvoices = invoicesEditable ?? !disabled;
  const canEditFields = !disabled;

  const update = (index: number, patch: Partial<ExpenseLine>) => {
    const next = [...expenses];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const remove = (index: number) => {
    onChange(expenses.filter((_, i) => i !== index));
  };

  const invoiceList = (line: ExpenseLine) =>
    line.invoices ?? (line.invoice ? [line.invoice] : []);

  return (
    <section
      id="report-section-expenses"
      className="report-section-anchor bg-white rounded-2xl p-4 shadow-sm border border-black/5 mb-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="font-semibold text-lg text-[var(--color-saffron-dark)]">Expenses</h3>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-sm text-[var(--color-muted)]">
            Total: <strong className="text-[var(--color-ink)]">{fmt(total)}</strong>
          </span>
          {canEditFields && (
            <Button
              type="button"
              variant="primary"
              className="!py-2 !px-3.5 !text-sm shrink-0"
              onClick={() => onChange([...expenses, emptyLine()])}
            >
              + Add
            </Button>
          )}
        </div>
      </div>
      <p className="text-sm text-[var(--color-muted)] mb-1">
        Cash: <strong>{fmt(fromCash)}</strong>
        <span className="mx-2">·</span>
        Card: <strong>{fmt(fromCard)}</strong>
      </p>

      <div className="space-y-3">
        {expenses.map((line, i) => (
          <div
            key={line.id ?? `new-${i}`}
            className="p-3 rounded-xl border border-black/10 bg-[var(--color-cream)]/50 space-y-2"
          >
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-sm">
                Paid from
                <select
                  disabled={disabled}
                  value={line.paymentSource || "CASH"}
                  onChange={(e) => update(i, { paymentSource: e.target.value as PaymentSource })}
                  className="w-full mt-1 px-3 py-2 rounded-lg border bg-white text-base font-medium"
                >
                  {PAYMENT_SOURCES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Category
                <select
                  disabled={disabled}
                  value={line.category}
                  onChange={(e) => update(i, { category: e.target.value as ExpenseCategory })}
                  className="w-full mt-1 px-3 py-2 rounded-lg border bg-white text-base"
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Amount
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  disabled={disabled}
                  value={num(line.amount)}
                  onChange={(e) => update(i, { amount: num(e.target.value) })}
                  className="w-full mt-1 px-3 py-2 rounded-lg border bg-white text-lg font-medium"
                />
              </label>
            </div>
            <label className="text-sm block">
              Description
              <input
                type="text"
                disabled={disabled}
                placeholder="What was this expense for?"
                value={line.description}
                onChange={(e) => update(i, { description: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-lg border bg-white"
              />
            </label>

            <InvoiceGallery
              invoices={invoiceList(line)}
              editable={canEditInvoices && Boolean(line.id)}
              onDelete={
                line.id
                  ? async (fileId) => {
                      try {
                        const updated = await deleteExpenseInvoice(line.id!, fileId);
                        update(i, {
                          invoices: updated.invoices,
                          invoice: updated.invoice,
                        });
                      } catch (err) {
                        alert(err instanceof Error ? err.message : "Could not remove invoice");
                      }
                    }
                  : undefined
              }
            />

            {canEditInvoices && (
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-sm flex-1 min-w-[200px]">
                  <span className="text-[var(--color-muted)]">
                    {canEditFields ? "Add receipt photos" : "Add receipt photos (admin)"}
                  </span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    multiple
                    className="mt-1 w-full text-sm"
                    onChange={(e) => {
                      const files = e.target.files ? [...e.target.files] : [];
                      if (files.length) {
                        update(i, {
                          pendingFiles: [...(line.pendingFiles ?? []), ...files],
                          pendingFile: files[0],
                        });
                      }
                      e.target.value = "";
                    }}
                  />
                </label>
                {(line.pendingFiles ?? (line.pendingFile ? [line.pendingFile] : [])).map((f, fi) => (
                  <span key={`${f.name}-${fi}`} className="text-xs text-amber-700 self-end pb-2">
                    {f.name} (uploads on save)
                  </span>
                ))}
                {canEditFields && (
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    className="text-sm text-[var(--color-danger)] px-3 py-1 self-end"
                  >
                    Remove
                  </button>
                )}
              </div>
            )}

            {disabled && !canEditInvoices && invoiceList(line).length === 0 && (
              <p className="text-xs text-[var(--color-muted)]">No receipt photos attached.</p>
            )}
          </div>
        ))}
      </div>

      {canEditFields && (
        <button
          type="button"
          onClick={() => onChange([...expenses, emptyLine()])}
          className="w-full py-3 rounded-xl border-2 border-dashed border-[var(--color-saffron)]/50 text-[var(--color-saffron-dark)] font-medium text-sm"
        >
          + Add another expense
        </button>
      )}

      {expenses.length === 0 && disabled && (
        <p className="text-sm text-[var(--color-muted)]">No expense lines recorded.</p>
      )}
    </section>
  );
}
