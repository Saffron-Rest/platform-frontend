import { useEffect, useMemo, useState } from "react";
import { todayLocalIso } from "../../lib/dates";
import { useAuth } from "../../context/AuthContext";
import { useConfirm } from "../../context/ConfirmContext";
import { payableStatus, agingTone } from "../../lib/statusBadges";
import { parseMoneyInput } from "../../lib/numbers";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { EmptyState } from "../../components/ui/EmptyState";
import { Spinner } from "../../components/ui/Spinner";
import { Badge } from "../../components/ui/Badge";
import { Money } from "../../components/ui/Money";
import { Stat, StatGroup, type StatTone } from "../../components/ui/Stat";
import {
  Dialog,
  DialogBody,
  DialogFooter,
  DialogForm,
  DialogTitle,
} from "../../components/ui/Dialog";
import {
  Field,
  Input,
  Select,
  Textarea,
} from "../../components/ui/Field";
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

/** Display helper for the table — picks the right badge based on
 *  status + days overdue. Centralised in {@code lib/statusBadges} so
 *  Payables and the dashboard agree on terminology. */
const rowBadge = (s: PayableStatus, daysPastDue?: number) =>
  payableStatus({ status: s, daysOverdue: daysPastDue });

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
  const parsed = parseMoneyInput(s);
  return parsed === null ? 0 : parsed;
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
          action={
            canManage && tab === "OUTSTANDING" ? (
              <Button
                onClick={() => {
                  void ensurePickerData();
                  setOpenCreate(true);
                }}
              >
                + Record credit invoice
              </Button>
            ) : undefined
          }
        />
      ) : (
        <PayablesTable items={data.items} totals={data.totals} onOpen={setDetail} />
      )}

      <CreateInvoiceDialog
        open={openCreate && Boolean(suppliers && stockItems)}
        suppliers={suppliers ?? []}
        stockItems={stockItems ?? []}
        onClose={() => setOpenCreate(false)}
        onCreated={async () => {
          setOpenCreate(false);
          await reload();
        }}
      />

      <SupplierDialog
        open={openSupplier}
        onClose={() => setOpenSupplier(false)}
        onCreated={async (s) => {
          setSuppliers((cur) =>
            cur ? [...cur, s].sort((a, b) => a.name.localeCompare(b.name)) : [s],
          );
          setOpenSupplier(false);
        }}
      />

      <DetailDrawer
        invoice={detail}
        canManage={canManage}
        onClose={() => setDetail(null)}
        onChanged={async (next) => {
          setDetail(next);
          await reload();
        }}
      />
    </>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Sub-components
// ───────────────────────────────────────────────────────────────────────────

