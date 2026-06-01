import { useEffect, useMemo, useState } from "react";
import { fmt } from "../../lib/calc";
import { todayLocalIso } from "../../lib/dates";
import { useAuth } from "../../context/AuthContext";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { EmptyState } from "../../components/ui/EmptyState";
import { Spinner } from "../../components/ui/Spinner";
import { Badge } from "../../components/ui/Badge";
import {
  createPayable,
  deletePayablePayment,
  getPayable,
  getPayableAging,
  listPayables,
  recordPayablePayment,
  voidPayable,
  type CreatePayableInput,
  type PayableAging,
  type PayableCategory,
  type PayableDetail,
  type PayableListResponse,
  type PayableStatus,
  type PaymentMethod,
} from "../../api/payables";
import {
  createSupplier,
  listSuppliers,
  type Supplier,
} from "../../api/suppliers";
import { listStock, type StockItem } from "../../api/stock";

type Tab = "OUTSTANDING" | "PAID" | "VOID" | "ALL";

const TAB_DEFS: { id: Tab; label: string }[] = [
  { id: "OUTSTANDING", label: "Outstanding" },
  { id: "PAID", label: "Paid" },
  { id: "VOID", label: "Voided" },
  { id: "ALL", label: "All" },
];

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "CASH", label: "Cash" },
  { value: "CARD", label: "Card" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "OTHER", label: "Other" },
];

const CATEGORY_OPTIONS: { value: PayableCategory; label: string }[] = [
  { value: "SUPPLIER", label: "Supplier (food & beverage)" },
  { value: "SUPPLIES", label: "Supplies / consumables" },
  { value: "CLEANING", label: "Cleaning" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "UTILITIES", label: "Utilities" },
  { value: "RENT", label: "Rent" },
  { value: "MARKETING", label: "Marketing" },
  { value: "DELIVERY", label: "Delivery" },
  { value: "OTHER", label: "Other" },
];

const statusBadge = (s: PayableStatus, overdue: boolean) => {
  if (s === "VOID") return { variant: "inactive" as const, label: "Voided" };
  if (s === "PAID") return { variant: "locked" as const, label: "Paid" };
  if (overdue) return { variant: "draft" as const, label: "Overdue" };
  if (s === "PARTIAL") return { variant: "draft" as const, label: "Partial" };
  return { variant: "neutral" as const, label: "Unpaid" };
};

const fmtDate = (iso: string) => {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
};

type LineDraft = {
  stockItemId: string;
  description: string;
  quantity: string;
  unit: string;
  unitCost: string;
};

const blankLine = (): LineDraft => ({
  stockItemId: "",
  description: "",
  quantity: "1",
  unit: "pcs",
  unitCost: "",
});

const num = (s: string): number => {
  const v = Number((s || "").replace(",", "."));
  return Number.isFinite(v) ? v : 0;
};

