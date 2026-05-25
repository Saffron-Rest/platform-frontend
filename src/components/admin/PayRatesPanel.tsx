import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";
import {
  addPayRate,
  deletePayRate,
  listAllPayRates,
  updatePayRate,
  type PayRateHistoryEntryWithUser,
} from "../../api/payRates";
import type { PayType, User } from "../../types";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Alert } from "../ui/Alert";
import { Badge } from "../ui/Badge";

const PAY_TYPES: { value: PayType; label: string }[] = [
  { value: "HOURLY", label: "Hourly" },
  { value: "DAILY", label: "Daily" },
  { value: "MONTHLY", label: "Monthly" },
];

function suffix(t: PayType) {
  if (t === "HOURLY") return "PLN/h";
  if (t === "DAILY") return "PLN/day";
  return "PLN/mo";
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function PayRatesPanel() {
  const [entries, setEntries] = useState<PayRateHistoryEntryWithUser[]>([]);
  const [cashiers, setCashiers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [filterUserId, setFilterUserId] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await listAllPayRates();
      setEntries(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load pay rates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    api<User[]>("/users")
      .then((list) => setCashiers(list.filter((u) => u.role === "CASHIER")))
      .catch(() => setCashiers([]));
  }, [load]);

  const filtered = useMemo(
    () => (filterUserId ? entries.filter((e) => e.userId === filterUserId) : entries),
    [entries, filterUserId]
  );

  const today = todayIso();
  // The "current effective" entry per cashier (most recent with effectiveFrom <= today)
  const currentByUser = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of entries) {
      if (e.effectiveFrom > today) continue;
      if (!map.has(e.userId)) map.set(e.userId, e.id);
    }
    return map;
  }, [entries, today]);

  const refresh = async () => {
    const rows = await listAllPayRates();
    setEntries(rows);
  };

  const onAdd = async (userId: string, input: { payType: PayType; payAmount: number; effectiveFrom: string; notes?: string }) => {
    setBusyId("__add__");
    setError("");
    setMessage("");
    try {
      await addPayRate(userId, input);
      await refresh();
      setAddOpen(false);
      setMessage("Pay change added");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add");
    } finally {
      setBusyId(null);
    }
  };

  const onUpdate = async (
    entry: PayRateHistoryEntryWithUser,
    patch: { payType?: PayType; payAmount?: number; effectiveFrom?: string; notes?: string }
  ) => {
    setBusyId(entry.id);
    setError("");
    setMessage("");
    try {
      await updatePayRate(entry.userId, entry.id, patch);
      await refresh();
      setEditingId(null);
      setMessage("Pay change updated");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setBusyId(null);
    }
  };

  const onRemove = async (entry: PayRateHistoryEntryWithUser) => {
    if (
      !confirm(
        `Remove pay change of ${entry.payAmount} ${suffix(entry.payType)} from ${formatDate(
          entry.effectiveFrom
        )} for ${entry.employeeName}?`
      )
    )
      return;
    setBusyId(entry.id);
    setError("");
    setMessage("");
    try {
      await deletePayRate(entry.userId, entry.id);
      await refresh();
      setMessage("Pay change removed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-sm text-[var(--color-muted)]">
            All pay rate changes across the team. Earlier shifts keep the rate that was effective
            on their day.
          </p>
          <Button
            variant="dark"
            className="!py-2 !text-sm"
            onClick={() => {
              setAddOpen((v) => !v);
              setError("");
              setMessage("");
            }}
          >
            {addOpen ? "Cancel" : "+ Add pay change"}
          </Button>
        </div>
        <label className="field-label block max-w-xs">
          Filter by employee
          <select
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
            className="field-input"
          >
            <option value="">All cashiers</option>
            {cashiers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.active === false ? " (inactive)" : ""}
              </option>
            ))}
          </select>
        </label>
        {addOpen && (
          <AddPayRateForm
            cashiers={cashiers}
            defaultUserId={filterUserId}
            busy={busyId === "__add__"}
            onCancel={() => setAddOpen(false)}
            onSubmit={onAdd}
          />
        )}
      </Card>

      {error && <Alert variant="error">{error}</Alert>}
      {message && <Alert variant="success">{message}</Alert>}

      <Card>
        <p className="text-sm font-semibold mb-3">
          {filtered.length} pay change{filtered.length === 1 ? "" : "s"}
          {filterUserId && (
            <span className="text-[var(--color-muted)] font-normal">
              {" "}
              · {cashiers.find((c) => c.id === filterUserId)?.name}
            </span>
          )}
        </p>
        {loading ? (
          <p className="text-center text-[var(--color-muted)] py-6">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-[var(--color-muted)] py-6">
            No pay rate changes yet. Click "+ Add pay change" to create one.
          </p>
        ) : (
          <ul className="divide-y divide-black/5">
            {filtered.map((entry) =>
              editingId === entry.id ? (
                <li key={entry.id} className="py-3">
                  <EditPayRateForm
                    entry={entry}
                    busy={busyId === entry.id}
                    onCancel={() => setEditingId(null)}
                    onSubmit={(patch) => onUpdate(entry, patch)}
                  />
                </li>
              ) : (
                <li
                  key={entry.id}
                  className="py-3 flex flex-wrap items-start justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {entry.employeeName}
                      {currentByUser.get(entry.userId) === entry.id && (
                        <Badge variant="neutral" className="ml-2">
                          Current
                        </Badge>
                      )}
                    </p>
                    <p className="text-sm">
                      {PAY_TYPES.find((p) => p.value === entry.payType)?.label} · {entry.payAmount}{" "}
                      {suffix(entry.payType)}
                    </p>
                    <p className="text-xs text-[var(--color-muted)]">
                      from {formatDate(entry.effectiveFrom)}
                      {entry.notes && ` · ${entry.notes}`}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(entry.id);
                        setError("");
                        setMessage("");
                      }}
                      disabled={busyId === entry.id}
                      className="text-xs font-medium text-[var(--color-saffron-dark)] hover:underline px-2 py-1"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(entry)}
                      disabled={busyId === entry.id}
                      className="text-xs font-medium text-[var(--color-danger)] hover:underline px-2 py-1"
                    >
                      {busyId === entry.id ? "…" : "Remove"}
                    </button>
                  </div>
                </li>
              )
            )}
          </ul>
        )}
      </Card>
    </div>
  );
}