function AgingPanel({ aging }: { aging: PayableAging }) {
  // Map bucket day-window to a StatTone via the shared {@code agingTone}
  // helper so the Dashboard summary, payables list, and this panel all
  // colour overdue debt the same way.
  const toneFromBadge = (b: ReturnType<typeof agingTone>): StatTone => {
    if (b === "success") return "positive";
    if (b === "warning") return "warning";
    if (b === "danger") return "negative";
    return "neutral";
  };
  const buckets: Array<{ key: string; label: string; value: number; tone: StatTone }> = [
    { key: "current", label: "Not yet due", value: aging.current, tone: toneFromBadge(agingTone(0)) },
    { key: "d1to7", label: "1–7 days late", value: aging.d1to7, tone: toneFromBadge(agingTone(7)) },
    { key: "d8to30", label: "8–30 days late", value: aging.d8to30, tone: toneFromBadge(agingTone(30)) },
    { key: "d31to60", label: "31–60 days late", value: aging.d31to60, tone: toneFromBadge(agingTone(60)) },
    { key: "d60plus", label: "60+ days late", value: aging.d60plus, tone: toneFromBadge(agingTone(90)) },
  ];
  return (
    <Card className="mb-4" padding="md">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-[var(--color-ink)]">Outstanding by age</h2>
        <span className="text-sm text-[var(--color-muted)]">
          Total <Money value={aging.total} emphasis="strong" />
        </span>
      </div>
      <StatGroup cols={{ md: 3, lg: 5 }}>
        {buckets.map((b) => (
          <Stat
            key={b.key}
            label={b.label}
            value={<Money value={b.value} />}
            tone={b.tone}
          />
        ))}
      </StatGroup>
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
              const badge = rowBadge(row.status, row.daysPastDue);
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
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Money value={row.total} />
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {row.status === "PAID" || row.status === "VOID" ? (
                      <span className="text-[var(--color-muted)]">—</span>
                    ) : (
                      <Money value={row.outstanding} emphasis="strong" />
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => open(row.id)}
                      disabled={busyId === row.id}
                      className="text-sm font-medium text-[var(--color-saffron-dark)] hover:underline disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-saffron)] rounded"
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
                  <span className="ml-2 text-[var(--color-danger)]">
                    · {totals.overdueCount} overdue (
                    <Money value={totals.overdueAmount} />)
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-right" colSpan={2}>
                Outstanding <Money value={totals.outstanding} emphasis="strong" />
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
// Recent-supplier tracking (localStorage)
// ───────────────────────────────────────────────────────────────────────────

const RECENT_SUPPLIERS_KEY = "saffron:recent_suppliers";

type RecentSupplier = { id: string; name: string };

function loadRecentSuppliers(): RecentSupplier[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_SUPPLIERS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveRecentSupplier(supplier: RecentSupplier) {
  const existing = loadRecentSuppliers().filter((s) => s.id !== supplier.id);
  const next: RecentSupplier[] = [supplier, ...existing].slice(0, 3);
  try {
    localStorage.setItem(RECENT_SUPPLIERS_KEY, JSON.stringify(next));
  } catch {
    // localStorage full — skip
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Create-invoice dialog
// ───────────────────────────────────────────────────────────────────────────

function CreateInvoiceDialog({
  open,
  suppliers,
  stockItems,
  onClose,
  onCreated,
}: {
  open: boolean;
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
  const [recentSuppliers, setRecentSuppliers] = useState<RecentSupplier[]>([]);

  // Reset every time the dialog re-opens. We deliberately don't depend
  // on `suppliers` so changing the supplier list while the dialog is
  // open doesn't reset the user's draft.
  useEffect(() => {
    if (!open) return;
    const recent = loadRecentSuppliers().filter((r) =>
      suppliers.some((s) => s.id === r.id)
    );
    setRecentSuppliers(recent);
    // Pre-select the most recently used supplier, or fall back to first.
    setSupplierId(recent[0]?.id ?? suppliers[0]?.id ?? "");
    setInvoiceNumber("");
    setInvoiceDate(today);
    setDueDate("");
    setCategory("SUPPLIER");
    setVat("0");
    setNotes("");
    setLines([blankLine()]);
    setErr(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
      const supplierName = suppliers.find((s) => s.id === supplierId)?.name ?? "";
      if (supplierName) saveRecentSupplier({ id: supplierId, name: supplierName });
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to record invoice");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialogForm
      open={open}
      onClose={onClose}
      onSubmit={submit}
      size="xl"
      dismissOnBackdrop={false}
      ariaLabel="Record credit invoice"
    >
      <DialogTitle
        description="Booking the invoice posts stock + COGS today; payments only move cash later."
      >
        Record credit invoice
      </DialogTitle>
      <DialogBody className="space-y-4">
        {err && <Alert variant="error">{err}</Alert>}

        {recentSuppliers.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-[var(--color-muted)] shrink-0">Recent:</span>
            {recentSuppliers.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSupplierId(r.id)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                  supplierId === r.id
                    ? "bg-[var(--color-saffron)] border-[var(--color-saffron)] text-white"
                    : "bg-white border-black/10 hover:bg-[var(--color-cream)]/60"
                }`}
              >
                {r.name}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Supplier" required>
            <Select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
            >
              <option value="" disabled>
                Pick a supplier…
              </option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Invoice number" optional>
            <Input
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="INV-2026-042"
            />
          </Field>
          <Field label="Delivery / invoice date" required>
            <Input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              max={today}
            />
          </Field>
          <Field
            label="Due date"
            optional
            hint="Auto-filled from the supplier's payment terms."
          >
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </Field>
          <Field label="Category" required>
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value as PayableCategory)}
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="VAT (PLN, added to subtotal)" optional>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={vat}
              onChange={(e) => setVat(e.target.value)}
            />
          </Field>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--color-ink)]">Lines</h3>
            <Button type="button" variant="ghost" size="sm" onClick={addLine}>
              + Add line
            </Button>
          </div>
          <div className="space-y-2">
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
        </div>

        <div className="rounded-xl bg-[var(--color-cream)] px-4 py-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-[var(--color-muted)]">Subtotal</span>
            <Money value={subtotal} />
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--color-muted)]">VAT</span>
            <Money value={num(vat)} />
          </div>
          <div className="flex justify-between pt-1 border-t border-black/10">
            <span className="font-semibold">Total to pay</span>
            <Money value={total} emphasis="strong" />
          </div>
        </div>

        <Field label="Notes" optional>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="e.g. monthly delivery"
          />
        </Field>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting} disabled={!supplierId}>
          Record invoice
        </Button>
      </DialogFooter>
    </DialogForm>
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
        <Field label="Stock item / description">
          <Select
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
          </Select>
        </Field>
        {!line.stockItemId && (
          <Input
            value={line.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="Description (e.g. Cleaning service Jan)"
            className="mt-2"
          />
        )}
      </div>
      <div className="col-span-4 md:col-span-2">
        <Field label="Qty">
          <Input
            type="number"
            inputMode="decimal"
            step="0.001"
            min="0"
            value={line.quantity}
            onChange={(e) => onChange({ quantity: e.target.value })}
          />
        </Field>
      </div>
      <div className="col-span-3 md:col-span-2">
        <Field label="Unit">
          <Input
            value={line.unit}
            onChange={(e) => onChange({ unit: e.target.value })}
          />
        </Field>
      </div>
      <div className="col-span-5 md:col-span-2">
        <Field label="Unit cost">
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={line.unitCost}
            onChange={(e) => onChange({ unitCost: e.target.value })}
          />
        </Field>
      </div>
      <div className="col-span-9 md:col-span-1 text-right">
        <p className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">Total</p>
        <p className="font-semibold">
          <Money value={total} />
        </p>
      </div>
      <div className="col-span-3 md:col-span-1 text-right">
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-[var(--color-danger)] hover:underline text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-saffron)] rounded"
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
  invoice: PayableDetail | null;
  canManage: boolean;
  onClose: () => void;
  onChanged: (next: PayableDetail) => void;
}) {
  const confirm = useConfirm();
  const [recordOpen, setRecordOpen] = useState(false);
  const [voidPending, setVoidPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Reset transient state when the dialog closes.
  useEffect(() => {
    if (!invoice) {
      setRecordOpen(false);
      setVoidPending(false);
      setErr(null);
    }
  }, [invoice]);

  const open = invoice !== null;
  const badge = invoice
    ? payableStatus({ status: invoice.status, daysOverdue: invoice.daysPastDue })
    : null;

  const onVoid = async () => {
    if (!invoice) return;
    const ok = await confirm({
      title: "Void this invoice?",
      description: "Stock movements will be reversed and the invoice removed from the P&L.",
      confirmLabel: "Void invoice",
      tone: "danger",
    });
    if (!ok) return;
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
    if (!invoice) return;
    const ok = await confirm({
      title: "Reverse this payment?",
      description: "The outstanding balance will go back up.",
      confirmLabel: "Reverse",
      tone: "danger",
    });
    if (!ok) return;
    setErr(null);
    try {
      const next = await deletePayablePayment(invoice.id, paymentId);
      onChanged(next);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not reverse payment");
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="xl"
      ariaLabel={
        invoice
          ? `${invoice.supplier.name}${invoice.invoiceNumber ? ` · ${invoice.invoiceNumber}` : ""}`
          : undefined
      }
    >
      {invoice && badge && (
        <>
          <DialogTitle
            description={
              <span className="inline-flex flex-wrap items-center gap-2">
                <Badge tone={badge.tone}>{badge.label}</Badge>
                <span className="text-[var(--color-muted)]">
                  Invoice {fmtDate(invoice.invoiceDate)} · due {fmtDate(invoice.dueDate)}
                </span>
              </span>
            }
          >
            {invoice.supplier.name}
            {invoice.invoiceNumber ? ` · ${invoice.invoiceNumber}` : ""}
          </DialogTitle>
          <DialogBody className="space-y-5">
            {err && <Alert variant="error">{err}</Alert>}

            <StatGroup cols={{ md: 3, lg: 3 }}>
              <Stat
                label="Total"
                value={<Money value={invoice.total} />}
                emphasis="hero"
              />
              <Stat
                label="Paid"
                value={<Money value={invoice.amountPaid} />}
                tone={invoice.amountPaid > 0 ? "positive" : "neutral"}
              />
              <Stat
                label="Outstanding"
                value={<Money value={invoice.outstanding} />}
                tone={invoice.outstanding > 0 ? "warning" : "neutral"}
              />
            </StatGroup>

            <section aria-labelledby="lines-heading">
              <h3
                id="lines-heading"
                className="text-sm font-semibold mb-2 text-[var(--color-ink)]"
              >
                Lines
              </h3>
              <div className="overflow-x-auto -mx-2">
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
                            <span className="ml-2 text-xs text-[var(--color-muted)]">
                              (stock-linked)
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{l.quantity}</td>
                        <td className="px-2 py-1.5">{l.unit}</td>
                        <td className="px-2 py-1.5 text-right">
                          <Money value={l.unitCost} />
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <Money value={l.lineTotal} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section aria-labelledby="payments-heading">
              <div className="flex items-center justify-between mb-2">
                <h3
                  id="payments-heading"
                  className="text-sm font-semibold text-[var(--color-ink)]"
                >
                  Payments
                </h3>
                {canManage &&
                  invoice.status !== "VOID" &&
                  invoice.status !== "PAID" && (
                    <Button size="sm" onClick={() => setRecordOpen(true)}>
                      + Record payment
                    </Button>
                  )}
              </div>
              {invoice.payments.length === 0 ? (
                <p className="text-sm text-[var(--color-muted)]">No payments yet.</p>
              ) : (
                <div className="overflow-x-auto -mx-2">
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
                          <td className="px-2 py-1.5 text-right">
                            <Money value={p.amount} />
                          </td>
                          <td className="px-2 py-1.5">
                            {p.method.replace("_", " ").toLowerCase()}
                          </td>
                          <td className="px-2 py-1.5 text-[var(--color-muted)]">
                            {p.reference || "—"}
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            {canManage && (
                              <button
                                type="button"
                                onClick={() => void onDeletePayment(p.id)}
                                className="text-sm text-[var(--color-danger)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-saffron)] rounded"
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
            </section>

            {invoice.notes && (
              <section>
                <h3 className="text-sm font-semibold mb-1 text-[var(--color-ink)]">Notes</h3>
                <p className="text-sm text-[var(--color-muted)] whitespace-pre-wrap">
                  {invoice.notes}
                </p>
              </section>
            )}
          </DialogBody>
          <DialogFooter justify="between">
            <div>
              {canManage && invoice.status !== "VOID" && invoice.amountPaid <= 0 && (
                <Button
                  variant="danger"
                  onClick={() => void onVoid()}
                  loading={voidPending}
                >
                  Void invoice
                </Button>
              )}
            </div>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        </>
      )}

      {invoice && (
        <RecordPaymentDialog
          open={recordOpen}
          invoice={invoice}
          onClose={() => setRecordOpen(false)}
          onRecorded={async (next) => {
            setRecordOpen(false);
            onChanged(next);
          }}
        />
      )}
    </Dialog>
  );
}

function RecordPaymentDialog({
  open,
  invoice,
  onClose,
  onRecorded,
}: {
  open: boolean;
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

  // Fresh draft each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setPaymentDate(today);
    setAmount(invoice.outstanding.toFixed(2));
    setMethod("BANK_TRANSFER");
    setReference("");
    setNotes("");
    setErr(null);
  }, [open, invoice.outstanding, today]);

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
    <DialogForm
      open={open}
      onClose={onClose}
      onSubmit={submit}
      size="md"
      dismissOnBackdrop={false}
      ariaLabel="Record payment"
    >
      <DialogTitle
        description={
          <>
            Outstanding <Money value={invoice.outstanding} emphasis="strong" /> on{" "}
            {invoice.supplier.name}
            {invoice.invoiceNumber ? ` · ${invoice.invoiceNumber}` : ""}.
          </>
        }
      >
        Record payment
      </DialogTitle>
      <DialogBody className="space-y-3">
        {err && <Alert variant="error">{err}</Alert>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Payment date" required>
            <Input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              min={invoice.invoiceDate}
              max={today}
            />
          </Field>
          <Field label="Amount (PLN)" required hint={`Max ${invoice.outstanding.toFixed(2)}`}>
            <Input
              autoFocus
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              max={invoice.outstanding}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label="Method" required>
            <Select
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reference" optional>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. transfer id, cheque #"
            />
          </Field>
        </div>
        <Field label="Notes" optional>
          <Textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          Record payment
        </Button>
      </DialogFooter>
    </DialogForm>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Supplier dialog
// ───────────────────────────────────────────────────────────────────────────

function SupplierDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
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

  useEffect(() => {
    if (!open) return;
    setName("");
    setContactName("");
    setPhone("");
    setEmail("");
    setVatId("");
    setPaymentTermsDays("7");
    setErr(null);
  }, [open]);

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
    <DialogForm
      open={open}
      onClose={onClose}
      onSubmit={submit}
      size="md"
      dismissOnBackdrop={false}
      ariaLabel="New supplier"
    >
      <DialogTitle>New supplier</DialogTitle>
      <DialogBody className="space-y-3">
        {err && <Alert variant="error">{err}</Alert>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Name" required>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Makro"
            />
          </Field>
          <Field label="Contact" optional>
            <Input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
            />
          </Field>
          <Field label="Phone" optional>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="Email" optional>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="VAT id" optional>
            <Input value={vatId} onChange={(e) => setVatId(e.target.value)} />
          </Field>
          <Field
            label="Default payment terms"
            required
            hint="Days from invoice date until due."
          >
            <Input
              type="number"
              min="0"
              max="365"
              value={paymentTermsDays}
              onChange={(e) => setPaymentTermsDays(e.target.value)}
            />
          </Field>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          Create supplier
        </Button>
      </DialogFooter>
    </DialogForm>
  );
}