export function AdminPayables() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("PAYABLES_MANAGE");

  const [tab, setTab] = useState<Tab>("OUTSTANDING");
  const [data, setData] = useState<PayableListResponse | null>(null);
  const [aging, setAging] = useState<PayableAging | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null);
  const [stockItems, setStockItems] = useState<StockItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [openSupplier, setOpenSupplier] = useState(false);
  const [detail, setDetail] = useState<PayableDetail | null>(null);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, ag] = await Promise.all([listPayables(tab), getPayableAging()]);
      setData(list);
      setAging(ag);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load payables");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, [tab]);

  // Suppliers + stock items only need to be loaded once for the
  // create/picker workflow. Lazy-load when admin opens the dialog.
  const ensurePickerData = async () => {
    if (!suppliers) {
      try {
        setSuppliers(await listSuppliers());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load suppliers");
      }
    }
    if (!stockItems) {
      try {
        setStockItems(await listStock());
      } catch {
        // Non-fatal: stock list is just for the picker convenience.
        setStockItems([]);
      }
    }
  };

  return (
    <>
      <PageHeader
        kicker="Finance"
        title="Payables"
        subtitle="Supplier credit / accounts payable. Booking an invoice hits stock and COGS today; payments only move cash."
        action={
          canManage && (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  ensurePickerData();
                  setOpenSupplier(true);
                }}
              >
                + Supplier
              </Button>
              <Button
                onClick={() => {
                  ensurePickerData();
                  setOpenCreate(true);
                }}
              >
                + Record credit invoice
              </Button>
            </>
          )
        }
        tabs={TAB_DEFS.map((t) => ({
          id: t.id,
          label: t.label,
          active: tab === t.id,
          onClick: () => setTab(t.id),
          badge:
            t.id === "OUTSTANDING" && data?.totals.count !== undefined && tab === "OUTSTANDING"
              ? data.totals.count
              : undefined,
        }))}
      />

      {error && (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      )}

      {tab === "OUTSTANDING" && aging && <AgingPanel aging={aging} />}

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner label="Loading payables…" />
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title={tab === "OUTSTANDING" ? "Nothing outstanding" : "No invoices in this view"}
          description={
            tab === "OUTSTANDING"
              ? "When you record a credit invoice it'll appear here until fully paid."
              : "Switch to a different tab to see other invoices."
          }
        />
      ) : (
        <PayablesTable items={data.items} totals={data.totals} onOpen={setDetail} />
      )}

      {openCreate && suppliers && stockItems && (
        <CreateInvoiceDialog
          suppliers={suppliers}
          stockItems={stockItems}
          onClose={() => setOpenCreate(false)}
          onCreated={async () => {
            setOpenCreate(false);
            await reload();
          }}
        />
      )}

      {openSupplier && (
        <SupplierDialog
          onClose={() => setOpenSupplier(false)}
          onCreated={async (s) => {
            setSuppliers((cur) => (cur ? [...cur, s].sort((a, b) => a.name.localeCompare(b.name)) : [s]));
            setOpenSupplier(false);
          }}
        />
      )}

      {detail && (
        <DetailDrawer
          invoice={detail}
          canManage={canManage}
          onClose={() => setDetail(null)}
          onChanged={async (next) => {
            setDetail(next);
            await reload();
          }}
        />
      )}
    </>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Sub-components
// ───────────────────────────────────────────────────────────────────────────

