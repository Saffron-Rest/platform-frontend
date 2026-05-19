import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
import { InvoiceGallery } from "../components/expense/InvoiceGallery";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";
import { Badge } from "../components/ui/Badge";
import { Spinner } from "../components/ui/Spinner";
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

type Tab = "expenses" | "delivery" | "add-expense" | "add-delivery";

export function FinanceLedger() {
  const [from, setFrom] = useState(monthStartIso());
  const [to, setTo] = useState(todayIso());
  const [tab, setTab] = useState<Tab>("expenses");
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
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
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
      setTab("delivery");
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
      await createStandaloneExpense(expenseForm, invoiceFile ?? undefined);
      setMessage("Expense recorded");
      setExpenseForm({
        effectiveDate: todayIso(),
        category: "SUPPLIER",
        description: "",
        amount: 0,
        paymentSource: "CASH",
      });
      setInvoiceFile(null);
      setTab("expenses");
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
        title="Finance ledger"
        subtitle="Manual delivery income, post-close expenses, and all receipts in one place"
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

      <div className="flex gap-2 flex-wrap">
        {(
          [
            ["All expenses", "expenses"],
            ["Delivery income", "delivery"],
            ["+ Delivery", "add-delivery"],
            ["+ Expense", "add-expense"],
          ] as const
        ).map(([label, key]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium ${
              tab === key ? "bg-[var(--color-saffron)] text-white" : "bg-black/5 hover:bg-black/10"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && tab !== "add-delivery" && tab !== "add-expense" ? (
        <div className="flex justify-center py-12">
          <Spinner label="Loading ledger…" />
        </div>
      ) : null}

      {tab === "add-delivery" && (
        <Card className="space-y-4">
          <h3 className="font-semibold text-lg">Add delivery income</h3>
          <p className="text-sm text-[var(--color-muted)]">
            Use when delivery sales are not on a shift report. Counts toward total income, analytics, and card
            balance (using settlement % from Settings unless you override).
          </p>
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
          <label className="field-label">
            Gross delivery sales (PLN)
            <input
              type="number"
              min={0}
              step={0.01}
              className="field-input"
              value={deliveryForm.grossAmount || ""}
              onChange={(e) =>
                setDeliveryForm((f) => ({ ...f, grossAmount: parseFloat(e.target.value) || 0 }))
              }
            />
          </label>
          <label className="field-label">
            Settled to card (optional override)
            <input
              type="number"
              min={0}
              step={0.01}
              className="field-input"
              placeholder="Leave empty to use % from Settings"
              value={deliveryForm.settledToCard ?? ""}
              onChange={(e) =>
                setDeliveryForm((f) => ({
                  ...f,
                  settledToCard: e.target.value === "" ? null : parseFloat(e.target.value) || 0,
                }))
              }
            />
          </label>
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
        </Card>
      )}

      {tab === "add-expense" && (
        <Card className="space-y-4">
          <h3 className="font-semibold text-lg">Add post-close expense</h3>
          <p className="text-sm text-[var(--color-muted)]">
            Purchases after the shift is closed — not tied to a cashier report. Affects P&amp;L and treasury for the
            date you choose.
          </p>
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
          <label className="field-label">
            Amount (PLN)
            <input
              type="number"
              min={0}
              step={0.01}
              className="field-input"
              value={expenseForm.amount || ""}
              onChange={(e) =>
                setExpenseForm((f) => ({ ...f, amount: parseFloat(e.target.value) || 0 }))
              }
            />
          </label>
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
          <label className="field-label">
            Invoice (photo or PDF)
            <input
              type="file"
              accept="image/*,.pdf"
              className="field-input"
              onChange={(e) => setInvoiceFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <Button variant="dark" fullWidth disabled={saving} onClick={() => void handleAddExpense()}>
            {saving ? "Saving…" : "Save expense"}
          </Button>
        </Card>
      )}

      {tab === "delivery" && !loading && (
        <Card>
          <div className="flex items-center justify-between gap-2 mb-4">
            <h3 className="font-semibold">Delivery income</h3>
            <span className="text-sm font-medium">{fmt(deliveryTotal)} PLN gross</span>
          </div>
          {delivery.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">No manual delivery entries in this range.</p>
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

      {tab === "expenses" && !loading && (
        <Card>
          <div className="flex items-center justify-between gap-2 mb-4">
            <h3 className="font-semibold">All expenses</h3>
            <span className="text-sm font-medium">{fmt(expenseTotal)} PLN</span>
          </div>
          {expenses.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">No expenses in this range.</p>
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
