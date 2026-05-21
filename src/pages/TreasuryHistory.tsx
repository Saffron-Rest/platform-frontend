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
import {
  createBankDeposit,
  deleteBankDeposit,
  type BankDepositLinkPayload,
} from "../api/bankDeposits";
import { fmt } from "../lib/calc";
import { Alert } from "../components/ui/Alert";
import { AmountField } from "../components/ui/AmountField";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { FinanceAddPanel } from "../components/finance/FinanceAddPanel";
import { PageHeader } from "../components/ui/PageHeader";
import { Spinner } from "../components/ui/Spinner";

const SOURCES: { value: TreasuryLedgerSource; label: string }[] = [
  { value: "CARD", label: "Card / bank" },
  { value: "CASH", label: "Cash" },
];

type CategoryFilter = "ALL" | TreasuryLedgerCategory | "PENDING";

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
    u === "TRANSFER" ||
    u === "PENDING"
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

/** Row identity for tracking which line is being reconciled / selected. */
function rowKey(row: TreasuryLedgerRow): string {
  return `${row.kind}::${row.refId ?? row.date}`;
}

/** A card-side income row that can have a reconciliation attached. */
function isReconcilable(row: TreasuryLedgerRow): boolean {
  if (row.kind === "CARD_SETTLEMENT") return false;
  if (row.category !== "INCOME") return false;
  if (row.sign !== "+") return false;
  return !!row.refId;
}

/** Platform label / icon for delivery rows. */
const PLATFORMS: { key: string; label: string }[] = [
  { key: "wolt", label: "Wolt" },
  { key: "bolt", label: "Bolt" },
  { key: "uberEats", label: "Uber Eats" },
  { key: "glovo", label: "Glovo" },
  { key: "other", label: "Other delivery" },
];

/** Can this row be added to a multi-day batch? Not if it's already settled some other way. */
function isBatchable(row: TreasuryLedgerRow): boolean {
  if (!isReconcilable(row)) return false;
  if (row.bankDepositId) return false;
  if (row.settledOverride) return false;
  return true;
}