function AgingPanel({ aging }: { aging: PayableAging }) {
  const buckets = [
    { key: "current", label: "Not yet due", value: aging.current, tone: "text-emerald-700" },
    { key: "d1to7", label: "1–7 days late", value: aging.d1to7, tone: "text-amber-700" },
    { key: "d8to30", label: "8–30 days late", value: aging.d8to30, tone: "text-orange-700" },
    { key: "d31to60", label: "31–60 days late", value: aging.d31to60, tone: "text-red-700" },
    { key: "d60plus", label: "60+ days late", value: aging.d60plus, tone: "text-red-800" },
  ];
  return (
    <Card className="mb-4" padding="md">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-[var(--color-ink)]">Outstanding by age</h2>
        <span className="text-sm text-[var(--color-muted)]">Total {fmt(aging.total)}</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {buckets.map((b) => (
          <div key={b.key} className="rounded-xl border border-black/[0.06] bg-white px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">{b.label}</p>
            <p className={`text-lg font-semibold ${b.tone}`}>{fmt(b.value)}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function PayablesTable({
  items,
  totals,
  onOpen,
}: {
  items: PayableListResponse["items"];
  totals: PayableListResponse["totals"];
  onOpen: (d: PayableDetail) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const open = async (id: string) => {
    setBusyId(id);
    try {
      const d = await getPayable(id);
      onOpen(d);
    } finally {
      setBusyId(null);
    }
  };
  return (
    <Card padding="sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Supplier</th>
              <th className="px-3 py-2 text-left font-medium">Invoice</th>
              <th className="px-3 py-2 text-left font-medium">Date</th>
              <th className="px-3 py-2 text-left font-medium">Due</th>
              <th className="px-3 py-2 text-right font-medium">Total</th>
              <th className="px-3 py-2 text-right font-medium">Outstanding</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.05]">
            {items.map((row) => {
              const badge = statusBadge(row.status, row.overdue);
              return (
                <tr key={row.id} className="hover:bg-[var(--color-cream)]/60">
                  <td className="px-3 py-2.5 font-medium text-[var(--color-ink)]">
                    {row.supplier.name}
                  </td>
                  <td className="px-3 py-2.5 text-[var(--color-muted)]">
                    {row.invoiceNumber || <span className="italic">no number</span>}
                  </td>
                  <td className="px-3 py-2.5 text-[var(--color-muted)]">{fmtDate(row.invoiceDate)}</td>
                  <td className="px-3 py-2.5 text-[var(--color-muted)]">
                    {fmtDate(row.dueDate)}
                    {row.overdue && row.daysPastDue !== undefined && (
                      <span className="ml-1 text-xs text-red-700">({row.daysPastDue}d)</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmt(row.total)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold">
                    {row.status === "PAID" || row.status === "VOID" ? "—" : fmt(row.outstanding)}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => open(row.id)}
                      disabled={busyId === row.id}
                      className="text-sm font-medium text-[var(--color-saffron-dark)] hover:underline disabled:opacity-50"
                    >
                      {busyId === row.id ? "…" : "Open"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="text-xs text-[var(--color-muted)] bg-[var(--color-cream)]/50">
            <tr>
              <td colSpan={4} className="px-3 py-2">
                {totals.count} invoice{totals.count === 1 ? "" : "s"}
                {totals.overdueCount > 0 && (
                  <span className="ml-2 text-red-700">
                    · {totals.overdueCount} overdue ({fmt(totals.overdueAmount)})
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-right" colSpan={2}>
                Outstanding {fmt(totals.outstanding)}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Create-invoice dialog
// ───────────────────────────────────────────────────────────────────────────

function CreateInvoiceDialog({
  suppliers,
  stockItems,
  onClose,
  onCreated,
}: {
  suppliers: Supplier[];
  stockItems: StockItem[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const today = todayLocalIso();
  const [supplierId, setSupplierId] = useState<string>(suppliers[0]?.id ?? "");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [dueDate, setDueDate] = useState<string>("");
  const [category, setCategory] = useState<PayableCategory>("SUPPLIER");
  const [vat, setVat] = useState("0");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([blankLine()]);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Pre-fill due date when supplier or invoice date change.
  useEffect(() => {
    if (!supplierId || !invoiceDate) return;
    const sup = suppliers.find((s) => s.id === supplierId);
    if (!sup) return;
    const days = Math.max(0, sup.paymentTermsDays);
    const d = new Date(invoiceDate + "T00:00:00");
    d.setDate(d.getDate() + days);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    setDueDate(iso);
  }, [supplierId, invoiceDate, suppliers]);

  const subtotal = useMemo(
    () => lines.reduce((acc, l) => acc + num(l.quantity) * num(l.unitCost), 0),
    [lines],
  );
  const total = useMemo(() => subtotal + num(vat), [subtotal, vat]);

  const setLine = (i: number, patch: Partial<LineDraft>) => {
    setLines((cur) => cur.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  };

  const addLine = () => setLines((cur) => [...cur, blankLine()]);
  const removeLine = (i: number) => setLines((cur) => cur.filter((_, idx) => idx !== i));

  const submit = async () => {
    setErr(null);
    if (!supplierId) {
      setErr("Pick a supplier first.");
      return;
    }
    const cleaned = lines.filter((l) => l.description.trim() || l.stockItemId);
    if (cleaned.length === 0) {
      setErr("At least one line is required.");
      return;
    }
    const payload: CreatePayableInput = {
      supplierId,
      invoiceNumber: invoiceNumber.trim() || null,
      invoiceDate,
      dueDate: dueDate || null,
      category,
      vat: num(vat),
      notes: notes.trim() || null,
      lines: cleaned.map((l) => ({
        stockItemId: l.stockItemId || null,
        description: l.description.trim() || null,
        quantity: num(l.quantity),
        unit: l.unit || "pcs",
        unitCost: num(l.unitCost),
      })),
    };
    setSubmitting(true);
    try {
      await createPayable(payload);
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to record invoice");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialogShell title="Record credit invoice" onClose={onClose} wide>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <Field label="Supplier">
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="field-input"
          >
            <option value="" disabled>
              Pick a supplier…
            </option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Invoice number (optional)">
          <input
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            className="field-input"
            placeholder="INV-2026-042"
          />
        </Field>
        <Field label="Delivery / invoice date">
          <input
            type="date"
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
            className="field-input"
            max={today}
          />
        </Field>
        <Field label="Due date">
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="field-input"
          />
        </Field>
        <Field label="Category">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as PayableCategory)}
            className="field-input"
          >
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="VAT (added to subtotal)">
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={vat}
            onChange={(e) => setVat(e.target.value)}
            className="field-input"
          />
        </Field>
      </div>

      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-ink)]">Lines</h3>
        <button
          type="button"
          onClick={addLine}
          className="text-sm font-medium text-[var(--color-saffron-dark)] hover:underline"
        >
          + Add line
        </button>
      </div>
      <div className="space-y-2 mb-4">
        {lines.map((line, i) => (
          <LineRow
            key={i}
            line={line}
            stockItems={stockItems}
            onChange={(patch) => setLine(i, patch)}
            onRemove={lines.length > 1 ? () => removeLine(i) : undefined}
          />
        ))}
      </div>

      <div className="mb-4 rounded-xl bg-[var(--color-cream)] px-4 py-3 text-sm">
        <div className="flex justify-between">
          <span className="text-[var(--color-muted)]">Subtotal</span>
          <span className="tabular-nums">{fmt(subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--color-muted)]">VAT</span>
          <span className="tabular-nums">{fmt(num(vat))}</span>
        </div>
        <div className="flex justify-between mt-1 pt-1 border-t border-black/10 font-semibold">
          <span>Total to pay</span>
          <span className="tabular-nums">{fmt(total)}</span>
        </div>
      </div>

      <Field label="Notes (optional)">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="field-input"
          rows={2}
          placeholder="e.g. monthly delivery"
        />
      </Field>

      {err && (
        <Alert variant="error" className="mt-3">
          {err}
        </Alert>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={submitting || !supplierId}>
          {submitting ? "Saving…" : "Record invoice"}
        </Button>
      </div>
    </DialogShell>
  );
}

function LineRow({
  line,
  stockItems,
  onChange,
  onRemove,
}: {
  line: LineDraft;
  stockItems: StockItem[];
  onChange: (patch: Partial<LineDraft>) => void;
  onRemove?: () => void;
}) {
  const total = num(line.quantity) * num(line.unitCost);
  return (
    <div className="grid grid-cols-12 gap-2 items-end p-2 rounded-lg border border-black/[0.06] bg-white">
      <div className="col-span-12 md:col-span-4">
        <label className="block text-[11px] uppercase tracking-wide text-[var(--color-muted)]">
          Stock item / description
        </label>
        <select
          value={line.stockItemId}
          onChange={(e) => {
            const id = e.target.value;
            const it = stockItems.find((s) => s.id === id);
            onChange({
              stockItemId: id,
              description: it?.name ?? line.description,
              unit: it?.unit ?? line.unit,
              unitCost: it?.unitCost ? String(it.unitCost) : line.unitCost,
            });
          }}
          className="field-input"
        >
          <option value="">— Custom (no stock) —</option>
          {stockItems
            .filter((s) => s.active)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.sku ? ` (${s.sku})` : ""}
              </option>
            ))}
        </select>
        {!line.stockItemId && (
          <input
            value={line.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="Description (e.g. Cleaning service Jan)"
            className="field-input mt-2"
          />
        )}
      </div>
      <div className="col-span-4 md:col-span-2">
        <label className="block text-[11px] uppercase tracking-wide text-[var(--color-muted)]">
          Qty
        </label>
        <input
          type="number"
          inputMode="decimal"
          step="0.001"
          min="0"
          value={line.quantity}
          onChange={(e) => onChange({ quantity: e.target.value })}
          className="field-input"
        />
      </div>
      <div className="col-span-3 md:col-span-2">
        <label className="block text-[11px] uppercase tracking-wide text-[var(--color-muted)]">
          Unit
        </label>
        <input
          value={line.unit}
          onChange={(e) => onChange({ unit: e.target.value })}
          className="field-input"
        />
      </div>
      <div className="col-span-5 md:col-span-2">
        <label className="block text-[11px] uppercase tracking-wide text-[var(--color-muted)]">
          Unit cost
        </label>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={line.unitCost}
          onChange={(e) => onChange({ unitCost: e.target.value })}
          className="field-input"
        />
      </div>
      <div className="col-span-9 md:col-span-1 text-right">
        <p className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">Total</p>
        <p className="tabular-nums font-semibold">{fmt(total)}</p>
      </div>
      <div className="col-span-3 md:col-span-1 text-right">
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-[var(--color-danger)] hover:underline text-sm"
            aria-label="Remove line"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Detail drawer
// ───────────────────────────────────────────────────────────────────────────

function DetailDrawer({
  invoice,
  canManage,
  onClose,
  onChanged,
}: {
  invoice: PayableDetail;
  canManage: boolean;
  onClose: () => void;
  onChanged: (next: PayableDetail) => void;
}) {
  const [recordOpen, setRecordOpen] = useState(false);
  const [voidPending, setVoidPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const badge = statusBadge(invoice.status, invoice.overdue);

  const onVoid = async () => {
    if (!confirm("Void this invoice? Stock movements will be reversed.")) return;
    setVoidPending(true);
    setErr(null);
    try {
      const next = await voidPayable(invoice.id, "Voided from admin");
      onChanged(next);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not void invoice");
    } finally {
      setVoidPending(false);
    }
  };

  const onDeletePayment = async (paymentId: string) => {
    if (!confirm("Reverse this payment? The outstanding balance will go back up.")) return;
    setErr(null);
    try {
      const next = await deletePayablePayment(invoice.id, paymentId);
      onChanged(next);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not reverse payment");
    }
  };

  return (
    <DialogShell
      title={`${invoice.supplier.name}${invoice.invoiceNumber ? ` · ${invoice.invoiceNumber}` : ""}`}
      onClose={onClose}
      wide
    >
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Badge variant={badge.variant}>{badge.label}</Badge>
        <span className="text-sm text-[var(--color-muted)]">
          Invoice {fmtDate(invoice.invoiceDate)} · due {fmtDate(invoice.dueDate)}
        </span>
        {invoice.overdue && invoice.daysPastDue !== undefined && (
          <span className="text-sm font-semibold text-red-700">
            {invoice.daysPastDue} day{invoice.daysPastDue === 1 ? "" : "s"} overdue
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <Stat label="Total" value={fmt(invoice.total)} />
        <Stat label="Paid" value={fmt(invoice.amountPaid)} tone="text-emerald-700" />
        <Stat
          label="Outstanding"
          value={fmt(invoice.outstanding)}
          tone={invoice.outstanding > 0 ? "text-red-700" : "text-[var(--color-muted)]"}
        />
      </div>

      <h3 className="text-sm font-semibold mb-2">Lines</h3>
      <div className="overflow-x-auto mb-4">
        <table className="min-w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
            <tr>
              <th className="px-2 py-1 text-left">Description</th>
              <th className="px-2 py-1 text-right">Qty</th>
              <th className="px-2 py-1 text-left">Unit</th>
              <th className="px-2 py-1 text-right">Unit cost</th>
              <th className="px-2 py-1 text-right">Line total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.05]">
            {invoice.lines.map((l) => (
              <tr key={l.id ?? `${l.description}-${l.lineTotal}`}>
                <td className="px-2 py-1.5">
                  {l.description}
                  {l.stockItemId && (
                    <span className="ml-2 text-xs text-[var(--color-muted)]">(stock-linked)</span>
                  )}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">{l.quantity}</td>
                <td className="px-2 py-1.5">{l.unit}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{fmt(l.unitCost)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{fmt(l.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">Payments</h3>
        {canManage && invoice.status !== "VOID" && invoice.status !== "PAID" && (
          <Button onClick={() => setRecordOpen(true)}>+ Record payment</Button>
        )}
      </div>
      {invoice.payments.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)] mb-4">No payments yet.</p>
      ) : (
        <div className="overflow-x-auto mb-4">
          <table className="min-w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
              <tr>
                <th className="px-2 py-1 text-left">Date</th>
                <th className="px-2 py-1 text-right">Amount</th>
                <th className="px-2 py-1 text-left">Method</th>
                <th className="px-2 py-1 text-left">Reference</th>
                <th className="px-2 py-1" />
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.05]">
              {invoice.payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-2 py-1.5">{fmtDate(p.paymentDate)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{fmt(p.amount)}</td>
                  <td className="px-2 py-1.5">{p.method.replace("_", " ").toLowerCase()}</td>
                  <td className="px-2 py-1.5 text-[var(--color-muted)]">{p.reference || "—"}</td>
                  <td className="px-2 py-1.5 text-right">
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => onDeletePayment(p.id)}
                        className="text-sm text-[var(--color-danger)] hover:underline"
                      >
                        Reverse
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {invoice.notes && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold mb-1">Notes</h3>
          <p className="text-sm text-[var(--color-muted)] whitespace-pre-wrap">{invoice.notes}</p>
        </div>
      )}

      {err && (
        <Alert variant="error" className="mb-3">
          {err}
        </Alert>
      )}

      <div className="flex justify-between mt-4">
        {canManage && invoice.status !== "VOID" && invoice.amountPaid <= 0 && (
          <Button variant="danger" onClick={onVoid} disabled={voidPending}>
            {voidPending ? "Voiding…" : "Void invoice"}
          </Button>
        )}
        <Button variant="ghost" onClick={onClose} className="ml-auto">
          Close
        </Button>
      </div>

      {recordOpen && (
        <RecordPaymentDialog
          invoice={invoice}
          onClose={() => setRecordOpen(false)}
          onRecorded={async (next) => {
            setRecordOpen(false);
            onChanged(next);
          }}
        />
      )}
    </DialogShell>
  );
}

function RecordPaymentDialog({
  invoice,
  onClose,
  onRecorded,
}: {
  invoice: PayableDetail;
  onClose: () => void;
  onRecorded: (next: PayableDetail) => void;
}) {
  const today = todayLocalIso();
  const [paymentDate, setPaymentDate] = useState(today);
  const [amount, setAmount] = useState(invoice.outstanding.toFixed(2));
  const [method, setMethod] = useState<PaymentMethod>("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    const a = num(amount);
    if (a <= 0) {
      setErr("Amount must be greater than zero.");
      return;
    }
    setSubmitting(true);
    try {
      const next = await recordPayablePayment(invoice.id, {
        paymentDate,
        amount: a,
        method,
        reference: reference.trim() || null,
        notes: notes.trim() || null,
      });
      onRecorded(next);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not record payment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialogShell title="Record payment" onClose={onClose}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <Field label="Payment date">
          <input
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            min={invoice.invoiceDate}
            max={today}
            className="field-input"
          />
        </Field>
        <Field label={`Amount (max ${fmt(invoice.outstanding)})`}>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            max={invoice.outstanding}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="field-input"
          />
        </Field>
        <Field label="Method">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            className="field-input"
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Reference (optional)">
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. transfer id, cheque #"
            className="field-input"
          />
        </Field>
      </div>
      <Field label="Notes (optional)">
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="field-input"
        />
      </Field>
      {err && (
        <Alert variant="error" className="mt-3">
          {err}
        </Alert>
      )}
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="ghost" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={submitting}>
          {submitting ? "Saving…" : "Record payment"}
        </Button>
      </div>
    </DialogShell>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Supplier dialog
// ───────────────────────────────────────────────────────────────────────────

function SupplierDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (s: Supplier) => void;
}) {
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [vatId, setVatId] = useState("");
  const [paymentTermsDays, setPaymentTermsDays] = useState("7");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) {
      setErr("Supplier name is required.");
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      const created = await createSupplier({
        name: name.trim(),
        contactName: contactName.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        vatId: vatId.trim() || null,
        paymentTermsDays: Math.max(0, parseInt(paymentTermsDays || "0", 10)),
      });
      onCreated(created);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not create supplier");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialogShell title="New supplier" onClose={onClose}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="field-input"
            placeholder="e.g. Makro"
          />
        </Field>
        <Field label="Contact (optional)">
          <input
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            className="field-input"
          />
        </Field>
        <Field label="Phone">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="field-input"
          />
        </Field>
        <Field label="Email">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            className="field-input"
          />
        </Field>
        <Field label="VAT id (optional)">
          <input
            value={vatId}
            onChange={(e) => setVatId(e.target.value)}
            className="field-input"
          />
        </Field>
        <Field label="Default payment terms (days)">
          <input
            type="number"
            min="0"
            max="365"
            value={paymentTermsDays}
            onChange={(e) => setPaymentTermsDays(e.target.value)}
            className="field-input"
          />
        </Field>
      </div>
      {err && (
        <Alert variant="error" className="mt-3">
          {err}
        </Alert>
      )}
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="ghost" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={submitting}>
          {submitting ? "Saving…" : "Create supplier"}
        </Button>
      </div>
    </DialogShell>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Lightweight UI primitives shared by the dialogs above
// ───────────────────────────────────────────────────────────────────────────

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-black/[0.06] bg-white px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${tone ?? ""}`}>{value}</p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-[var(--color-muted)] mb-1">{label}</span>
      {children}
    </label>
  );
}

function DialogShell({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  // Close on ESC for keyboard friendliness; the backdrop click also
  // dismisses unless the user is interacting with a form element. We
  // intentionally keep this as plain CSS instead of pulling in a modal
  // library since the rest of the app rolls its own.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 px-2 py-4 md:p-6">
      <div
        className={`relative w-full ${wide ? "max-w-3xl" : "max-w-md"} max-h-full overflow-y-auto rounded-2xl bg-[var(--color-cream)] shadow-2xl`}
      >
        <div className="sticky top-0 flex items-center justify-between gap-2 px-5 py-4 bg-[var(--color-cream)] border-b border-black/[0.06]">
          <h2 className="text-lg font-semibold text-[var(--color-ink)] truncate">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 -m-1 rounded-md hover:bg-black/5 text-[var(--color-muted)] hover:text-[var(--color-ink)]"
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
