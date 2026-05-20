import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  getTreasuryLedger,
  type TreasuryLedger,
  type TreasuryLedgerKind,
  type TreasuryLedgerRow,
  type TreasuryLedgerSource,
} from "../api/treasury";
import { fmt } from "../lib/calc";
import { Alert } from "../components/ui/Alert";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { Spinner } from "../components/ui/Spinner";

const SOURCES: { value: TreasuryLedgerSource; label: string }[] = [
  { value: "CARD", label: "Card / bank" },
  { value: "CASH", label: "Cash" },
];

const KIND_LABELS: Record<TreasuryLedgerKind, string> = {
  SHIFT_REPORT: "Shift report",
  MANUAL_DELIVERY: "Delivery income",
  STANDALONE_EXPENSE: "Expense",
  SALARY_PAYOUT: "Salary",
};

const KIND_VARIANT: Record<TreasuryLedgerKind, "neutral" | "draft" | "inactive"> = {
  SHIFT_REPORT: "neutral",
  MANUAL_DELIVERY: "draft",
  STANDALONE_EXPENSE: "inactive",
  SALARY_PAYOUT: "inactive",
};

function monthStartIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function readSource(raw: string | null): TreasuryLedgerSource {
  const upper = (raw ?? "card").toUpperCase();
  return upper === "CASH" ? "CASH" : "CARD";
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

export function TreasuryHistory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const source = readSource(searchParams.get("source"));
  const [from, setFrom] = useState(searchParams.get("from") ?? monthStartIso());
  const [to, setTo] = useState(searchParams.get("to") ?? todayIso());
  const [ledger, setLedger] = useState<TreasuryLedger | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
  }, [source, from, to]);

  const sortedRows = useMemo(() => {
    if (!ledger?.rows) return [];
    return [...ledger.rows].reverse();
  }, [ledger]);

  const totals = useMemo(() => {
    if (!ledger?.rows) return { inflow: 0, outflow: 0 };
    return ledger.rows.reduce(
      (acc, row) => {
        if (row.sign === "+") acc.inflow += row.amount;
        else acc.outflow += row.amount;
        return acc;
      },
      { inflow: 0, outflow: 0 }
    );
  }, [ledger]);

  const setSource = (next: TreasuryLedgerSource) => {
    const params = new URLSearchParams(searchParams);
    params.set("source", next.toLowerCase());
    params.set("from", from);
    params.set("to", to);
    setSearchParams(params, { replace: true });
  };

  const sourceTitle = source === "CASH" ? "Cash history" : "Card / bank history";
  const sourceSubtitle =
    source === "CASH"
      ? "Every cash movement: shift reports, post-close expenses, and salary payouts."
      : "Every card / bank movement: shift card settlement, delivery income, expenses, and salary payouts.";

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
                Activity in range
              </p>
              <p className="text-sm tabular-nums mt-1 space-x-3">
                <span className="text-emerald-700 font-semibold">+ {fmt(totals.inflow)}</span>
                <span className="text-rose-700 font-semibold">− {fmt(totals.outflow)}</span>
              </p>
              <p className="text-xs text-[var(--color-muted)] mt-1">
                Net{" "}
                <strong>
                  {totals.inflow - totals.outflow >= 0 ? "+" : "−"}
                  {fmt(Math.abs(totals.inflow - totals.outflow))}
                </strong>
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

          <Card>
            <h3 className="font-semibold mb-3">Movements</h3>
            {sortedRows.length === 0 ? (
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
                {sortedRows.map((row, idx) => (
                  <LedgerRowItem key={`${row.kind}-${row.refId ?? idx}-${row.date}-${idx}`} row={row} />
                ))}
              </ul>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}

function LedgerRowItem({ row }: { row: TreasuryLedgerRow }) {
  const isInflow = row.sign === "+";
  return (
    <li className="py-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium truncate">{row.label}</p>
          <Badge variant={KIND_VARIANT[row.kind]}>{KIND_LABELS[row.kind]}</Badge>
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
        {row.notes && (
          <p className="text-xs text-[var(--color-muted)] mt-1 italic">{row.notes}</p>
        )}
      </div>
      <div className="text-right tabular-nums shrink-0">
        <p className={`font-semibold ${isInflow ? "text-emerald-700" : "text-rose-700"}`}>
          {isInflow ? "+" : "−"}
          {fmt(row.amount)}
        </p>
        <p className="text-xs text-[var(--color-muted)] mt-0.5">
          balance {fmt(row.runningBalance)}
        </p>
      </div>
    </li>
  );
}
