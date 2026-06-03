import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { todayLocalIso } from "../../lib/dates";
import { useAuth } from "../../context/AuthContext";
import { useConfirm } from "../../context/ConfirmContext";
import { ownerExpenseStatus } from "../../lib/statusBadges";
import { parseMoneyInput } from "../../lib/numbers";
import { api } from "../../api/client";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { EmptyState } from "../../components/ui/EmptyState";
import { Spinner } from "../../components/ui/Spinner";
import { Badge } from "../../components/ui/Badge";
import { Money } from "../../components/ui/Money";
import { Stat, StatGroup } from "../../components/ui/Stat";
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
import { IconPaperclip } from "../../components/icons";
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

const fmtDate = (iso: string) => {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
};

/** Coerce a typed-money string (PL-style "12,5" or "12.5") to a number,
 *  falling back to 0 when the value is invalid. Mirrors the local
 *  helper used throughout the file. */
const num = (s: string): number => {
  const parsed = parseMoneyInput(s);
  return parsed === null ? 0 : parsed;
};

export function AdminOwnerExpenses({ asTab }: { asTab?: boolean } = {}) {
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
    <>
      {!asTab ? (
        <PageHeader
          kicker="Finance"
          title="Owner reimbursements"
          subtitle="Money the restaurant owes its owner(s) for out-of-pocket payments. Filing here recognises the expense on the P&L on its expense date; reimbursing posts the cash event later."
          action={
            canFile ? (
              <Button onClick={() => setOpenCreate(true)}>+ I paid for something</Button>
            ) : null
          }
          tabs={TAB_DEFS.map((t) => ({
            id: t.id,
            label: t.label,
            active: tab === t.id,
            onClick: () => setTab(t.id),
          }))}
        />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex gap-1">
            {TAB_DEFS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                  tab === t.id
                    ? "bg-[var(--color-saffron)] border-[var(--color-saffron)] text-white"
                    : "bg-white border-black/10"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {canFile && (
            <Button size="sm" onClick={() => setOpenCreate(true)}>
              + I paid for something
            </Button>
          )}
        </div>
      )}

      {error && (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      )}

      {/* Top summary: who do we owe what? Each owner is an interactive
          Stat tile that filters the list when clicked. */}
      {data && data.byOwner.length > 0 && (
        <Card padding="md" className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[var(--color-ink)]">
              Outstanding by owner
            </h2>
            <span className="text-sm text-[var(--color-muted)]">
              Total{" "}
              <Money value={data.totals.outstanding} emphasis="strong" />
            </span>
          </div>
          <StatGroup cols={{ md: 3, lg: 4 }}>
            {data.byOwner.map((row) => (
              <Stat
                key={row.ownerUserId}
                label={row.ownerName}
                value={<Money value={row.outstanding} />}
                tone={row.outstanding > 0 ? "brand" : "neutral"}
                active={ownerFilter === row.ownerUserId}
                onClick={() =>
                  setOwnerFilter(
                    ownerFilter === row.ownerUserId ? "" : row.ownerUserId,
                  )
                }
              />
            ))}
          </StatGroup>
          {ownerFilter && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setOwnerFilter("")}
                className="text-xs text-[var(--color-saffron)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-saffron)] rounded"
              >
                Clear owner filter
              </button>
            </div>
          )}
        </Card>
      )}

      {/* List */}
      <Card padding="none">
        {loading ? (
          <div className="p-8">
            <Spinner />
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="Nothing here yet"
              description={
                tab === "PENDING"
                  ? "No outstanding owner-paid expenses. When an owner covers a restaurant bill from their own pocket, file it here so it can be reimbursed and reflected in the P&L."
                  : "No matching records."
              }
              action={
                canFile && tab === "PENDING" ? (
                  <Button onClick={() => setOpenCreate(true)}>+ File one now</Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-black/[0.06]">
            {data.items.map((row) => (
              <ListRow key={row.id} row={row} onOpen={() => void openDetail(row.id)} />
            ))}
          </div>
        )}
      </Card>

      {/* Create dialog */}
      <CreateExpenseDialog
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        onCreated={() => {
          setOpenCreate(false);
          void reload();
        }}
        defaultOwnerId={user?.id ?? ""}
        ownerOptions={ownerOptions}
        canPickOwner={canManage}
      />

      {/* Detail dialog */}
      <DetailDrawer
        detail={detail}
        ownerOptions={ownerOptions}
        canManage={canManage}
        canFile={canFile}
        onClose={() => setDetail(null)}
        onChanged={async () => {
          if (!detail) return;
          const refreshed = await getOwnerExpense(detail.id);
          setDetail(refreshed);
          void reload();
        }}
      />
    </>
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
  const badge = ownerExpenseStatus(row.status);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left p-4 hover:bg-black/[0.03] transition-colors flex flex-col md:flex-row md:items-center gap-3 focus-visible:outline-none focus-visible:bg-black/[0.03] focus-visible:ring-2 focus-visible:ring-[var(--color-saffron)] focus-visible:ring-inset"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge tone={badge.tone}>{badge.label}</Badge>
          <span className="text-xs text-[var(--color-muted)]">
            {fmtDate(row.expenseDate)}
          </span>
          <span className="text-xs text-[var(--color-muted)]" aria-hidden="true">
            ·
          </span>
          <span className="text-xs text-[var(--color-muted)]">{row.category}</span>
        </div>
        <div className="text-sm font-medium text-[var(--color-ink)] truncate">
          {row.description}
        </div>
        <div className="text-xs text-[var(--color-muted)] mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span>
            Paid by <span className="font-medium">{row.ownerName}</span>
          </span>
          {row.reference ? <span>· Ref {row.reference}</span> : null}
          {row.receiptCount > 0 ? (
            <span className="inline-flex items-center gap-1">
              <span aria-hidden="true">·</span>
              <IconPaperclip className="w-3 h-3" />
              {row.receiptCount} receipt{row.receiptCount === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
      </div>
      <div className="text-right shrink-0 w-28 md:w-32">
        <div className="text-base font-semibold text-[var(--color-ink)] tabular-nums">
          <Money value={row.total} />
        </div>
        {row.status !== "VOID" && row.outstanding > 0 && (
          <div className="text-xs text-[var(--color-muted)] tabular-nums">
            <Money value={row.outstanding} /> owed
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
  open,
  onClose,
  onCreated,
  defaultOwnerId,
  ownerOptions,
  canPickOwner,
}: {
  open: boolean;
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

  // Reset when the dialog re-opens so each filing starts fresh.
  useEffect(() => {
    if (!open) return;
    setOwnerUserId(defaultOwnerId);
    setExpenseDate(todayLocalIso());
    setCategory("SUPPLIES");
    setDescription("");
    setTotal("");
    setReference("");
    setNotes("");
    setReceiptFiles([]);
    setErr(null);
  }, [open, defaultOwnerId]);

  const submit = async () => {
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
    <DialogForm
      open={open}
      onClose={onClose}
      onSubmit={submit}
      size="lg"
      dismissOnBackdrop={false}
      ariaLabel="File owner-paid expense"
    >
      <DialogTitle>File owner-paid expense</DialogTitle>
      <DialogBody className="space-y-3">
        {err && <Alert variant="error">{err}</Alert>}
        {canPickOwner && ownerOptions.length > 0 && (
          <Field label="Paid by">
            <Select value={ownerUserId} onChange={(e) => setOwnerUserId(e.target.value)}>
              {ownerOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </Select>
          </Field>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Expense date" required>
            <Input
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              max={todayLocalIso()}
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
        </div>
        <Field label="What did you pay for?" required>
          <Input
            autoFocus
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Cleaning supplies at Carrefour"
            maxLength={300}
          />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Amount (PLN)" required>
            <Input
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
            />
          </Field>
          <Field label="Reference" optional hint="Receipt number or bank reference">
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="receipt #, bank ref"
              maxLength={120}
            />
          </Field>
        </div>
        <Field label="Notes" optional>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={1000}
          />
        </Field>
        <Field
          label="Receipt photos / PDFs"
          optional
          hint="JPG, PNG, WEBP or PDF — proof of the receipt for the books."
        >
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
                    <span className="inline-flex items-center gap-1.5 truncate">
                      <IconPaperclip className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{f.name}</span>
                    </span>
                    <button
                      type="button"
                      className="text-[var(--color-saffron)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-saffron)] rounded"
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
          </div>
        </Field>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          File expense
        </Button>
      </DialogFooter>
    </DialogForm>
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
  detail: OwnerExpenseDetail | null;
  ownerOptions: User[];
  canManage: boolean;
  canFile: boolean;
  onClose: () => void;
  onChanged: () => void | Promise<void>;
}) {
  const confirm = useConfirm();
  const [reimbOpen, setReimbOpen] = useState(false);
  const [editExpenseOpen, setEditExpenseOpen] = useState(false);
  const [editingReimb, setEditingReimb] = useState<OwnerExpenseReimbursementRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Reset transient state when the dialog closes / changes record.
  useEffect(() => {
    if (!detail) {
      setReimbOpen(false);
      setEditExpenseOpen(false);
      setEditingReimb(null);
      setErr(null);
      setBusy(false);
    }
  }, [detail]);

  const open = detail !== null;
  const badge = detail ? ownerExpenseStatus(detail.status) : null;
  const ownerName = detail
    ? detail.ownerName ||
      ownerOptions.find((u) => u.id === detail.ownerUserId)?.name ||
      "Unknown"
    : "";

  const doVoid = async () => {
    if (!detail || busy) return;
    const ok = await confirm({
      title: "Cancel this expense?",
      description:
        "It will be removed from the P&L. This is only available before any reimbursement is recorded.",
      confirmLabel: "Cancel expense",
      cancelLabel: "Keep it",
      tone: "danger",
    });
    if (!ok) return;
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
    if (!detail || busy) return;
    const ok = await confirm({
      title: "Reverse this reimbursement?",
      description: "The amount will return to outstanding.",
      confirmLabel: "Reverse",
      tone: "danger",
    });
    if (!ok) return;
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
    <Dialog open={open} onClose={onClose} size="lg" ariaLabel={detail?.description}>
      {detail && badge && (
        <>
          <DialogTitle
            description={
              <span className="inline-flex items-center gap-2">
                <Badge tone={badge.tone}>{badge.label}</Badge>
                <span className="text-[var(--color-muted)]">
                  Filed by {ownerName} · {fmtDate(detail.expenseDate)} · {detail.category}
                </span>
              </span>
            }
          >
            {detail.description}
          </DialogTitle>
          <DialogBody className="space-y-4">
            {err && <Alert variant="error">{err}</Alert>}

            <StatGroup cols={{ md: 3, lg: 3 }}>
              <Stat
                label="Total"
                value={<Money value={detail.total} />}
                emphasis="hero"
              />
              <Stat
                label="Reimbursed"
                value={<Money value={detail.amountReimbursed} />}
                tone={detail.amountReimbursed > 0 ? "positive" : "neutral"}
              />
              <Stat
                label="Outstanding"
                value={<Money value={detail.outstanding} />}
                tone={detail.outstanding > 0 ? "warning" : "neutral"}
              />
            </StatGroup>

            {(detail.reference || detail.notes) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                {detail.reference && <Row label="Reference">{detail.reference}</Row>}
                {detail.notes && <Row label="Notes">{detail.notes}</Row>}
              </div>
            )}

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
            <section aria-labelledby="reimb-heading">
              <div className="flex items-center justify-between mb-2">
                <h3
                  id="reimb-heading"
                  className="text-sm font-semibold text-[var(--color-ink)]"
                >
                  Reimbursements
                </h3>
                {canManage &&
                  detail.status !== "VOID" &&
                  detail.status !== "REIMBURSED" && (
                    <Button onClick={() => setReimbOpen(true)} variant="secondary" size="sm">
                      + Record reimbursement
                    </Button>
                  )}
              </div>
              {detail.reimbursements.length === 0 ? (
                <div className="rounded-lg border border-black/[0.06] bg-black/[0.02] p-4 text-sm text-[var(--color-muted)]">
                  No reimbursements yet — the restaurant still owes the owner the full amount.
                </div>
              ) : (
                <ul className="rounded-lg border border-black/[0.06] divide-y divide-black/[0.06]">
                  {detail.reimbursements.map((r) => (
                    <li
                      key={r.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3"
                    >
                      <div className="text-sm">
                        <div className="font-medium text-[var(--color-ink)]">
                          <Money value={r.amount} emphasis="strong" />{" "}
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
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingReimb(r)}
                            disabled={busy}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void reverseReimbursement(r.id)}
                            disabled={busy}
                          >
                            Reverse
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </DialogBody>
          <DialogFooter justify="between">
            <div>
              {canManage &&
                detail.status !== "VOID" &&
                detail.amountReimbursed === 0 && (
                  <Button
                    variant="danger"
                    onClick={() => void doVoid()}
                    disabled={busy}
                  >
                    Cancel expense
                  </Button>
                )}
            </div>
            <div className="flex gap-2">
              {canManage && detail.status !== "VOID" && (
                <Button
                  variant="secondary"
                  onClick={() => setEditExpenseOpen(true)}
                >
                  Edit details
                </Button>
              )}
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
            </div>
          </DialogFooter>
        </>
      )}

      {/* Sub-dialogs are siblings of the parent Dialog so they receive
          their own focus trap and ESC handling. */}
      {detail && (
        <>
          <RecordReimbursementDialog
            open={reimbOpen}
            detail={detail}
            onClose={() => setReimbOpen(false)}
            onRecorded={async () => {
              setReimbOpen(false);
              await onChanged();
            }}
          />
          <EditExpenseDialog
            open={editExpenseOpen}
            detail={detail}
            onClose={() => setEditExpenseOpen(false)}
            onSaved={async () => {
              setEditExpenseOpen(false);
              await onChanged();
            }}
          />
          {editingReimb && (
            <EditReimbursementDialog
              open={editingReimb !== null}
              detail={detail}
              reimb={editingReimb}
              onClose={() => setEditingReimb(null)}
              onSaved={async () => {
                setEditingReimb(null);
                await onChanged();
              }}
            />
          )}
        </>
      )}
    </Dialog>
  );
}

function RecordReimbursementDialog({
  open,
  detail,
  onClose,
  onRecorded,
}: {
  open: boolean;
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

  // Reset to fresh defaults whenever the dialog re-opens.
  useEffect(() => {
    if (!open) return;
    setPaidDate(todayLocalIso());
    setAmount(detail.outstanding.toFixed(2));
    setMethod("CASH");
    setReference("");
    setNotes("");
    setErr(null);
  }, [open, detail.outstanding]);

  const submit = async () => {
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
    <DialogForm
      open={open}
      onClose={onClose}
      onSubmit={submit}
      size="md"
      dismissOnBackdrop={false}
      ariaLabel="Record reimbursement"
    >
      <DialogTitle
        description={
          <>
            Reimbursing{" "}
            <span className="font-medium text-[var(--color-ink)]">
              {detail.ownerName}
            </span>{" "}
            for{" "}
            <span className="font-medium text-[var(--color-ink)]">
              {detail.description}
            </span>
            . Outstanding{" "}
            <Money value={detail.outstanding} emphasis="strong" />.
          </>
        }
      >
        Record reimbursement
      </DialogTitle>
      <DialogBody className="space-y-3">
        {err && <Alert variant="error">{err}</Alert>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Date paid" required>
            <Input
              type="date"
              value={paidDate}
              onChange={(e) => setPaidDate(e.target.value)}
              max={todayLocalIso()}
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
        </div>
        <Field label="Amount (PLN)" required>
          <Input
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
          />
        </Field>
        <Field label="Reference" optional>
          <Input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="bank ref, cheque no"
            maxLength={120}
          />
        </Field>
        <Field label="Notes" optional>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={1000}
          />
        </Field>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          Record reimbursement
        </Button>
      </DialogFooter>
    </DialogForm>
  );
}

// ============================================================================
// Edit expense (parent) dialog
// ============================================================================

function EditExpenseDialog({
  open,
  detail,
  onClose,
  onSaved,
}: {
  open: boolean;
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

  // Reset draft whenever the dialog opens for a (potentially new) record.
  useEffect(() => {
    if (!open) return;
    setExpenseDate(detail.expenseDate);
    setCategory(detail.category);
    setDescription(detail.description);
    setTotal(detail.total.toFixed(2));
    setReference(detail.reference ?? "");
    setNotes(detail.notes ?? "");
    setErr(null);
  }, [open, detail]);

  const submit = async () => {
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
    <DialogForm
      open={open}
      onClose={onClose}
      onSubmit={submit}
      size="md"
      dismissOnBackdrop={false}
      ariaLabel="Edit owner expense"
    >
      <DialogTitle>Edit owner expense</DialogTitle>
      <DialogBody className="space-y-3">
        {err && <Alert variant="error">{err}</Alert>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Expense date" required>
            <Input
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
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
        </div>
        <Field label="Description" required>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={300}
          />
        </Field>
        <Field
          label="Amount (PLN)"
          required
          hint={
            totalLocked
              ? "Locked — reverse all reimbursements first to change the principal."
              : undefined
          }
        >
          <Input
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            inputMode="decimal"
            disabled={totalLocked}
          />
        </Field>
        <Field label="Reference" optional>
          <Input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            maxLength={120}
          />
        </Field>
        <Field label="Notes" optional>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={1000}
          />
        </Field>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          Save changes
        </Button>
      </DialogFooter>
    </DialogForm>
  );
}

// ============================================================================
// Edit reimbursement dialog
// ============================================================================

function EditReimbursementDialog({
  open,
  detail,
  reimb,
  onClose,
  onSaved,
}: {
  open: boolean;
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

  useEffect(() => {
    if (!open) return;
    setPaidDate(reimb.paidDate);
    setAmount(reimb.amount.toFixed(2));
    setMethod(reimb.method);
    setReference(reimb.reference ?? "");
    setNotes(reimb.notes ?? "");
    setErr(null);
  }, [open, reimb]);

  const submit = async () => {
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
    <DialogForm
      open={open}
      onClose={onClose}
      onSubmit={submit}
      size="md"
      dismissOnBackdrop={false}
      ariaLabel="Edit reimbursement"
    >
      <DialogTitle
        description={
          <>
            Reimbursing{" "}
            <span className="font-medium text-[var(--color-ink)]">
              {detail.ownerName}
            </span>{" "}
            for{" "}
            <span className="font-medium text-[var(--color-ink)]">
              {detail.description}
            </span>
            . Max allowed <Money value={maxAmount} emphasis="strong" />.
          </>
        }
      >
        Edit reimbursement
      </DialogTitle>
      <DialogBody className="space-y-3">
        {err && <Alert variant="error">{err}</Alert>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Date paid" required>
            <Input
              type="date"
              value={paidDate}
              onChange={(e) => setPaidDate(e.target.value)}
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
        </div>
        <Field label="Amount (PLN)" required>
          <Input
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
          />
        </Field>
        <Field label="Reference" optional>
          <Input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            maxLength={120}
          />
        </Field>
        <Field label="Notes" optional>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={1000}
          />
        </Field>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          Save changes
        </Button>
      </DialogFooter>
    </DialogForm>
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
  const confirm = useConfirm();

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
    const ok = await confirm({
      title: "Remove this receipt?",
      description: "The file will be deleted from storage.",
      confirmLabel: "Remove",
      tone: "danger",
    });
    if (!ok) return;
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
    <section aria-labelledby="receipts-heading">
      <div className="flex items-center justify-between mb-2">
        <h3
          id="receipts-heading"
          className="text-sm font-semibold text-[var(--color-ink)]"
        >
          Receipts
        </h3>
        {canEdit && (
          <label className="cursor-pointer text-xs px-3 py-1.5 rounded-md border border-black/10 hover:bg-black/[0.04] text-[var(--color-ink)] focus-within:ring-2 focus-within:ring-[var(--color-saffron)] focus-within:outline-none">
            + Add receipt
            <input
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="sr-only"
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
                className="flex-1 min-w-0 text-sm text-[var(--color-ink)] hover:text-[var(--color-saffron)] truncate inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-saffron)] rounded"
                title={r.filename}
              >
                <IconPaperclip className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{r.filename}</span>
              </a>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => void handleDelete(r.id)}
                  className="text-xs text-[var(--color-muted)] hover:text-[var(--color-danger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-saffron)] rounded"
                  disabled={busy}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ============================================================================
// Tiny helpers
// ============================================================================

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-black/[0.04] py-1.5">
      <span className="text-[var(--color-muted)]">{label}</span>
      <span className="text-[var(--color-ink)] text-right">{children}</span>
    </div>
  );
}
