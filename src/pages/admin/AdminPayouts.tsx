import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import {
  deleteSalaryPayment,
  updateSalaryPayment,
  type UpdateSalaryPaymentInput,
} from "../../api/salaryPayments";
import type { PaymentSource, SalaryPaymentRecord, User } from "../../types";
import { fmt } from "../../lib/calc";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { PayRatesPanel } from "../../components/admin/PayRatesPanel";
import { TagPicker } from "../../components/tags/TagPicker";
import {
  CommentsDrawer,
  CommentsTrigger,
} from "../../components/comments/CommentsDrawer";
import { ExportButton } from "../../components/export/ExportButton";

type Tab = "payouts" | "rates";

function monthStartIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

type MatchMode = "paidDate" | "payroll";

export function AdminPayouts() {
  const [tab, setTab] = useState<Tab>("payouts");
  const [from, setFrom] = useState(monthStartIso());
  const [to, setTo] = useState(todayIso());
  const [userId, setUserId] = useState("");
  const [source, setSource] = useState<"" | PaymentSource>("");
  const [matchMode, setMatchMode] = useState<MatchMode>("paidDate");
  const [cashiers, setCashiers] = useState<User[]>([]);
  const [payments, setPayments] = useState<SalaryPaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [commentsFor, setCommentsFor] = useState<SalaryPaymentRecord | null>(null);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    api<User[]>("/users")
      .then((list) =>
        setCashiers(list.filter((u) => u.role === "CASHIER" && u.active !== false))
      )
      .catch(() => setCashiers([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ from, to });
      if (userId) params.set("userId", userId);
      if (source) params.set("source", source);
      if (matchMode === "payroll") params.set("matchPeriod", "payroll");
      const rows = await api<SalaryPaymentRecord[]>(`/treasury/salary-payments?${params}`);
      setPayments(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load payouts");
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [from, to, userId, source, matchMode]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = useMemo(() => payments.reduce((s, p) => s + p.amount, 0), [payments]);

  const onSaveEdit = async (id: string, patch: UpdateSalaryPaymentInput) => {
    setBusyId(id);
    setError("");
    setMessage("");
    try {
      const res = await updateSalaryPayment(id, patch);
      if (res.payment) {
        setPayments((rows) => rows.map((r) => (r.id === id ? { ...r, ...res.payment! } : r)));
      }
      setEditingId(null);
      setMessage("Payment updated. Treasury balances refreshed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update payment");
    } finally {
      setBusyId(null);
    }
  };

  const onRemove = async (p: SalaryPaymentRecord) => {
    if (
      !confirm(
        `Remove this ${fmt(p.amount)} ${p.source.toLowerCase()} salary payout for ${p.employeeName}?\n\nTreasury balances will recalculate automatically.`
      )
    ) {
      return;
    }
    setBusyId(p.id);
    setError("");
    setMessage("");
    try {
      await deleteSalaryPayment(p.id);
      setPayments((rows) => rows.filter((r) => r.id !== p.id));
      setMessage("Payment removed. Treasury balances refreshed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove payment");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Payroll"
        subtitle="Pay rate changes and salary payouts — all in one place"
        action={
          <Link to="/admin/salaries" className="text-sm font-medium text-[var(--color-saffron)]">
            View calculation →
          </Link>
        }
      />

      <div className="flex gap-2 p-1 rounded-xl bg-[var(--color-cream)] w-fit">
        {(
          [
            { id: "payouts" as const, label: "Payouts" },
            { id: "rates" as const, label: "Pay rates" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              tab === t.id
                ? "bg-white shadow-sm text-[var(--color-ink)]"
                : "text-[var(--color-muted)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "rates" ? (
        <PayRatesPanel />
      ) : (
      <>
      <Card className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["Paid date in range", "paidDate"],
              ["Payroll period overlap", "payroll"],
            ] as const
          ).map(([label, mode]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setMatchMode(mode)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                matchMode === mode
                  ? "bg-[var(--color-saffron)] text-white"
                  : "bg-black/5 hover:bg-black/10"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="field-label">
            From
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="field-input"
            />
          </label>
          <label className="field-label">
            To
            <input
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
              className="field-input"
            />
          </label>
          <label className="field-label">
            Employee
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="field-input"
            >
              <option value="">All cashiers</option>
              {cashiers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Paid from
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as "" | PaymentSource)}
              className="field-input"
            >
              <option value="">Cash or card</option>
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
            </select>
          </label>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <Button variant="dark" onClick={() => void load()}>
            Apply filters
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setFrom(monthStartIso());
              setTo(todayIso());
              setUserId("");
              setSource("");
              setMatchMode("paidDate");
            }}
          >
            Reset
          </Button>
          <span className="ml-auto">
            <ExportButton
              config={{
                type: "payouts",
                from,
                to,
                cashierId: userId || undefined,
                paymentSource: source || undefined,
              }}
            />
          </span>
        </div>
        <p className="text-xs text-[var(--color-muted)]">
          {matchMode === "payroll"
            ? "Shows payments tagged for a payroll period that overlaps your date range (even if paid on another day)."
            : "Shows payments by the date money was paid out."}
        </p>
      </Card>

      {error && <Alert variant="error">{error}</Alert>}
      {message && <Alert variant="success">{message}</Alert>}

      <Card>
        <div className="flex justify-between items-baseline gap-2 mb-4">
          <p className="font-semibold">
            {payments.length} payout{payments.length === 1 ? "" : "s"}
          </p>
          <p className="text-lg font-bold tabular-nums">{fmt(total)}</p>
        </div>
        {loading ? (
          <p className="text-center text-[var(--color-muted)] py-6">Loading…</p>
        ) : payments.length === 0 ? (
          <p className="text-center text-[var(--color-muted)] py-6">No payouts match these filters.</p>
        ) : (
          <ul className="divide-y divide-black/5">
            {payments.map((p) =>
              editingId === p.id ? (
                <li key={p.id} className="py-3">
                  <PayoutEditForm
                    payment={p}
                    busy={busyId === p.id}
                    onCancel={() => setEditingId(null)}
                    onSave={(patch) => onSaveEdit(p.id, patch)}
                  />
                </li>
              ) : (
                <li
                  key={p.id}
                  className="py-3 flex flex-wrap justify-between gap-2 items-start"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{p.employeeName}</p>
                    <p className="text-sm text-[var(--color-muted)]">
                      Paid {p.paidDate}
                      {p.periodFrom && p.periodTo && (
                        <span>
                          {" "}
                          · payroll {p.periodFrom} → {p.periodTo}
                        </span>
                      )}
                    </p>
                    {p.notes && (
                      <p className="text-xs text-[var(--color-muted)] mt-0.5">{p.notes}</p>
                    )}
                    <div className="mt-2 flex items-center gap-3 flex-wrap">
                      <TagPicker
                        entityType="SALARY_PAYMENT"
                        entityId={p.id}
                        initialTags={p.tags ?? []}
                        size="sm"
                        onChange={(next) =>
                          setPayments((rows) =>
                            rows.map((r) => (r.id === p.id ? { ...r, tags: next } : r))
                          )
                        }
                      />
                      <CommentsTrigger
                        count={commentCounts[p.id] ?? p.commentCount ?? 0}
                        onClick={() => setCommentsFor(p)}
                      />
                    </div>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    <p className="font-bold tabular-nums">{fmt(p.amount)}</p>
                    <div className="flex flex-wrap justify-end gap-1">
                      <Badge variant="neutral">{p.source === "CASH" ? "Cash" : "Card"}</Badge>
                      {p.excludeFromTreasury && (
                        <Badge
                          variant="draft"
                          title="Recorded for payroll only — does not affect treasury balance"
                        >
                          Off-books
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-1 mt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(p.id);
                          setError("");
                          setMessage("");
                        }}
                        disabled={busyId === p.id}
                        className="text-xs font-medium text-[var(--color-saffron-dark)] hover:underline px-2 py-1"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemove(p)}
                        disabled={busyId === p.id}
                        className="text-xs font-medium text-[var(--color-danger)] hover:underline px-2 py-1"
                      >
                        {busyId === p.id ? "…" : "Remove"}
                      </button>
                    </div>
                  </div>
                </li>
              )
            )}
          </ul>
        )}
      </Card>
      </>
      )}
      <CommentsDrawer
        open={commentsFor != null}
        entityType={commentsFor ? "SALARY_PAYMENT" : null}
        entityId={commentsFor?.id ?? null}
        title={
          commentsFor
            ? `${commentsFor.employeeName} · ${commentsFor.paidDate}`
            : undefined
        }
        onClose={() => setCommentsFor(null)}
        onCountChange={(entityId, count) =>
          setCommentCounts((prev) => ({ ...prev, [entityId]: count }))
        }
      />
    </div>
  );
}

function PayoutEditForm({
  payment,
  busy,
  onCancel,
  onSave,
}: {
  payment: SalaryPaymentRecord;
  busy: boolean;
  onCancel: () => void;
  onSave: (patch: UpdateSalaryPaymentInput) => void;
}) {
  const [amount, setAmount] = useState(String(payment.amount));
  const [paidDate, setPaidDate] = useState(payment.paidDate);
  const [source, setSource] = useState<PaymentSource>(payment.source);
  const [periodFrom, setPeriodFrom] = useState(payment.periodFrom ?? "");
  const [periodTo, setPeriodTo] = useState(payment.periodTo ?? "");
  const [notes, setNotes] = useState(payment.notes ?? "");
  const [excludeFromTreasury, setExcludeFromTreasury] = useState(!!payment.excludeFromTreasury);

  const submit = () => {
    const patch: UpdateSalaryPaymentInput = {};
    const next = Number(amount);
    if (Number.isFinite(next) && Math.abs(next - payment.amount) > 0.005) {
      patch.amount = next;
    }
    if (paidDate && paidDate !== payment.paidDate) patch.paidDate = paidDate;
    if (source !== payment.source) patch.source = source;
    if (excludeFromTreasury !== !!payment.excludeFromTreasury) {
      patch.excludeFromTreasury = excludeFromTreasury;
    }

    const hadPeriod = !!(payment.periodFrom && payment.periodTo);
    const hasPeriod = !!(periodFrom && periodTo);
    if (hadPeriod && !hasPeriod) {
      patch.clearPeriod = true;
    } else if (hasPeriod) {
      if (periodFrom !== payment.periodFrom) patch.periodFrom = periodFrom;
      if (periodTo !== payment.periodTo) patch.periodTo = periodTo;
    }

    const trimmedNotes = notes.trim();
    const currentNotes = (payment.notes ?? "").trim();
    if (currentNotes && !trimmedNotes) {
      patch.clearNotes = true;
    } else if (trimmedNotes !== currentNotes) {
      patch.notes = trimmedNotes;
    }

    onSave(patch);
  };

  return (
    <div className="p-3 rounded-xl border border-[var(--color-saffron)]/30 bg-[var(--color-saffron)]/5 space-y-3">
      <div className="flex justify-between items-center">
        <p className="font-semibold text-sm">Edit payout · {payment.employeeName}</p>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-[var(--color-muted)] px-2 py-1"
        >
          Cancel
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="field-label">
          Amount (PLN)
          <input
            type="number"
            min={0.01}
            step={0.01}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="field-input"
          />
        </label>
        <label className="field-label">
          Paid on
          <input
            type="date"
            value={paidDate}
            onChange={(e) => setPaidDate(e.target.value)}
            className="field-input"
          />
        </label>
      </div>
      <div className="flex gap-2">
        {(["CASH", "CARD"] as PaymentSource[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSource(s)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium border ${
              source === s
                ? "bg-[var(--color-saffron)] text-white border-[var(--color-saffron)]"
                : "bg-white border-black/10"
            }`}
          >
            From {s === "CASH" ? "cash" : "card"}
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="field-label">
          Payroll from <span className="text-[var(--color-muted)] font-normal">(optional)</span>
          <input
            type="date"
            value={periodFrom}
            onChange={(e) => setPeriodFrom(e.target.value)}
            className="field-input"
          />
        </label>
        <label className="field-label">
          Payroll to <span className="text-[var(--color-muted)] font-normal">(optional)</span>
          <input
            type="date"
            value={periodTo}
            onChange={(e) => setPeriodTo(e.target.value)}
            className="field-input"
          />
        </label>
      </div>
      <label className="field-label">
        Note <span className="text-[var(--color-muted)] font-normal">(optional)</span>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="field-input"
          placeholder="e.g. May payroll"
        />
      </label>
      <label className="flex items-start gap-2 text-xs cursor-pointer select-none rounded-lg border border-black/10 bg-amber-50/40 px-2.5 py-2">
        <input
          type="checkbox"
          checked={excludeFromTreasury}
          onChange={(e) => setExcludeFromTreasury(e.target.checked)}
          className="mt-0.5 w-3.5 h-3.5 accent-[var(--color-saffron)] shrink-0"
        />
        <span className="flex-1">
          <span className="font-medium text-[var(--color-ink)]">Don't deduct from treasury</span>
          <span className="block text-[var(--color-muted)] mt-0.5">
            Bookkeeping-only: treasury balance stays unchanged. Toggle off to put this payment back
            on the books.
          </span>
        </span>
      </label>
      <Button type="button" fullWidth disabled={busy} onClick={submit}>
        {busy ? "Saving…" : "Save changes"}
      </Button>
      <p className="text-xs text-[var(--color-muted)]">
        Treasury balances will recalculate automatically after saving.
      </p>
    </div>
  );
}