function AddPayRateForm({
  cashiers,
  defaultUserId,
  busy,
  onCancel,
  onSubmit,
}: {
  cashiers: User[];
  defaultUserId: string;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (
    userId: string,
    input: { payType: PayType; payAmount: number; effectiveFrom: string; notes?: string }
  ) => void;
}) {
  const [userId, setUserId] = useState(defaultUserId);
  const [payType, setPayType] = useState<PayType>("HOURLY");
  const [amount, setAmount] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(todayIso());
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState("");

  const submit = () => {
    if (!userId) {
      setErr("Pick an employee");
      return;
    }
    const n = Number(amount);
    if (!Number.isFinite(n) || n < 0) {
      setErr("Amount must be ≥ 0");
      return;
    }
    if (!effectiveFrom) {
      setErr("Pick an effective date");
      return;
    }
    setErr("");
    onSubmit(userId, { payType, payAmount: n, effectiveFrom, notes: notes.trim() || undefined });
  };

  return (
    <div className="p-3 rounded-xl border border-[var(--color-saffron)]/30 bg-[var(--color-saffron)]/5 space-y-3">
      <div className="flex justify-between items-center">
        <p className="font-semibold text-sm">New pay change</p>
        <button type="button" onClick={onCancel} className="text-xs text-[var(--color-muted)] px-2 py-1">
          Cancel
        </button>
      </div>
      <label className="field-label">
        Employee
        <select
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="field-input"
        >
          <option value="">Choose…</option>
          {cashiers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.active === false ? " (inactive)" : ""}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-3 gap-2">
        {PAY_TYPES.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setPayType(p.value)}
            className={`py-2 px-1 rounded-lg text-xs font-medium border transition ${
              payType === p.value
                ? "bg-[var(--color-saffron)] text-white border-[var(--color-saffron)]"
                : "bg-white border-black/10"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        <label className="field-label">
          Amount ({suffix(payType)})
          <input
            type="number"
            min={0}
            step={0.5}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="field-input"
          />
        </label>
        <label className="field-label">
          Effective from
          <input
            type="date"
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
            className="field-input"
          />
        </label>
      </div>
      <label className="field-label">
        Note <span className="font-normal text-[var(--color-muted)]">(optional)</span>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="field-input"
          placeholder="e.g. raise, seasonal adjustment"
        />
      </label>
      {err && <Alert variant="error">{err}</Alert>}
      <Button type="button" fullWidth disabled={busy} onClick={submit}>
        {busy ? "Adding…" : "Add pay change"}
      </Button>
    </div>
  );
}

function EditPayRateForm({
  entry,
  busy,
  onCancel,
  onSubmit,
}: {
  entry: PayRateHistoryEntryWithUser;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (patch: {
    payType?: PayType;
    payAmount?: number;
    effectiveFrom?: string;
    notes?: string;
  }) => void;
}) {
  const [payType, setPayType] = useState<PayType>(entry.payType);
  const [amount, setAmount] = useState(String(entry.payAmount));
  const [effectiveFrom, setEffectiveFrom] = useState(entry.effectiveFrom);
  const [notes, setNotes] = useState(entry.notes ?? "");
  const [err, setErr] = useState("");

  const submit = () => {
    const patch: { payType?: PayType; payAmount?: number; effectiveFrom?: string; notes?: string } = {};
    if (payType !== entry.payType) patch.payType = payType;
    const n = Number(amount);
    if (!Number.isFinite(n) || n < 0) {
      setErr("Amount must be ≥ 0");
      return;
    }
    if (Math.abs(n - entry.payAmount) > 0.005) patch.payAmount = n;
    if (effectiveFrom && effectiveFrom !== entry.effectiveFrom) patch.effectiveFrom = effectiveFrom;
    const trimmed = notes.trim();
    if (trimmed !== (entry.notes ?? "")) patch.notes = trimmed;
    setErr("");
    onSubmit(patch);
  };

  return (
    <div className="p-3 rounded-xl border border-[var(--color-saffron)]/30 bg-[var(--color-saffron)]/5 space-y-3">
      <div className="flex justify-between items-center">
        <p className="font-semibold text-sm">Edit pay change · {entry.employeeName}</p>
        <button type="button" onClick={onCancel} className="text-xs text-[var(--color-muted)] px-2 py-1">
          Cancel
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {PAY_TYPES.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setPayType(p.value)}
            className={`py-2 px-1 rounded-lg text-xs font-medium border transition ${
              payType === p.value
                ? "bg-[var(--color-saffron)] text-white border-[var(--color-saffron)]"
                : "bg-white border-black/10"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        <label className="field-label">
          Amount ({suffix(payType)})
          <input
            type="number"
            min={0}
            step={0.5}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="field-input"
          />
        </label>
        <label className="field-label">
          Effective from
          <input
            type="date"
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
            className="field-input"
          />
        </label>
      </div>
      <label className="field-label">
        Note <span className="font-normal text-[var(--color-muted)]">(optional)</span>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="field-input"
        />
      </label>
      {err && <Alert variant="error">{err}</Alert>}
      <Button type="button" fullWidth disabled={busy} onClick={submit}>
        {busy ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );
}
