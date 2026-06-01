import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fmt } from "../../lib/calc";
import { todayLocalIso } from "../../lib/dates";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api/client";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { EmptyState } from "../../components/ui/EmptyState";
import { Spinner } from "../../components/ui/Spinner";
import { Badge } from "../../components/ui/Badge";
import type { User } from "../../types";
import {
  deleteOwnerExpenseReceipt,
  deleteOwnerReimbursement,
  fileOwnerExpense,
  getOwnerExpense,
  listOwnerExpenses,
  ownerExpenseReceiptUrl,
  recordOwnerReimbursement,
  updateOwnerExpense,
  updateOwnerReimbursement,
  uploadOwnerExpenseReceipt,
  voidOwnerExpense,
  type FileOwnerExpenseInput,
  type OwnerExpenseDetail,
  type OwnerExpenseListResponse,
  type OwnerExpenseReimbursement as OwnerExpenseReimbursementRow,
  type OwnerExpenseStatus,
  type OwnerExpenseSummary,
  type RecordReimbursementInput,
} from "../../api/ownerExpenses";
import type { PayableCategory, PaymentMethod } from "../../api/payables";

type Tab = "PENDING" | "REIMBURSED" | "VOID" | "ALL";

const TAB_DEFS: { id: Tab; label: string }[] = [
  { id: "PENDING", label: "Outstanding" },
  { id: "REIMBURSED", label: "Reimbursed" },
  { id: "VOID", label: "Cancelled" },
  { id: "ALL", label: "All" },
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
  { value: "STAFF_MEALS", label: "Staff meals" },
  { value: "PETTY_CASH", label: "Petty cash" },
  { value: "OTHER", label: "Other" },
];

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "CARD", label: "Card" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "OTHER", label: "Other" },
];

const statusBadge = (s: OwnerExpenseStatus) => {
  if (s === "VOID") return { variant: "inactive" as const, label: "Cancelled" };
  if (s === "REIMBURSED") return { variant: "locked" as const, label: "Reimbursed" };
  if (s === "PARTIAL") return { variant: "draft" as const, label: "Partial" };
  return { variant: "neutral" as const, label: "Pending" };
};

const fmtDate = (iso: string) => {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
};

const num = (s: string): number => {
  const v = Number((s || "").replace(",", "."));
  return Number.isFinite(v) ? v : 0;
};

