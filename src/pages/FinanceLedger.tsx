import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  createDeliveryIncome,
  deleteDeliveryIncome,
  listDeliveryIncome,
  type ManualDeliveryPayload,
} from "../api/deliveryIncome";
import {
  createStandaloneExpense,
  deleteStandaloneExpense,
  listAllExpenses,
  type LedgerExpense,
  type StandaloneExpensePayload,
} from "../api/expenses";
import { EXPENSE_CATEGORIES } from "../lib/expenseCategories";
import { fmt } from "../lib/calc";
import { ExpenseInvoiceUploader } from "../components/expense/ExpenseInvoiceUploader";
import { InvoiceGallery } from "../components/expense/InvoiceGallery";
import { PageHeader } from "../components/ui/PageHeader";
import { AmountField } from "../components/ui/AmountField";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";
import { Badge } from "../components/ui/Badge";
import { Spinner } from "../components/ui/Spinner";
import { FinanceAddPanel } from "../components/finance/FinanceAddPanel";
import type { ManualDeliveryIncome } from "../types";

const DELIVERY_PLATFORMS = [
  { value: "WOLT", label: "Wolt" },
  { value: "BOLT", label: "Bolt" },
  { value: "UBER_EATS", label: "Uber Eats" },
  { value: "GLOVO", label: "Glovo" },
  { value: "OTHER", label: "Other" },
] as const;

function monthStartIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function categoryLabel(value: string) {
  return EXPENSE_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

type ViewTab = "expenses" | "delivery";
type AddKind = "expense" | "delivery";

export function FinanceLedger() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [from, setFrom] = useState(monthStartIso());
  const [to, setTo] = useState(todayIso());
  const [viewTab, setViewTab] = useState<ViewTab>("expenses");
  const [addOpen, setAddOpen] = useState<AddKind | null>(null);
  const addPanelRef = useRef<HTMLDivElement>(null);
  const [expenses, setExpenses] = useState<LedgerExpense[]>([]);
  const [delivery, setDelivery] = useState<ManualDeliveryIncome[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [deliveryForm, setDeliveryForm] = useState<ManualDeliveryPayload>({
    effectiveDate: todayIso(),
    platform: "WOLT",
    grossAmount: 0,
    settledToCard: null,
    notes: "",
  });
  const [expenseForm, setExpenseForm] = useState<StandaloneExpensePayload>({
    effectiveDate: todayIso(),
    category: "SUPPLIER",
    description: "",
    amount: 0,
    paymentSource: "CASH",
  });
  const [invoiceFiles, setInvoiceFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [expRows, delRows] = await Promise.all([
        listAllExpenses(from, to),
        listDeliveryIncome(from, to),
      ]);
      setExpenses(expRows);
      setDelivery(delRows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setExpenses([]);
      setDelivery([]);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const add = searchParams.get("add");
    if (add === "expense" || add === "delivery") {
      setAddOpen(add);
      setViewTab(add === "expense" ? "expenses" : "delivery");
      requestAnimationFrame(() => {
        addPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [searchParams]);

  const openAdd = (kind: AddKind) => {
    setAddOpen(kind);
    setViewTab(kind === "expense" ? "expenses" : "delivery");
    setSearchParams({ add: kind }, { replace: true });
    requestAnimationFrame(() => {
      addPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const closeAdd = () => {
    setAddOpen(null);
    const next = new URLSearchParams(searchParams);
    next.delete("add");
    setSearchParams(next, { replace: true });
  };

  const expenseTotal = useMemo(
    () => expenses.reduce((s, e) => s + e.amount, 0),
    [expenses]
  );
  const deliveryTotal = useMemo(
    () => delivery.reduce((s, d) => s + d.grossAmount, 0),
    [delivery]
  );

  const handleAddDelivery = async () => {
    if (deliveryForm.grossAmount <= 0) {
      setError("Enter a delivery amount greater than zero");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload: ManualDeliveryPayload = {
        ...deliveryForm,
        settledToCard:
          deliveryForm.settledToCard != null && deliveryForm.settledToCard > 0
            ? deliveryForm.settledToCard
            : null,
        notes: deliveryForm.notes?.trim() || undefined,
      };
      await createDeliveryIncome(payload);
      setMessage("Delivery income recorded");
      setDeliveryForm((f) => ({ ...f, grossAmount: 0, settledToCard: null, notes: "" }));
      closeAdd();
      setViewTab("delivery");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const handleAddExpense = async () => {
    if (expenseForm.amount <= 0) {
      setError("Enter an expense amount greater than zero");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await createStandaloneExpense(expenseForm, invoiceFiles);
      setMessage("Expense recorded");
      setExpenseForm({
        effectiveDate: todayIso(),
        category: "SUPPLIER",
        description: "",
        amount: 0,
        paymentSource: "CASH",
      });
      setInvoiceFiles([]);
      closeAdd();
      setViewTab("expenses");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDelivery = async (id: string) => {
    if (!confirm("Remove this delivery income entry?")) return;
    try {
      await deleteDeliveryIncome(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const handleDeleteExpense = async (row: LedgerExpense) => {
    if (!row.id) return;
    if (!row.standalone) {
      setError("Shift report expenses must be edited on that report");
      return;
    }
    if (!confirm("Remove this expense?")) return;
    try {
      await deleteStandaloneExpense(row.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Finance"
        subtitle="Delivery income outside shift reports, post-close purchases, and all invoices"
      />

      <Card className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="field-label">
            From
            <input type="date" className="field-input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="field-label">
            To
            <input type="date" className="field-input" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
        <Button variant="dark" fullWidth onClick={() => void load()} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </Button>
      </Card>

      {error && <Alert variant="error">{error}</Alert>}
      {message && <Alert variant="success">{message}</Alert>}

      <div
        data-tour="tour-finance-add"
        className="sticky top-0 z-20 -mx-4 px-4 py-3 mb-2 bg-[var(--color-cream)]/95 backdrop-blur-md border-b border-black/5 md:static md:mx-0 md:px-0 md:border-0 md:bg-transparent md:backdrop-blur-none"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)] mb-2 md:hidden">
          Record quickly
        </p>
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <Button
            variant={addOpen === "expense" ? "dark" : "primary"}
            fullWidth
            className="!py-3.5"
            onClick={() => (addOpen === "expense" ? closeAdd() : openAdd("expense"))}
          >
            {addOpen === "expense" ? "Close expense form" : "+ Add expense"}
          </Button>
          <Button
            variant={addOpen === "delivery" ? "dark" : "primary"}
            fullWidth
            className="!py-3.5"
            onClick={() => (addOpen === "delivery" ? closeAdd() : openAdd("delivery"))}
          >
            {addOpen === "delivery" ? "Close delivery form" : "+ Add delivery"}
          </Button>
        </div>
      </div>

      <div ref={addPanelRef} className="space-y-4 mb-4">
        {addOpen === "delivery" && (
          <FinanceAddPanel
            title="Add delivery income"
            subtitle="When delivery sales are not on a shift report — counts toward income and card balance."
            onClose={closeAdd}
          >
            <div className="space-y-4">
          <label className="field-label">
            Date
            <input
              type="date"
              className="field-input"
              value={deliveryForm.effectiveDate}
              onChange={(e) => setDeliveryForm((f) => ({ ...f, effectiveDate: e.target.value }))}
            />
          </label>
          <label className="field-label">
            Platform
            <select
              className="field-input"
              value={deliveryForm.platform}
              onChange={(e) => setDeliveryForm((f) => ({ ...f, platform: e.target.value }))}
            >
              {DELIVERY_PLATFORMS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <AmountField
            label="Gross delivery sales (PLN)"
            className="field-label"
            inputClassName="field-input"
            value={deliveryForm.grossAmount}
            onChange={(v) => setDeliveryForm((f) => ({ ...f, grossAmount: v }))}
          />
          <AmountField
            label="Settled to card (optional override)"
            className="field-label"
            inputClassName="field-input"
            placeholder="Leave empty to use % from Settings"
            nullable
            value={deliveryForm.settledToCard ?? null}
            onChange={(v) => setDeliveryForm((f) => ({ ...f, settledToCard: v }))}
          />
          <label className="field-label">
            Notes
            <input
              type="text"
              className="field-input"
              value={deliveryForm.notes ?? ""}
              onChange={(e) => setDeliveryForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </label>
            <Button variant="dark" fullWidth disabled={saving} onClick={() => void handleAddDelivery()}>
              {saving ? "Saving…" : "Save delivery income"}
            </Button>
            </div>
          </FinanceAddPanel>
        )}

        {addOpen === "expense" && (
          <FinanceAddPanel
            title="Add post-close expense"
            subtitle="Purchases after the shift is closed — not on a cashier report. Affects P&amp;L and treasury."
            onClose={closeAdd}
          >
            <div className="space-y-4">
          <label className="field-label">
            Date
            <input
              type="date"
              className="field-input"
              value={expenseForm.effectiveDate}
              onChange={(e) => setExpenseForm((f) => ({ ...f, effectiveDate: e.target.value }))}
            />
          </label>
          <label className="field-label">
            Category
            <select
              className="field-input"
              value={expenseForm.category}
              onChange={(e) => setExpenseForm((f) => ({ ...f, category: e.target.value }))}
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Description
            <input
              type="text"
              className="field-input"
              value={expenseForm.description}
              onChange={(e) => setExpenseForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>
          <AmountField
            label="Amount (PLN)"
            className="field-label"
            inputClassName="field-input"
            value={expenseForm.amount}
            onChange={(v) => setExpenseForm((f) => ({ ...f, amount: v }))}
          />
          <label className="field-label">
            Paid from
            <select
              className="field-input"
              value={expenseForm.paymentSource}
              onChange={(e) => setExpenseForm((f) => ({ ...f, paymentSource: e.target.value }))}
            >
              <option value="CASH">Cash</option>
              <option value="CARD">Card / bank</option>
            </select>
          </label>
          <ExpenseInvoiceUploader
            invoices={[]}
            pendingFiles={invoiceFiles}
            disabled={saving}
            uploadImmediately={false}
            pendingHint="Will upload when you save this expense"
            onChange={(patch) => setInvoiceFiles(patch.pendingFiles ?? [])}
          />
            <Button variant="dark" fullWidth disabled={saving} onClick={() => void handleAddExpense()}>
              {saving ? "Saving…" : "Save expense"}
            </Button>
            </div>
          </FinanceAddPanel>
        )}
      </div>

      <div className="flex gap-2 flex-wrap" data-tour="tour-finance-tabs">
        {(
          [
            ["All expenses", "expenses"],
            ["Delivery income", "delivery"],
          ] as const
        ).map(([label, key]) => (
          <button
            key={key}
            type="button"
            onClick={() => setViewTab(key)}
            className={`tab-pill text-sm ${viewTab === key ? "tab-pill-active" : "tab-pill-idle"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner label="Loading ledger…" />
        </div>
      ) : null}

      {viewTab === "delivery" && !loading && (
        <Card>
          <div className="flex items-center justify-between gap-2 mb-4">
            <h3 className="font-semibold">Delivery income</h3>
            <span className="text-sm font-medium">{fmt(deliveryTotal)} PLN gross</span>
          </div>
          {delivery.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-sm text-[var(--color-muted)]">No manual delivery entries in this range.</p>
              <Button variant="primary" onClick={() => openAdd("delivery")}>
                + Add delivery income
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-black/5">
              {delivery.map((d) => (
                <li key={d.id} className="py-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {d.platformLabel} · {fmt(d.grossAmount)}
                    </p>
                    <p className="text-xs text-[var(--color-muted)]">
                      {d.effectiveDate} · to card {fmt(d.settledToCard)}
                      {d.settledOverridden ? " (manual)" : ""}
                    </p>
                    {d.notes && <p className="text-sm mt-1">{d.notes}</p>}
                  </div>
                  <button
                    type="button"
                    className="text-xs text-red-600 font-medium"
                    onClick={() => void handleDeleteDelivery(d.id)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {viewTab === "expenses" && !loading && (
        <Card>
          <div className="flex items-center justify-between gap-2 mb-4">
            <h3 className="font-semibold">All expenses</h3>
            <span className="text-sm font-medium">{fmt(expenseTotal)} PLN</span>
          </div>
          {expenses.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-sm text-[var(--color-muted)]">No expenses in this range.</p>
              <Button variant="primary" onClick={() => openAdd("expense")}>
                + Add expense
              </Button>
            </div>
          ) : (
            <ul className="space-y-4">
              {expenses.map((row) => {
                const invoices = row.invoices?.length
                  ? row.invoices
                  : row.invoice
                    ? [row.invoice]
                    : [];
                return (
                  <li key={row.id ?? `${row.effectiveDate}-${row.description}`} className="border-b border-black/5 pb-4 last:border-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{row.description || categoryLabel(row.category)}</p>
                        <p className="text-sm text-[var(--color-muted)]">
                          {row.effectiveDate ?? row.entryDate} · {categoryLabel(row.category)} · {fmt(row.amount)} ·{" "}
                          {row.paymentSource === "CARD" ? "Card" : "Cash"}
                        </p>
                        <div className="flex gap-2 mt-1 flex-wrap">
                          {row.standalone ? (
                            <Badge variant="neutral">Post-close</Badge>
                          ) : row.entryId ? (
                            <Link
                              to={`/entry/${row.entryId}`}
                              className="text-xs font-medium text-[var(--color-saffron)]"
                            >
                              Shift report →
                            </Link>
                          ) : null}
                        </div>
                      </div>
                      {row.standalone && row.id && (
                        <button
                          type="button"
                          className="text-xs text-red-600 font-medium"
                          onClick={() => void handleDeleteExpense(row)}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    {invoices.length > 0 && (
                      <InvoiceGallery invoices={invoices} />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
