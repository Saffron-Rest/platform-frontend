import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  getTreasuryLedger,
  type TreasuryLedger,
  type TreasuryLedgerCategory,
  type TreasuryLedgerRow,
  type TreasuryLedgerSource,
} from "../api/treasury";
import {
  createCardSettlement,
  deleteCardSettlement,
} from "../api/cardSettlements";
import { fmt } from "../lib/calc";
import { Alert } from "../components/ui/Alert";
import { AmountField } from "../components/ui/AmountField";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { Spinner } from "../components/ui/Spinner";

const SOURCES: { value: TreasuryLedgerSource; label: string }[] = [
  { value: "CARD", label: "Card / bank" },
  { value: "CASH", label: "Cash" },
];

type CategoryFilter = "ALL" | TreasuryLedgerCategory;

const CATEGORY_LABELS: Record<TreasuryLedgerCategory, string> = {
  INCOME: "Income",
  SHIFT_EXPENSE: "Shift expenses",
  STANDALONE_EXPENSE: "Post-close expenses",
  SALARY: "Salaries",
  TRANSFER: "Transfers",
};

const CATEGORY_VARIANT: Record<
  TreasuryLedgerCategory,
  "draft" | "neutral" | "inactive" | "locked"
> = {
  INCOME: "draft",
  SHIFT_EXPENSE: "neutral",
  STANDALONE_EXPENSE: "inactive",
  SALARY: "inactive",
  TRANSFER: "locked",
};

const FILTERS: { value: CategoryFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "INCOME", label: "Income" },
  { value: "SHIFT_EXPENSE", label: "Shift expenses" },
  { value: "STANDALONE_EXPENSE", label: "Post-close expenses" },
  { value: "SALARY", label: "Salaries" },
  { value: "TRANSFER", label: "Transfers" },
];

function monthStartIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function readSource(raw: string | null): TreasuryLedgerSource {
  return (raw ?? "card").toUpperCase() === "CASH" ? "CASH" : "CARD";
}

function readFilter(raw: string | null): CategoryFilter {
  const u = (raw ?? "all").toUpperCase();
  if (u === "ALL") return "ALL";
  if (
    u === "INCOME" ||
    u === "SHIFT_EXPENSE" ||
    u === "STANDALONE_EXPENSE" ||
    u === "SALARY" ||
    u === "TRANSFER"
  ) {
    return u;
  }
  return "ALL";
}