export function AdminOwnerExpenses() {
  const { user, hasPermission } = useAuth();
  const canManage = hasPermission("OWNER_EXPENSES_MANAGE");
  const canFile =
    canManage || hasPermission("OWNER_EXPENSES_FILE") || user?.role === "ADMIN";

  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>("PENDING");
  const [data, setData] = useState<OwnerExpenseListResponse | null>(null);
  const [users, setUsers] = useState<User[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [detail, setDetail] = useState<OwnerExpenseDetail | null>(null);
  const [ownerFilter, setOwnerFilter] = useState<string>("");

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listOwnerExpenses(tab, ownerFilter || undefined);
      setData(list);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to load owner expenses";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, ownerFilter]);

  useEffect(() => {
    let cancelled = false;
    api<User[]>("/users")
      .then((u) => {
        if (!cancelled) setUsers(u);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Deep-link from the Finance ledger ("Manage →" on an owner-paid
  // row) lands here with ?focus=<id>. Open that expense's detail
  // drawer once and clear the query so reloads behave normally.
  const focusedRef = useRef<string | null>(null);
  useEffect(() => {
    const id = searchParams.get("focus");
    if (!id || focusedRef.current === id) return;
    focusedRef.current = id;
    void (async () => {
      try {
        const d = await getOwnerExpense(id);
        setDetail(d);
      } catch {
        // Silently swallow — invalid id, no permission, etc.
      } finally {
        const next = new URLSearchParams(searchParams);
        next.delete("focus");
        setSearchParams(next, { replace: true });
      }
    })();
  }, [searchParams, setSearchParams]);

  // Owners are typically admins, but the manager role can also have
  // OWNER_EXPENSES_FILE granted — so we include any active user as a
  // candidate. The list is short and friendlier than a hidden ID input.
  const ownerOptions = useMemo(
    () => (users ?? []).filter((u) => u.active !== false),
    [users],
  );

  const openDetail = async (id: string) => {
    try {
      const d = await getOwnerExpense(id);
      setDetail(d);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to load expense";
      setError(message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Owner reimbursements"
        subtitle="Money the restaurant owes its owner(s) for out-of-pocket payments. Filing here recognises the expense on the P&L on its expense date; reimbursing posts the cash event later."
      />

      {error && (
        <Alert variant="error" className="mb-2">
          {error}
        </Alert>
      )}

      {/* Top summary: who do we owe what? */}
      {data && data.byOwner.length > 0 && (
        <Card>
          <div className="p-4 md:p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[var(--color-ink)]">
                Outstanding by owner
              </h3>
              <span className="text-sm text-[var(--color-muted)]">
                Total: <span className="font-semibold text-[var(--color-ink)]">{fmt(data.totals.outstanding)}</span>
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {data.byOwner.map((row) => (
                <button
                  key={row.ownerUserId}
                  type="button"
                  onClick={() =>
                    setOwnerFilter(
                      ownerFilter === row.ownerUserId ? "" : row.ownerUserId,
                    )
                  }
                  className={`text-left rounded-lg px-3 py-2 border transition-colors ${
                    ownerFilter === row.ownerUserId
                      ? "border-[var(--color-saffron)] bg-[var(--color-saffron)]/10"
                      : "border-black/10 hover:bg-black/[0.03]"
                  }`}
                >
                  <div className="text-xs text-[var(--color-muted)]">{row.ownerName}</div>
                  <div className="text-base font-semibold text-[var(--color-ink)]">
                    {fmt(row.outstanding)}
                  </div>
                </button>
              ))}
            </div>
            {ownerFilter && (
              <button
                type="button"
                onClick={() => setOwnerFilter("")}
                className="mt-3 text-xs text-[var(--color-saffron)] hover:underline"
              >
                Clear owner filter
              </button>
            )}
          </div>
        </Card>
      )}

      {/* Toolbar */}
      <Card>
        <div className="p-3 md:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1">
            {TAB_DEFS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  tab === t.id
                    ? "bg-[var(--color-saffron)] text-white"
                    : "text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-black/[0.04]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button onClick={() => void reload()} variant="secondary">
              Refresh
            </Button>
            {canFile && (
              <Button onClick={() => setOpenCreate(true)}>+ I paid for something</Button>
            )}
          </div>
        </div>
      </Card>

      {/* List */}
      <Card>
        {loading ? (
          <div className="p-8 flex justify-center">
            <Spinner />
          </div>
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            title="Nothing here yet"
            description={
              tab === "PENDING"
                ? "No outstanding owner-paid expenses. When an owner covers a restaurant bill from their own pocket, file it here so it can be reimbursed and reflected in the P&L."
                : "No matching records."
            }
          />
        ) : (
          <div className="divide-y divide-black/[0.06]">
            {data.items.map((row) => (
              <ListRow key={row.id} row={row} onOpen={() => void openDetail(row.id)} />
            ))}
          </div>
        )}
      </Card>

      {/* Create dialog */}
      {openCreate && (
        <CreateExpenseDialog
          onClose={() => setOpenCreate(false)}
          onCreated={() => {
            setOpenCreate(false);
            void reload();
          }}
          defaultOwnerId={user?.id ?? ""}
          ownerOptions={ownerOptions}
          canPickOwner={canManage}
        />
      )}

      {/* Detail drawer */}
      {detail && (
        <DetailDrawer
          detail={detail}
          ownerOptions={ownerOptions}
          canManage={canManage}
          canFile={canFile}
          onClose={() => setDetail(null)}
          onChanged={async () => {
            const refreshed = await getOwnerExpense(detail.id);
            setDetail(refreshed);
            void reload();
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// List row
// ============================================================================

function ListRow({
  row,
  onOpen,
}: {
  row: OwnerExpenseSummary;
  onOpen: () => void;
}) {
  const badge = statusBadge(row.status);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left p-4 hover:bg-black/[0.03] transition-colors flex flex-col md:flex-row md:items-center gap-3"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant={badge.variant}>{badge.label}</Badge>
          <span className="text-xs text-[var(--color-muted)]">
            {fmtDate(row.expenseDate)}
          </span>
          <span className="text-xs text-[var(--color-muted)]">·</span>
          <span className="text-xs text-[var(--color-muted)]">{row.category}</span>
        </div>
        <div className="text-sm font-medium text-[var(--color-ink)] truncate">
          {row.description}
        </div>
        <div className="text-xs text-[var(--color-muted)] mt-0.5">
          Paid by <span className="font-medium">{row.ownerName}</span>
          {row.reference ? ` · Ref ${row.reference}` : ""}
          {row.receiptCount > 0
            ? ` · 📎 ${row.receiptCount} receipt${row.receiptCount === 1 ? "" : "s"}`
            : ""}
        </div>
      </div>
      <div className="text-right">
        <div className="text-base font-semibold text-[var(--color-ink)]">
          {fmt(row.total)}
        </div>
        {row.status !== "VOID" && row.outstanding > 0 && (
          <div className="text-xs text-[var(--color-muted)]">
            {fmt(row.outstanding)} owed
          </div>
        )}
      </div>
    </button>
  );
}

// ============================================================================
// Create dialog
// ============================================================================

function CreateExpenseDialog({
  onClose,
  onCreated,
  defaultOwnerId,
  ownerOptions,
  canPickOwner,
}: {
  onClose: () => void;
  onCreated: () => void;
  defaultOwnerId: string;
  ownerOptions: User[];
  canPickOwner: boolean;
}) {
  const [ownerUserId, setOwnerUserId] = useState(defaultOwnerId);
  const [expenseDate, setExpenseDate] = useState(todayLocalIso());
  const [category, setCategory] = useState<PayableCategory>("SUPPLIES");
  const [description, setDescription] = useState("");
  const [total, setTotal] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [receiptFiles, setReceiptFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!description.trim()) {
      setErr("Describe what you paid for so the audit log makes sense later.");
      return;
    }
    const amount = num(total);
    if (amount <= 0) {
      setErr("Enter the amount you paid.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const body: FileOwnerExpenseInput = {
        ownerUserId: canPickOwner && ownerUserId ? ownerUserId : null,
        expenseDate,
        category,
        description: description.trim(),
        total: amount,
        reference: reference.trim() || null,
        notes: notes.trim() || null,
      };
      const created = await fileOwnerExpense(body);
      // Upload receipts after the expense exists. We swallow per-file
      // errors into the dialog rather than rolling back — the expense
      // is filed, the user can retry the upload from the detail view.
      for (const f of receiptFiles) {
        try {
          await uploadOwnerExpenseReceipt(created.id, f);
        } catch (uploadErr: unknown) {
          const m = uploadErr instanceof Error ? uploadErr.message : "Upload failed";
          setErr(`Filed but couldn't attach "${f.name}": ${m}`);
        }
      }
      onCreated();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to file expense";
      setErr(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogShell title="File owner-paid expense" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {err && (
          <Alert variant="error">{err}</Alert>
        )}
        {canPickOwner && ownerOptions.length > 0 && (
          <Field label="Paid by">
            <select
              className="field-input"
              value={ownerUserId}
              onChange={(e) => setOwnerUserId(e.target.value)}
            >
              {ownerOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Expense date">
            <input
              type="date"
              className="field-input"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              required
            />
          </Field>
          <Field label="Category">
            <select
              className="field-input"
              value={category}
              onChange={(e) => setCategory(e.target.value as PayableCategory)}
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="What did you pay for?">
          <input
            className="field-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Cleaning supplies at Carrefour"
            required
            maxLength={300}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount">
            <input
              className="field-input"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              required
            />
          </Field>
          <Field label="Reference (optional)">
            <input
              className="field-input"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="receipt #, bank ref"
              maxLength={120}
            />
          </Field>
        </div>
        <Field label="Notes (optional)">
          <textarea
            className="field-input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={1000}
          />
        </Field>
        <Field label="Receipt photos / PDFs (optional but recommended)">
          <div className="space-y-2">
            <input
              type="file"
              accept="image/*,application/pdf"
              multiple
              onChange={(e) => {
                const list = e.target.files ? Array.from(e.target.files) : [];
                setReceiptFiles((prev) => [...prev, ...list]);
                e.target.value = "";
              }}
              className="text-sm"
            />
            {receiptFiles.length > 0 && (
              <ul className="text-xs text-[var(--color-muted)] space-y-1">
                {receiptFiles.map((f, idx) => (
                  <li key={`${f.name}-${idx}`} className="flex items-center justify-between gap-2">
                    <span className="truncate">📎 {f.name}</span>
                    <button
                      type="button"
                      className="text-[var(--color-saffron)] hover:underline"
                      onClick={() =>
                        setReceiptFiles((prev) => prev.filter((_, i) => i !== idx))
                      }
                    >
                      remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-[var(--color-muted)]">
              JPG, PNG, WEBP or PDF — proof of the receipt for the books.
            </p>
          </div>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Filing…" : "File expense"}
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}

// ============================================================================
// Detail drawer
// ============================================================================

function DetailDrawer({
  detail,
  ownerOptions,
  canManage,
  canFile,
  onClose,
  onChanged,
}: {
  detail: OwnerExpenseDetail;
  ownerOptions: User[];
  canManage: boolean;
  canFile: boolean;
  onClose: () => void;
  onChanged: () => void | Promise<void>;
}) {
  const [reimbOpen, setReimbOpen] = useState(false);
  const [editExpenseOpen, setEditExpenseOpen] = useState(false);
  const [editingReimb, setEditingReimb] = useState<OwnerExpenseReimbursementRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const badge = statusBadge(detail.status);
  const ownerName =
    detail.ownerName ||
    ownerOptions.find((u) => u.id === detail.ownerUserId)?.name ||
    "Unknown";

  const doVoid = async () => {
    if (busy) return;
    if (
      !window.confirm(
        "Cancel this expense? It will be removed from the P&L. This is only available before any reimbursement is recorded.",
      )
    ) {
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await voidOwnerExpense(detail.id);
      await onChanged();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to cancel";
      setErr(message);
    } finally {
      setBusy(false);
    }
  };

  const reverseReimbursement = async (rid: string) => {
    if (busy) return;
    if (!window.confirm("Reverse this reimbursement? The amount will return to outstanding.")) {
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await deleteOwnerReimbursement(detail.id, rid);
      await onChanged();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to reverse";
      setErr(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogShell title={detail.description} onClose={onClose} wide>
      <div className="space-y-4">
        {err && (
          <Alert variant="error">{err}</Alert>
        )}

        {canManage && detail.status !== "VOID" && (
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setEditExpenseOpen(true)}>
              Edit details
            </Button>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatBox label="Status">
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </StatBox>
          <StatBox label="Total">{fmt(detail.total)}</StatBox>
          <StatBox label="Reimbursed">{fmt(detail.amountReimbursed)}</StatBox>
          <StatBox label="Outstanding">
            <span
              className={
                detail.outstanding > 0
                  ? "font-semibold text-[var(--color-ink)]"
                  : "text-[var(--color-muted)]"
              }
            >
              {fmt(detail.outstanding)}
            </span>
          </StatBox>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <Row label="Paid by">{ownerName}</Row>
          <Row label="Expense date">{fmtDate(detail.expenseDate)}</Row>
          <Row label="Category">{detail.category}</Row>
          {detail.reference && <Row label="Reference">{detail.reference}</Row>}
          {detail.notes && <Row label="Notes">{detail.notes}</Row>}
        </div>

        {/* Receipts */}
        <ReceiptsSection
          detail={detail}
          canEdit={(canManage || canFile) && detail.status !== "VOID"}
          busy={busy}
          setBusy={setBusy}
          setErr={setErr}
          onChanged={onChanged}
        />

        {/* Reimbursements history */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-[var(--color-ink)]">Reimbursements</h3>
            {canManage && detail.status !== "VOID" && detail.status !== "REIMBURSED" && (
              <Button onClick={() => setReimbOpen(true)} variant="secondary">
                + Record reimbursement
              </Button>
            )}
          </div>
          {detail.reimbursements.length === 0 ? (
            <div className="rounded-lg border border-black/[0.06] bg-black/[0.02] p-4 text-sm text-[var(--color-muted)]">
              No reimbursements yet — the restaurant still owes the owner the full amount.
            </div>
          ) : (
            <div className="rounded-lg border border-black/[0.06] divide-y divide-black/[0.06]">
              {detail.reimbursements.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3"
                >
                  <div className="text-sm">
                    <div className="font-medium text-[var(--color-ink)]">
                      {fmt(r.amount)}{" "}
                      <span className="text-xs text-[var(--color-muted)] font-normal">
                        · {fmtDate(r.paidDate)} · {r.method}
                      </span>
                    </div>
                    {(r.reference || r.notes) && (
                      <div className="text-xs text-[var(--color-muted)] mt-0.5">
                        {r.reference ? `Ref ${r.reference}` : ""}
                        {r.reference && r.notes ? " · " : ""}
                        {r.notes ?? ""}
                      </div>
                    )}
                  </div>
                  {canManage && (
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="secondary"
                        onClick={() => setEditingReimb(r)}
                        disabled={busy}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => void reverseReimbursement(r.id)}
                        disabled={busy}
                      >
                        Reverse
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer actions */}
        {canManage &&
          detail.status !== "VOID" &&
          detail.amountReimbursed === 0 && (
            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => void doVoid()} disabled={busy}>
                Cancel expense
              </Button>
            </div>
          )}
      </div>

      {reimbOpen && (
        <RecordReimbursementDialog
          detail={detail}
          onClose={() => setReimbOpen(false)}
          onRecorded={async () => {
            setReimbOpen(false);
            await onChanged();
          }}
        />
      )}

      {editExpenseOpen && (
        <EditExpenseDialog
          detail={detail}
          onClose={() => setEditExpenseOpen(false)}
          onSaved={async () => {
            setEditExpenseOpen(false);
            await onChanged();
          }}
        />
      )}

      {editingReimb && (
        <EditReimbursementDialog
          detail={detail}
          reimb={editingReimb}
          onClose={() => setEditingReimb(null)}
          onSaved={async () => {
            setEditingReimb(null);
            await onChanged();
          }}
        />
      )}
    </DialogShell>
  );
}

function RecordReimbursementDialog({
  detail,
  onClose,
  onRecorded,
}: {
  detail: OwnerExpenseDetail;
  onClose: () => void;
  onRecorded: () => void | Promise<void>;
}) {
  const [paidDate, setPaidDate] = useState(todayLocalIso());
  const [amount, setAmount] = useState(detail.outstanding.toFixed(2));
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const a = num(amount);
    if (a <= 0) {
      setErr("Enter the amount being paid back.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const input: RecordReimbursementInput = {
        paidDate,
        amount: a,
        method,
        reference: reference.trim() || null,
        notes: notes.trim() || null,
      };
      await recordOwnerReimbursement(detail.id, input);
      await onRecorded();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to record";
      setErr(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogShell title="Record reimbursement" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {err && (
          <Alert variant="error">{err}</Alert>
        )}
        <div className="text-sm text-[var(--color-muted)]">
          Reimbursing <span className="font-medium text-[var(--color-ink)]">{detail.ownerName}</span>{" "}
          for <span className="font-medium text-[var(--color-ink)]">{detail.description}</span>.
          Outstanding:{" "}
          <span className="font-semibold text-[var(--color-ink)]">{fmt(detail.outstanding)}</span>.
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date paid">
            <input
              type="date"
              className="field-input"
              value={paidDate}
              onChange={(e) => setPaidDate(e.target.value)}
              required
            />
          </Field>
          <Field label="Method">
            <select
              className="field-input"
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Amount">
          <input
            className="field-input"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            required
          />
        </Field>
        <Field label="Reference (optional)">
          <input
            className="field-input"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="bank ref, cheque no"
            maxLength={120}
          />
        </Field>
        <Field label="Notes (optional)">
          <textarea
            className="field-input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={1000}
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Record reimbursement"}
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}

// ============================================================================
// Edit expense (parent) dialog
// ============================================================================

function EditExpenseDialog({
  detail,
  onClose,
  onSaved,
}: {
  detail: OwnerExpenseDetail;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [expenseDate, setExpenseDate] = useState(detail.expenseDate);
  const [category, setCategory] = useState<PayableCategory>(detail.category);
  const [description, setDescription] = useState(detail.description);
  const [total, setTotal] = useState(detail.total.toFixed(2));
  const [reference, setReference] = useState(detail.reference ?? "");
  const [notes, setNotes] = useState(detail.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Total is locked once any reimbursement has been recorded —
  // reverse reimbursements first if you need to change the principal.
  const totalLocked = detail.amountReimbursed > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!description.trim()) {
      setErr("Description is required.");
      return;
    }
    const t = num(total);
    if (!totalLocked && t <= 0) {
      setErr("Amount must be greater than zero.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await updateOwnerExpense(detail.id, {
        expenseDate,
        category,
        description: description.trim(),
        ...(totalLocked ? {} : { total: t }),
        reference: reference.trim() || null,
        notes: notes.trim() || null,
      });
      await onSaved();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to save";
      setErr(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogShell title="Edit owner expense" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {err && <Alert variant="error">{err}</Alert>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Expense date">
            <input
              type="date"
              className="field-input"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              required
            />
          </Field>
          <Field label="Category">
            <select
              className="field-input"
              value={category}
              onChange={(e) => setCategory(e.target.value as PayableCategory)}
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Description">
          <input
            className="field-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={300}
            required
          />
        </Field>
        <Field label={totalLocked ? "Amount (locked — reverse reimbursements to edit)" : "Amount"}>
          <input
            className="field-input"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            inputMode="decimal"
            disabled={totalLocked}
            required
          />
        </Field>
        <Field label="Reference (optional)">
          <input
            className="field-input"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            maxLength={120}
          />
        </Field>
        <Field label="Notes (optional)">
          <textarea
            className="field-input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={1000}
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}

// ============================================================================
// Edit reimbursement dialog
// ============================================================================

function EditReimbursementDialog({
  detail,
  reimb,
  onClose,
  onSaved,
}: {
  detail: OwnerExpenseDetail;
  reimb: OwnerExpenseReimbursementRow;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [paidDate, setPaidDate] = useState(reimb.paidDate);
  const [amount, setAmount] = useState(reimb.amount.toFixed(2));
  const [method, setMethod] = useState<PaymentMethod>(reimb.method);
  const [reference, setReference] = useState(reimb.reference ?? "");
  const [notes, setNotes] = useState(reimb.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Maximum allowed amount: outstanding + this reimbursement's
  // current contribution (since we're swapping it out).
  const maxAmount = detail.outstanding + reimb.amount;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const a = num(amount);
    if (a <= 0) {
      setErr("Amount must be greater than zero.");
      return;
    }
    if (a > maxAmount + 0.001) {
      setErr(
        `Amount can be at most ${maxAmount.toFixed(2)} — that's the outstanding balance plus this reimbursement's current value.`,
      );
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await updateOwnerReimbursement(detail.id, reimb.id, {
        paidDate,
        amount: a,
        method,
        reference: reference.trim() || null,
        notes: notes.trim() || null,
      });
      await onSaved();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to save";
      setErr(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogShell title="Edit reimbursement" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {err && <Alert variant="error">{err}</Alert>}
        <div className="text-sm text-[var(--color-muted)]">
          Reimbursing{" "}
          <span className="font-medium text-[var(--color-ink)]">{detail.ownerName}</span>{" "}
          for <span className="font-medium text-[var(--color-ink)]">{detail.description}</span>.
          Max amount allowed:{" "}
          <span className="font-semibold text-[var(--color-ink)]">{fmt(maxAmount)}</span>.
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date paid">
            <input
              type="date"
              className="field-input"
              value={paidDate}
              onChange={(e) => setPaidDate(e.target.value)}
              required
            />
          </Field>
          <Field label="Method">
            <select
              className="field-input"
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Amount">
          <input
            className="field-input"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            required
          />
        </Field>
        <Field label="Reference (optional)">
          <input
            className="field-input"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            maxLength={120}
          />
        </Field>
        <Field label="Notes (optional)">
          <textarea
            className="field-input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={1000}
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}

// ============================================================================
// Receipts panel inside the detail drawer
// ============================================================================

function ReceiptsSection({
  detail,
  canEdit,
  busy,
  setBusy,
  setErr,
  onChanged,
}: {
  detail: OwnerExpenseDetail;
  canEdit: boolean;
  busy: boolean;
  setBusy: (v: boolean) => void;
  setErr: (v: string | null) => void;
  onChanged: () => void | Promise<void>;
}) {
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (busy) return;
    const list = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = "";
    if (list.length === 0) return;
    setBusy(true);
    setErr(null);
    try {
      // Sequential to keep error reporting clear and avoid hammering
      // the disk on a list of huge PDFs.
      for (const f of list) {
        await uploadOwnerExpenseReceipt(detail.id, f);
      }
      await onChanged();
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : "Upload failed";
      setErr(m);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (fileId: string) => {
    if (busy) return;
    if (!window.confirm("Remove this receipt? The file will be deleted.")) return;
    setBusy(true);
    setErr(null);
    try {
      await deleteOwnerExpenseReceipt(detail.id, fileId);
      await onChanged();
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : "Delete failed";
      setErr(m);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-[var(--color-ink)]">Receipts</h3>
        {canEdit && (
          <label className="cursor-pointer text-xs px-3 py-1.5 rounded-md border border-black/10 hover:bg-black/[0.04] text-[var(--color-ink)]">
            + Add receipt
            <input
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => void handleUpload(e)}
              disabled={busy}
            />
          </label>
        )}
      </div>
      {detail.receipts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-black/[0.12] bg-black/[0.02] p-4 text-sm text-[var(--color-muted)]">
          No receipts attached yet — upload a photo or PDF as proof.
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {detail.receipts.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-black/[0.06] p-2.5"
            >
              <a
                href={ownerExpenseReceiptUrl(r.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-0 text-sm text-[var(--color-ink)] hover:text-[var(--color-saffron)] truncate"
                title={r.filename}
              >
                📎 {r.filename}
              </a>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => void handleDelete(r.id)}
                  className="text-xs text-[var(--color-muted)] hover:text-[var(--color-danger)]"
                  disabled={busy}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ============================================================================
// Tiny helpers
// ============================================================================

function StatBox({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-black/[0.06] bg-black/[0.02] p-3">
      <div className="text-xs text-[var(--color-muted)] mb-1">{label}</div>
      <div className="text-sm font-semibold text-[var(--color-ink)]">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-black/[0.04] py-1.5">
      <span className="text-[var(--color-muted)]">{label}</span>
      <span className="text-[var(--color-ink)] text-right">{children}</span>
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
      <span className="block text-xs font-medium text-[var(--color-muted)] mb-1">
        {label}
      </span>
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