export function TreasuryHistory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const source = readSource(searchParams.get("source"));
  const filter = readFilter(searchParams.get("filter"));
  const pendingPlatform = filter === "PENDING" ? (searchParams.get("platform") ?? null) : null;
  const [from, setFrom] = useState(searchParams.get("from") ?? monthStartIso());
  const [to, setTo] = useState(searchParams.get("to") ?? todayIso());
  const [ledger, setLedger] = useState<TreasuryLedger | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [reloadTick, setReloadTick] = useState(0);

  // Inline single-row reconciliation editor
  const [openRowKey, setOpenRowKey] = useState<string | null>(null);
  const [settled, setSettled] = useState<number>(0);
  const [settledNotes, setSettledNotes] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Multi-row batch selection + bank deposit form
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchBankDate, setBatchBankDate] = useState<string>(todayIso());
  const [batchSettled, setBatchSettled] = useState<number>(0);
  const [batchNotes, setBatchNotes] = useState<string>("");
  const [batchSaving, setBatchSaving] = useState(false);

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

  /** Clear all per-row state when the user navigates between source/filter/date range. */
  const clearAllEditors = () => {
    setOpenRowKey(null);
    setSelectedKeys(new Set());
    setBatchOpen(false);
  };

  const openReconcile = (row: TreasuryLedgerRow) => {
    setError("");
    setInfo("");
    setOpenRowKey(rowKey(row));
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

  const handleRemoveDeposit = async (row: TreasuryLedgerRow) => {
    if (!row.bankDepositId) return;
    const count = row.bankDepositLinkCount ?? 1;
    if (!confirm(
      count > 1
        ? `Remove the bank deposit covering ${count} rows? All linked rows will revert to their original amounts.`
        : "Remove this bank deposit and restore the original amount?"
    )) return;
    try {
      await deleteBankDeposit(row.bankDepositId);
      setInfo("Bank deposit removed.");
      setReloadTick((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove bank deposit");
    }
  };

  const toggleSelected = (row: TreasuryLedgerRow) => {
    const key = rowKey(row);
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedKeys(new Set());
    setBatchOpen(false);
  };

  const selectedRows = useMemo(() => {
    if (!ledger?.rows) return [] as TreasuryLedgerRow[];
    return ledger.rows.filter((r) => selectedKeys.has(rowKey(r)));
  }, [ledger, selectedKeys]);

  const selectedGross = useMemo(
    () => selectedRows.reduce((acc, r) => acc + r.amount, 0),
    [selectedRows],
  );

  const openBatchForm = () => {
    if (selectedRows.length === 0) return;
    setError("");
    setInfo("");
    // Default bank date = latest selected row's date, or today if newer
    const latest = selectedRows
      .map((r) => r.date)
      .sort()
      .pop() ?? todayIso();
    setBatchBankDate(latest > todayIso() ? latest : todayIso() >= latest ? todayIso() : latest);
    setBatchSettled(selectedGross);
    setBatchNotes("");
    setBatchOpen(true);
  };

  const handleSaveBatch = async () => {
    if (selectedRows.length === 0) return;
    if (!Number.isFinite(batchSettled) || batchSettled < 0) {
      setError("Bank-credited amount must be zero or positive");
      return;
    }
    const links: BankDepositLinkPayload[] = selectedRows.map((r) => ({
      linkedKind: r.kind,
      linkedRefId: r.refId as string,
      linkedDate: r.date,
      grossAmount: r.amount,
    }));
    setBatchSaving(true);
    setError("");
    setInfo("");
    try {
      await createBankDeposit({
        bankDate: batchBankDate,
        totalSettled: batchSettled,
        notes: batchNotes.trim() || undefined,
        links,
      });
      setInfo(`Bank deposit recorded for ${links.length} row${links.length === 1 ? "" : "s"}.`);
      clearSelection();
      setReloadTick((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save bank deposit");
    } finally {
      setBatchSaving(false);
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
    let rows: TreasuryLedgerRow[];
    if (filter === "ALL") {
      rows = ledger.rows;
    } else if (filter === "PENDING") {
      rows = ledger.rows.filter((r) => {
        if (!r.pending) return false;
        if (pendingPlatform && r.platform !== pendingPlatform) return false;
        return true;
      });
    } else {
      rows = ledger.rows.filter((r) => r.category === filter);
    }
    return [...rows].reverse();
  }, [ledger, filter, pendingPlatform]);

  /** Pending totals by platform, used to show "Pending Wolt 1200 PLN" filter pills. */
  const pendingByPlatform = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    if (!ledger?.rows) return map;
    for (const r of ledger.rows) {
      if (!r.pending) continue;
      const key = r.platform ?? "other";
      const cur = map.get(key) ?? { count: 0, total: 0 };
      cur.count++;
      cur.total += r.amount;
      map.set(key, cur);
    }
    return map;
  }, [ledger]);

  const pendingTotalAll = useMemo(
    () => Array.from(pendingByPlatform.values()).reduce((acc, v) => acc + v.total, 0),
    [pendingByPlatform],
  );
  const pendingCountAll = useMemo(
    () => Array.from(pendingByPlatform.values()).reduce((acc, v) => acc + v.count, 0),
    [pendingByPlatform],
  );

  const selectAllVisiblePending = () => {
    if (!ledger?.rows) return;
    setSelectedKeys(new Set(
      visibleRows.filter(isBatchable).map(rowKey)
    ));
  };

  const setSource = (next: TreasuryLedgerSource) => {
    const params = new URLSearchParams(searchParams);
    params.set("source", next.toLowerCase());
    params.set("from", from);
    params.set("to", to);
    setSearchParams(params, { replace: true });
    clearAllEditors();
  };

  const setFilter = (next: CategoryFilter, platform?: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (next === "ALL") {
      params.delete("filter");
      params.delete("platform");
    } else {
      params.set("filter", next.toLowerCase());
      if (next === "PENDING" && platform) params.set("platform", platform);
      else params.delete("platform");
    }
    setSearchParams(params, { replace: true });
  };

  const sourceTitle = source === "CASH" ? "Cash history" : "Card / bank history";
  const sourceSubtitle =
    source === "CASH"
      ? "Every cash movement broken down by category — income, shift expenses, post-close expenses, salaries, and transfers."
      : "Tap any income row to settle it against the bank — or check multiple rows to reconcile them all under a single bank deposit (e.g. weekend sales settled on Monday).";

  const batchVariance = batchSettled - selectedGross;

  return (
    <div className="space-y-4 pb-24">
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

      {batchOpen && (
        <FinanceAddPanel
          title="Reconcile as bank deposit"
          subtitle={`${selectedRows.length} row${selectedRows.length === 1 ? "" : "s"} selected · gross ${fmt(selectedGross)} PLN. Enter the actual amount the bank credited — the difference will be distributed across the selected rows.`}
          onClose={() => setBatchOpen(false)}
        >
          <div className="space-y-3">
            <div className="rounded-xl border border-black/5 bg-white p-3 max-h-44 overflow-y-auto">
              <ul className="divide-y divide-black/5 text-sm">
                {selectedRows.map((r) => (
                  <li key={rowKey(r)} className="py-1.5 flex items-center justify-between gap-2">
                    <span className="truncate">
                      <span className="text-[var(--color-muted)] mr-1.5">{formatDate(r.date)}</span>
                      {r.label}
                    </span>
                    <span className="tabular-nums shrink-0">{fmt(r.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <label className="field-label">
              Bank deposit date
              <input
                type="date"
                className="field-input"
                value={batchBankDate}
                onChange={(e) => setBatchBankDate(e.target.value)}
              />
            </label>
            <AmountField
              label="What did the bank credit (total)?"
              className="field-label"
              inputClassName="field-input"
              value={batchSettled}
              onChange={setBatchSettled}
            />
            <div
              className={`rounded-xl px-3 py-2 text-sm font-medium tabular-nums ${
                Math.abs(batchVariance) < 0.005
                  ? "bg-black/5 text-[var(--color-muted)]"
                  : batchVariance < 0
                    ? "bg-rose-50 text-rose-800 border border-rose-200/60"
                    : "bg-emerald-50 text-emerald-800 border border-emerald-200/60"
              }`}
            >
              {Math.abs(batchVariance) < 0.005 ? (
                <>Matches the selection — no adjustment will be applied.</>
              ) : (
                <>
                  Variance:{" "}
                  <strong>
                    {batchVariance >= 0 ? "+" : "−"}
                    {fmt(Math.abs(batchVariance))} PLN
                  </strong>
                  <span className="block text-xs font-normal mt-0.5">
                    Each row will be reduced/increased pro-rata to add up to the bank deposit.
                  </span>
                </>
              )}
            </div>
            <label className="field-label">
              Notes (optional)
              <input
                type="text"
                className="field-input"
                placeholder="Wolt weekly settlement / POS fee 1.5%…"
                value={batchNotes}
                onChange={(e) => setBatchNotes(e.target.value)}
              />
            </label>
            <Button
              variant="dark"
              fullWidth
              disabled={batchSaving}
              onClick={() => void handleSaveBatch()}
            >
              {batchSaving ? "Saving…" : "Save bank deposit"}
            </Button>
          </div>
        </FinanceAddPanel>
      )}

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

          {source === "CARD" && pendingCountAll > 0 && (
            <Card className="!p-3 border-amber-200 bg-amber-50/60">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                  Pending bank settlement
                </span>
                <span className="text-xs text-amber-900/80">
                  {pendingCountAll} row{pendingCountAll === 1 ? "" : "s"} · {fmt(pendingTotalAll)} {ledger?.currency ?? "PLN"} projected
                </span>
                <div className="flex-1" />
                {(filter === "PENDING" || selectedKeys.size === 0) && (
                  <Button
                    variant="secondary"
                    onClick={selectAllVisiblePending}
                    disabled={visibleRows.filter(isBatchable).length === 0}
                  >
                    Select all visible
                  </Button>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setFilter(filter === "PENDING" && !pendingPlatform ? "ALL" : "PENDING", null)}
                  className={`tab-pill text-xs ${
                    filter === "PENDING" && !pendingPlatform ? "tab-pill-active" : "tab-pill-idle"
                  }`}
                >
                  All pending
                </button>
                {PLATFORMS.filter((p) => pendingByPlatform.has(p.key)).map((p) => {
                  const info = pendingByPlatform.get(p.key)!;
                  const active = filter === "PENDING" && pendingPlatform === p.key;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setFilter(active ? "ALL" : "PENDING", active ? null : p.key)}
                      className={`tab-pill text-xs ${active ? "tab-pill-active" : "tab-pill-idle"}`}
                      title={`${info.count} unreconciled day${info.count === 1 ? "" : "s"}`}
                    >
                      Pending {p.label} · {fmt(info.total)}
                    </button>
                  );
                })}
              </div>
            </Card>
          )}

          <Card>
            <h3 className="font-semibold mb-3">
              Movements
              {filter !== "ALL" && filter !== "PENDING" && (
                <span className="text-sm font-normal text-[var(--color-muted)] ml-2">
                  · {CATEGORY_LABELS[filter]}
                </span>
              )}
              {filter === "PENDING" && (
                <span className="text-sm font-normal text-amber-800 ml-2">
                  · Pending bank settlement{pendingPlatform ? ` · ${
                    PLATFORMS.find((p) => p.key === pendingPlatform)?.label ?? pendingPlatform
                  }` : ""}
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
                  const batchable = source === "CARD" && isBatchable(row);
                  const isOpen = openRowKey === rowKey(row);
                  const checked = selectedKeys.has(rowKey(row));
                  return (
                    <LedgerRowItem
                      key={key}
                      row={row}
                      reconcilable={reconcilable}
                      batchable={batchable}
                      checked={checked}
                      onToggleCheck={() => toggleSelected(row)}
                      open={isOpen}
                      onOpen={() => openReconcile(row)}
                      onClose={closeReconcile}
                      onRemoveOverride={() => void handleRemoveOverride(row)}
                      onRemoveDeposit={() => void handleRemoveDeposit(row)}
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

      {selectedKeys.size > 0 && !batchOpen && (
        <div className="fixed bottom-0 inset-x-0 z-30 px-3 pb-3 pointer-events-none">
          <div className="max-w-3xl mx-auto pointer-events-auto rounded-2xl bg-[var(--color-ink)] text-white shadow-2xl px-4 py-3 flex items-center gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-sm">
                {selectedKeys.size} row{selectedKeys.size === 1 ? "" : "s"} selected
              </p>
              <p className="text-xs text-white/70 tabular-nums">
                gross {fmt(selectedGross)} PLN
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={clearSelection}
                className="text-xs font-medium text-white/70 hover:text-white px-2 py-1"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={openBatchForm}
                className="text-sm font-semibold bg-[var(--color-saffron)] text-[var(--color-ink)] rounded-xl px-3 py-2"
              >
                Reconcile as bank deposit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type LedgerRowItemProps = {
  row: TreasuryLedgerRow;
  reconcilable: boolean;
  batchable: boolean;
  checked: boolean;
  onToggleCheck: () => void;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onRemoveOverride: () => void;
  onRemoveDeposit: () => void;
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
  batchable,
  checked,
  onToggleCheck,
  open,
  onOpen,
  onClose,
  onRemoveOverride,
  onRemoveDeposit,
  settled,
  onSettledChange,
  notesValue,
  onNotesChange,
  saving,
  onSave,
}: LedgerRowItemProps) {
  const isInflow = row.sign === "+";
  const overridden = !!row.settledOverride;
  const inDeposit = !!row.bankDepositId;
  const pending = !!row.pending;
  const original = typeof row.originalAmount === "number" ? row.originalAmount : null;
  const variance = original != null ? row.amount - original : 0;

  return (
    <li className={`py-3 ${pending ? "bg-amber-50/40 -mx-2 px-2 rounded-lg" : ""}`}>
      <div className="flex items-start gap-3">
        {batchable && (
          <label className="shrink-0 pt-0.5">
            <input
              type="checkbox"
              checked={checked}
              onChange={onToggleCheck}
              className="w-4 h-4 accent-[var(--color-saffron)]"
              aria-label={`Select ${row.label}`}
            />
          </label>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium truncate">{row.label}</p>
            <Badge variant={CATEGORY_VARIANT[row.category]}>{CATEGORY_LABELS[row.category]}</Badge>
            {pending && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                title="Awaiting bank deposit — not yet counted in card balance"
              >
                Pending bank settlement
              </span>
            )}
            {overridden && <Badge variant="draft">Settled</Badge>}
            {inDeposit && (
              <Badge variant="locked">
                Bank deposit {row.bankDepositDate ? formatDate(row.bankDepositDate) : ""}
              </Badge>
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
          {inDeposit && original != null && (
            <p className="text-xs text-[var(--color-muted)] mt-1 tabular-nums">
              this row's share: {fmt(row.amount)} of {fmt(row.bankDepositSettled ?? 0)} total
              {typeof row.bankDepositLinkCount === "number" && row.bankDepositLinkCount > 1 && (
                <> · part of {row.bankDepositLinkCount}-day batch</>
              )}
            </p>
          )}
          {overridden && !inDeposit && original != null && (
            <p className="text-xs text-[var(--color-muted)] mt-1 tabular-nums">
              originally {fmt(original)} · settled {fmt(row.amount)} ·{" "}
              <span className={variance >= 0 ? "text-emerald-700" : "text-rose-700"}>
                variance {variance >= 0 ? "+" : "−"}
                {fmt(Math.abs(variance))}
              </span>
            </p>
          )}
          {row.bankDepositNotes && (
            <p className="text-xs text-[var(--color-muted)] mt-1 italic">
              note: {row.bankDepositNotes}
            </p>
          )}
          {row.settledNotes && !inDeposit && (
            <p className="text-xs text-[var(--color-muted)] mt-1 italic">
              note: {row.settledNotes}
            </p>
          )}
          {row.notes && !row.settledNotes && !row.bankDepositNotes && (
            <p className="text-xs text-[var(--color-muted)] mt-1 italic">{row.notes}</p>
          )}

          {/* Per-row actions */}
          {inDeposit && (
            <div className="flex items-center gap-3 mt-1.5">
              <button
                type="button"
                onClick={onRemoveDeposit}
                className="text-xs font-medium text-rose-600 hover:underline"
              >
                Remove bank deposit
              </button>
            </div>
          )}
          {reconcilable && !inDeposit && !open && (
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
          {(overridden || inDeposit) && original != null && Math.abs(variance) >= 0.005 && (
            <p className="text-xs text-[var(--color-muted)] line-through">
              {fmt(original)}
            </p>
          )}
          <p
            className={`font-semibold ${
              pending
                ? "text-amber-700"
                : isInflow
                  ? "text-emerald-700"
                  : "text-rose-700"
            }`}
          >
            {isInflow ? "+" : "−"}
            {fmt(row.amount)}
          </p>
          <p className="text-xs text-[var(--color-muted)] mt-0.5">
            {pending ? (
              <span className="text-amber-700">awaiting bank · balance unchanged</span>
            ) : (
              <>balance {fmt(row.runningBalance)}</>
            )}
          </p>
        </div>
      </div>

      {open && (
        <ReconcileForm
          settled={settled}
          onSettledChange={onSettledChange}
          notesValue={notesValue}
          onNotesChange={onNotesChange}
          saving={saving}
          onSave={onSave}
          onClose={onClose}
          row={row}
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