function formatDate(iso: string): string {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

/** Row identity for tracking which line is being reconciled. */
function rowKey(row: TreasuryLedgerRow): string {
  return `${row.kind}::${row.refId ?? row.date}`;
}

/** A card-side income row that can have a manual settlement reconciliation attached. */
function isReconcilable(row: TreasuryLedgerRow): boolean {
  if (row.kind === "CARD_SETTLEMENT") return false;
  if (row.category !== "INCOME") return false;
  if (row.sign !== "+") return false;
  return !!row.refId;
}

export function TreasuryHistory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const source = readSource(searchParams.get("source"));
  const filter = readFilter(searchParams.get("filter"));
  const [from, setFrom] = useState(searchParams.get("from") ?? monthStartIso());
  const [to, setTo] = useState(searchParams.get("to") ?? todayIso());
  const [ledger, setLedger] = useState<TreasuryLedger | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [reloadTick, setReloadTick] = useState(0);

  // Inline reconciliation editor — which row is open + the in-progress values
  const [openRowKey, setOpenRowKey] = useState<string | null>(null);
  const [settled, setSettled] = useState<number>(0);
  const [settledNotes, setSettledNotes] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getTreasuryLedger({ source, from, to })
      .then((res) => {
        if (!cancelled) setLedger(res);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load history");
          setLedger(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [source, from, to, reloadTick]);

  const openReconcile = (row: TreasuryLedgerRow) => {
    setError("");
    setInfo("");
    setOpenRowKey(rowKey(row));
    // Default the settled value to whatever's already on the row (override or original)
    setSettled(row.amount);
    setSettledNotes(row.settledNotes ?? "");
  };

  const closeReconcile = () => {
    setOpenRowKey(null);
    setSettled(0);
    setSettledNotes("");
  };

  const handleSaveOverride = async (row: TreasuryLedgerRow) => {
    if (!row.refId) return;
    if (!Number.isFinite(settled) || settled < 0) {
      setError("Bank-credited amount must be zero or positive");
      return;
    }
    // Gross = the snapshot of the row's original (pre-override) amount.
    // When editing an existing override, originalAmount holds the snapshot.
    const gross = row.settledOverride && typeof row.originalAmount === "number"
      ? row.originalAmount
      : row.amount;
    setSaving(true);
    setError("");
    setInfo("");
    try {
      await createCardSettlement({
        effectiveDate: row.date,
        grossAmount: gross,
        settledAmount: settled,
        linkedKind: row.kind,
        linkedRefId: row.refId,
        notes: settledNotes.trim() || undefined,
      });
      setInfo("Settlement saved.");
      closeReconcile();
      setReloadTick((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save settlement");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveOverride = async (row: TreasuryLedgerRow) => {
    if (!row.settlementId) return;
    if (!confirm("Remove this manual settlement and restore the original amount?")) return;
    try {
      await deleteCardSettlement(row.settlementId);
      setInfo("Settlement removed.");
      setReloadTick((n) => n + 1);
      if (openRowKey === rowKey(row)) closeReconcile();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove settlement");
    }
  };

  /** Category totals across the full window (independent of active filter). */
  const categoryTotals = useMemo(() => {
    const base: Record<TreasuryLedgerCategory, { inflow: number; outflow: number; count: number }> = {
      INCOME: { inflow: 0, outflow: 0, count: 0 },
      SHIFT_EXPENSE: { inflow: 0, outflow: 0, count: 0 },
      STANDALONE_EXPENSE: { inflow: 0, outflow: 0, count: 0 },
      SALARY: { inflow: 0, outflow: 0, count: 0 },
      TRANSFER: { inflow: 0, outflow: 0, count: 0 },
    };
    if (!ledger?.rows) return base;
    for (const row of ledger.rows) {
      const bucket = base[row.category];
      if (!bucket) continue;
      bucket.count += 1;
      if (row.sign === "+") bucket.inflow += row.amount;
      else bucket.outflow += row.amount;
    }
    return base;
  }, [ledger]);

  const visibleRows = useMemo(() => {
    if (!ledger?.rows) return [];
    const rows = filter === "ALL"
      ? ledger.rows
      : ledger.rows.filter((r) => r.category === filter);
    return [...rows].reverse();
  }, [ledger, filter]);

  const setSource = (next: TreasuryLedgerSource) => {
    const params = new URLSearchParams(searchParams);
    params.set("source", next.toLowerCase());
    params.set("from", from);
    params.set("to", to);
    setSearchParams(params, { replace: true });
    closeReconcile();
  };

  const setFilter = (next: CategoryFilter) => {
    const params = new URLSearchParams(searchParams);
    if (next === "ALL") params.delete("filter");
    else params.set("filter", next.toLowerCase());
    setSearchParams(params, { replace: true });
  };

  const sourceTitle = source === "CASH" ? "Cash history" : "Card / bank history";
  const sourceSubtitle =
    source === "CASH"
      ? "Every cash movement broken down by category — income, shift expenses, post-close expenses, salaries, and transfers."
      : "Every card / bank movement broken down by category — tap any income row to reconcile it against your bank statement.";

  return (
    <div className="space-y-4">
      <PageHeader
        title={sourceTitle}
        subtitle={sourceSubtitle}
        back={
          <button
            type="button"
            className="text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            onClick={() => navigate(-1)}
          >
            ← Back
          </button>
        }
      />

      <Card className="space-y-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Treasury source">
          {SOURCES.map((s) => (
            <button
              key={s.value}
              type="button"
              role="tab"
              aria-selected={source === s.value}
              onClick={() => setSource(s.value)}
              className={`tab-pill text-sm ${source === s.value ? "tab-pill-active" : "tab-pill-idle"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="field-label">
            From
            <input
              type="date"
              className="field-input"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="field-label">
            To
            <input
              type="date"
              className="field-input"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>
      </Card>

      {error && <Alert variant="error">{error}</Alert>}
      {info && <Alert variant="success">{info}</Alert>}

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner label="Loading history…" />
        </div>
      ) : ledger ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="!p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                Opening balance
              </p>
              <p className="text-xl font-bold tabular-nums mt-1">
                {fmt(ledger.openingBalance)} {ledger.currency}
              </p>
              <p className="text-xs text-[var(--color-muted)] mt-1">on {formatDate(from)}</p>
            </Card>
            <Card className="!p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                Net change
              </p>
              <p
                className={`text-xl font-bold tabular-nums mt-1 ${
                  ledger.closingBalance - ledger.openingBalance >= 0
                    ? "text-emerald-700"
                    : "text-rose-700"
                }`}
              >
                {ledger.closingBalance - ledger.openingBalance >= 0 ? "+" : "−"}
                {fmt(Math.abs(ledger.closingBalance - ledger.openingBalance))}
              </p>
              <p className="text-xs text-[var(--color-muted)] mt-1">
                {ledger.rows.length} movement{ledger.rows.length === 1 ? "" : "s"} in range
              </p>
            </Card>
            <Card className="!p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                Closing balance
              </p>
              <p className="text-xl font-bold tabular-nums mt-1">
                {fmt(ledger.closingBalance)} {ledger.currency}
              </p>
              <p className="text-xs text-[var(--color-muted)] mt-1">as of {formatDate(to)}</p>
            </Card>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {(Object.keys(CATEGORY_LABELS) as TreasuryLedgerCategory[]).map((cat) => {
              const { inflow, outflow, count } = categoryTotals[cat];
              const net = inflow - outflow;
              const active = filter === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFilter(active ? "ALL" : cat)}
                  className={`text-left rounded-2xl border p-3 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-saffron)]/50 ${
                    active
                      ? "bg-[var(--color-saffron)]/10 border-[var(--color-saffron)]/60"
                      : "bg-white border-black/5 hover:border-black/15"
                  }`}
                  aria-pressed={active}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                    {CATEGORY_LABELS[cat]}
                  </p>
                  <p
                    className={`text-base font-bold tabular-nums mt-0.5 ${
                      net >= 0 ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    {net >= 0 ? "+" : "−"}
                    {fmt(Math.abs(net))}
                  </p>
                  <p className="text-[11px] text-[var(--color-muted)] mt-0.5">
                    {count === 0 ? "No movements" : `${count} movement${count === 1 ? "" : "s"}`}
                    {inflow > 0 && outflow > 0 && (
                      <>
                        {" · "}
                        <span className="text-emerald-700">+{fmt(inflow)}</span>
                        {" / "}
                        <span className="text-rose-700">−{fmt(outflow)}</span>
                      </>
                    )}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by category">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                role="tab"
                aria-selected={filter === f.value}
                onClick={() => setFilter(f.value)}
                className={`tab-pill text-xs ${filter === f.value ? "tab-pill-active" : "tab-pill-idle"}`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <Card>
            <h3 className="font-semibold mb-3">
              Movements
              {filter !== "ALL" && (
                <span className="text-sm font-normal text-[var(--color-muted)] ml-2">
                  · {CATEGORY_LABELS[filter]}
                </span>
              )}
            </h3>
            {visibleRows.length === 0 ? (
              <div className="text-center py-10 space-y-3">
                <p className="text-sm text-[var(--color-muted)]">
                  No movements in this range.
                </p>
                <Button variant="primary" onClick={() => navigate("/finance")}>
                  Open finance
                </Button>
              </div>
            ) : (
              <ul className="divide-y divide-black/5">
                {visibleRows.map((row, idx) => {
                  const key = `${row.kind}-${row.refId ?? idx}-${row.date}-${idx}`;
                  const reconcilable = source === "CARD" && isReconcilable(row);
                  const isOpen = openRowKey === rowKey(row);
                  return (
                    <LedgerRowItem
                      key={key}
                      row={row}
                      reconcilable={reconcilable}
                      open={isOpen}
                      onOpen={() => openReconcile(row)}
                      onClose={closeReconcile}
                      onRemoveOverride={() => void handleRemoveOverride(row)}
                      settled={settled}
                      onSettledChange={setSettled}
                      notesValue={settledNotes}
                      onNotesChange={setSettledNotes}
                      saving={saving}
                      onSave={() => void handleSaveOverride(row)}
                    />
                  );
                })}
              </ul>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}

type LedgerRowItemProps = {
  row: TreasuryLedgerRow;
  reconcilable: boolean;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onRemoveOverride: () => void;
  settled: number;
  onSettledChange: (v: number) => void;
  notesValue: string;
  onNotesChange: (v: string) => void;
  saving: boolean;
  onSave: () => void;
};

function LedgerRowItem({
  row,
  reconcilable,
  open,
  onOpen,
  onClose,
  onRemoveOverride,
  settled,
  onSettledChange,
  notesValue,
  onNotesChange,
  saving,
  onSave,
}: LedgerRowItemProps) {
  const isInflow = row.sign === "+";
  const overridden = !!row.settledOverride;
  const original = typeof row.originalAmount === "number" ? row.originalAmount : null;
  const variance = original != null ? row.amount - original : 0;

  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium truncate">{row.label}</p>
            <Badge variant={CATEGORY_VARIANT[row.category]}>{CATEGORY_LABELS[row.category]}</Badge>
            {overridden && (
              <Badge variant="draft">Settled</Badge>
            )}
          </div>
          <p className="text-xs text-[var(--color-muted)] mt-1">
            {formatDate(row.date)}
            {row.refRoute && (
              <>
                {" · "}
                <Link to={row.refRoute} className="text-[var(--color-saffron)] font-medium">
                  {row.refLabel ?? "Open"} →
                </Link>
              </>
            )}
          </p>
          {overridden && original != null && (
            <p className="text-xs text-[var(--color-muted)] mt-1 tabular-nums">
              originally {fmt(original)} · settled {fmt(row.amount)} ·{" "}
              <span className={variance >= 0 ? "text-emerald-700" : "text-rose-700"}>
                variance {variance >= 0 ? "+" : "−"}
                {fmt(Math.abs(variance))}
              </span>
            </p>
          )}
          {row.settledNotes && (
            <p className="text-xs text-[var(--color-muted)] mt-1 italic">
              note: {row.settledNotes}
            </p>
          )}
          {row.notes && !row.settledNotes && (
            <p className="text-xs text-[var(--color-muted)] mt-1 italic">{row.notes}</p>
          )}
          {reconcilable && !open && (
            <div className="flex items-center gap-3 mt-1.5">
              <button
                type="button"
                onClick={onOpen}
                className="text-xs font-semibold text-[var(--color-saffron)] hover:underline"
              >
                {overridden ? "Edit settled amount" : "Settle to actual"}
              </button>
              {overridden && (
                <button
                  type="button"
                  onClick={onRemoveOverride}
                  className="text-xs font-medium text-rose-600 hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
          )}
        </div>
        <div className="text-right tabular-nums shrink-0">
          {overridden && original != null && Math.abs(variance) >= 0.005 && (
            <p className="text-xs text-[var(--color-muted)] line-through">
              {fmt(original)}
            </p>
          )}
          <p className={`font-semibold ${isInflow ? "text-emerald-700" : "text-rose-700"}`}>
            {isInflow ? "+" : "−"}
            {fmt(row.amount)}
          </p>
          <p className="text-xs text-[var(--color-muted)] mt-0.5">
            balance {fmt(row.runningBalance)}
          </p>
        </div>
      </div>

      {open && (
        <ReconcileForm
          row={row}
          settled={settled}
          onSettledChange={onSettledChange}
          notesValue={notesValue}
          onNotesChange={onNotesChange}
          saving={saving}
          onSave={onSave}
          onClose={onClose}
        />
      )}
    </li>
  );
}

function ReconcileForm({
  row,
  settled,
  onSettledChange,
  notesValue,
  onNotesChange,
  saving,
  onSave,
  onClose,
}: {
  row: TreasuryLedgerRow;
  settled: number;
  onSettledChange: (v: number) => void;
  notesValue: string;
  onNotesChange: (v: string) => void;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
}) {
  const original = row.settledOverride && typeof row.originalAmount === "number"
    ? row.originalAmount
    : row.amount;
  const variance = settled - original;
  const sameAsOriginal = Math.abs(variance) < 0.005;

  return (
    <div className="mt-3 rounded-2xl border-2 border-[var(--color-saffron)]/40 bg-[var(--color-saffron)]/8 p-3 sm:p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Reconcile against bank</p>
          <p className="text-xs text-[var(--color-muted)] mt-0.5">
            This row currently contributes <strong className="tabular-nums">{fmt(original)}</strong> PLN to the card balance.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-[var(--color-muted)] hover:bg-black/5"
        >
          Cancel
        </button>
      </div>

      <AmountField
        label="What did the bank actually credit?"
        className="field-label"
        inputClassName="field-input"
        value={settled}
        onChange={onSettledChange}
      />

      <div
        className={`rounded-xl px-3 py-2 text-sm font-medium tabular-nums ${
          sameAsOriginal
            ? "bg-black/5 text-[var(--color-muted)]"
            : variance < 0
              ? "bg-rose-50 text-rose-800 border border-rose-200/60"
              : "bg-emerald-50 text-emerald-800 border border-emerald-200/60"
        }`}
      >
        {sameAsOriginal ? (
          <>Matches the original — no adjustment will be applied.</>
        ) : (
          <>
            Adjustment:{" "}
            <strong>
              {variance >= 0 ? "+" : "−"}
              {fmt(Math.abs(variance))} PLN
            </strong>
            <span className="block text-xs font-normal mt-0.5">
              {variance < 0
                ? "Bank credited less — the shortfall will be subtracted from card balance."
                : "Bank credited more — the surplus will be added to card balance."}
            </span>
          </>
        )}
      </div>

      <label className="field-label">
        Notes (optional)
        <input
          type="text"
          className="field-input"
          placeholder="POS fee 1.5% / Wolt holdback / chargeback…"
          value={notesValue}
          onChange={(e) => onNotesChange(e.target.value)}
        />
      </label>

      <Button variant="dark" fullWidth disabled={saving} onClick={onSave}>
        {saving ? "Saving…" : "Save settlement"}
      </Button>
    </div>
  );
}
