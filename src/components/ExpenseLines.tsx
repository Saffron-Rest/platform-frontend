import { useEffect, useRef, useState } from "react";
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "../lib/expenseCategories";
import { PAYMENT_SOURCES } from "../lib/paymentSource";
import { ExpenseInvoiceUploader } from "./expense/ExpenseInvoiceUploader";
import type { ExpenseLine, PaymentSource } from "../types";
import { expenseTotalBySource, fmt, totalExpenseLines } from "../lib/calc";
import { AmountField } from "./ui/AmountField";
import { Button } from "./ui/Button";

const SUGGESTIONS_KEY = "saffron:expense_suggestions";
const MAX_SUGGESTIONS = 60;

type Suggestion = { description: string; category: ExpenseCategory };

function loadSuggestions(): Suggestion[] {
  try {
    return JSON.parse(localStorage.getItem(SUGGESTIONS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveSuggestion(description: string, category: ExpenseCategory) {
  const trimmed = description.trim();
  if (!trimmed || trimmed.length < 3) return;
  const existing = loadSuggestions().filter((s) => s.description !== trimmed);
  const next: Suggestion[] = [{ description: trimmed, category }, ...existing].slice(0, MAX_SUGGESTIONS);
  try {
    localStorage.setItem(SUGGESTIONS_KEY, JSON.stringify(next));
  } catch {
    // localStorage full — skip
  }
}

function matchSuggestions(query: string): Suggestion[] {
  if (query.trim().length < 2) return [];
  const q = query.toLowerCase();
  return loadSuggestions()
    .filter((s) => s.description.toLowerCase().includes(q))
    .slice(0, 5);
}

type Props = {
  expenses: ExpenseLine[];
  onChange: (expenses: ExpenseLine[]) => void;
  /** Disable amount, category, description fields */
  disabled?: boolean;
  /** Allow adding/removing receipt photos (admin can do this on locked reports) */
  invoicesEditable?: boolean;
  /** Called when the user confirms there are no expenses for this shift */
  onSkip?: () => void;
  /** When true, shows a "No expenses confirmed" badge instead of the empty editor */
  skipped?: boolean;
  /** Called when the user wants to undo the skip and add expenses */
  onUnskip?: () => void;
};

const emptyLine = (): ExpenseLine => ({
  category: "OTHER",
  description: "",
  amount: 0,
  paymentSource: "CASH",
});

export function ExpenseLines({ expenses, onChange, disabled, invoicesEditable, onSkip, skipped, onUnskip }: Props) {
  const total = totalExpenseLines(expenses);
  const fromCash = expenseTotalBySource(expenses, "CASH");
  const fromCard = expenseTotalBySource(expenses, "CARD");
  const canEditInvoices = invoicesEditable ?? !disabled;
  const canEditFields = !disabled;
  const [activeSuggestIdx, setActiveSuggestIdx] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const suggestRef = useRef<HTMLDivElement>(null);

  // Close suggestions on outside click.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestRef.current && !suggestRef.current.contains(e.target as Node)) {
        setActiveSuggestIdx(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const update = (index: number, patch: Partial<ExpenseLine>) => {
    const next = [...expenses];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const remove = (index: number) => {
    onChange(expenses.filter((_, i) => i !== index));
  };

  const handleDescriptionChange = (index: number, value: string) => {
    update(index, { description: value });
    const matches = matchSuggestions(value);
    setSuggestions(matches);
    setActiveSuggestIdx(matches.length > 0 ? index : null);
  };

  const pickSuggestion = (index: number, s: Suggestion) => {
    update(index, { description: s.description, category: s.category });
    setActiveSuggestIdx(null);
    setSuggestions([]);
  };

  const handleDescriptionBlur = (index: number) => {
    const line = expenses[index];
    if (line?.description && line.amount > 0) {
      saveSuggestion(line.description, line.category as ExpenseCategory);
    }
    // Delay close so click on suggestion fires first.
    setTimeout(() => setActiveSuggestIdx(null), 150);
  };

  return (
    <section
      id="report-section-expenses"
      className="report-section-anchor bg-white rounded-2xl p-4 shadow-sm border border-black/5 mb-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-lg text-[var(--color-saffron-dark)]">Expenses</h3>
          {skipped && expenses.length === 0 && (
            <>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                No expenses confirmed
              </span>
              {onUnskip && (
                <button
                  type="button"
                  onClick={onUnskip}
                  className="text-xs font-medium text-[var(--color-saffron-dark)] hover:underline"
                >
                  Change
                </button>
              )}
            </>
          )}
        </div>
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
      {!(skipped && expenses.length === 0) && (
        <p className="text-sm text-[var(--color-muted)] mb-1">
          Cash: <strong>{fmt(fromCash)}</strong>
          <span className="mx-2">·</span>
          Card: <strong>{fmt(fromCard)}</strong>
        </p>
      )}

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
              <AmountField
                label="Amount"
                value={line.amount}
                onChange={(v) => update(i, { amount: v })}
                disabled={disabled}
                className="text-sm"
              />
            </div>
            <div className="text-sm relative" ref={activeSuggestIdx === i ? suggestRef : undefined}>
              <label className="block">
                Description
                <input
                  type="text"
                  disabled={disabled}
                  placeholder="What was this expense for?"
                  value={line.description}
                  onChange={(e) => handleDescriptionChange(i, e.target.value)}
                  onBlur={() => handleDescriptionBlur(i)}
                  className="w-full mt-1 px-3 py-2 rounded-lg border bg-white"
                />
              </label>
              {activeSuggestIdx === i && suggestions.length > 0 && (
                <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-black/10 rounded-lg shadow-lg overflow-hidden text-sm">
                  {suggestions.map((s, si) => (
                    <li key={si}>
                      <button
                        type="button"
                        onMouseDown={() => pickSuggestion(i, s)}
                        className="w-full text-left px-3 py-2 hover:bg-[var(--color-cream)]/60 flex items-center justify-between gap-2"
                      >
                        <span className="truncate">{s.description}</span>
                        <span className="text-xs text-[var(--color-muted)] shrink-0">
                          {EXPENSE_CATEGORIES.find((c) => c.value === s.category)?.label ?? s.category}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {(line.invoices?.length ?? 0) > 0 || (line.pendingFiles?.length ?? 0) > 0 || line.pendingFile
              ? (
                <ExpenseInvoiceUploader
                  expenseId={line.id}
                  invoices={line.invoices ?? (line.invoice ? [line.invoice] : [])}
                  pendingFiles={[
                    ...(line.pendingFiles ?? []),
                    ...(line.pendingFile ? [line.pendingFile] : []),
                  ]}
                  disabled={!canEditInvoices}
                  uploadImmediately={canEditFields}
                  onChange={(patch) =>
                    update(i, {
                      ...patch,
                      invoice: patch.invoices?.[0] ?? line.invoice,
                      pendingFile: patch.pendingFiles?.[0],
                    })
                  }
                />
              )
              : line.id && canEditInvoices
              ? (
                <ExpenseInvoiceUploader
                  expenseId={line.id}
                  invoices={[]}
                  pendingFiles={[]}
                  disabled={false}
                  uploadImmediately={canEditFields}
                  onChange={(patch) =>
                    update(i, {
                      ...patch,
                      invoice: patch.invoices?.[0] ?? line.invoice,
                      pendingFile: patch.pendingFiles?.[0],
                    })
                  }
                />
              )
              : canEditInvoices && !line.id
              ? (
                <p className="text-xs text-[var(--color-muted)]">
                  📎 Save the report to attach a receipt.
                </p>
              )
              : null
            }

            {canEditFields && (
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-sm text-[var(--color-danger)] px-1"
              >
                Remove expense line
              </button>
            )}

            {disabled && !canEditInvoices && !(line.invoices?.length ?? 0) && (
              <p className="text-xs text-[var(--color-muted)]">No receipt photos attached.</p>
            )}
          </div>
        ))}
      </div>

      {canEditFields && !(skipped && expenses.length === 0) && (
        <button
          type="button"
          onClick={() => onChange([...expenses, emptyLine()])}
          className="w-full py-3 rounded-xl border-2 border-dashed border-[var(--color-saffron)]/50 text-[var(--color-saffron-dark)] font-medium text-sm"
        >
          + Add another expense
        </button>
      )}

      {canEditFields && expenses.length === 0 && !skipped && (
        <button
          type="button"
          onClick={() => onSkip?.()}
          className="w-full py-2 text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors"
        >
          No expenses this shift
        </button>
      )}

      {expenses.length === 0 && disabled && (
        <p className="text-sm text-[var(--color-muted)]">No expense lines recorded.</p>
      )}
    </section>
  );
}
