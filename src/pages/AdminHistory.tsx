import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { entryEditorUrl } from "../lib/reportNav";
import { api, downloadFile } from "../api/client";
import { buildReportExportPath, reportExportFilename } from "../lib/reportExport";
import { fmt } from "../lib/calc";
import type { User } from "../types";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge, entryStatusBadge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { Spinner } from "../components/ui/Spinner";
import { Alert } from "../components/ui/Alert";
import { StatGrid, type StatItem } from "../components/admin/StatGrid";

type CashflowTotals = {
  totalSales: number;
  cashSales: number;
  cardSales: number;
  platformSales: number;
  returns: number;
  expenses: number;
  payouts: number;
  expectedCash: number;
  actualCash: number;
  difference: number;
  cardBalance: number;
  draftCount: number;
  lockedCount: number;
};

type ReportRow = {
  id: string;
  date: string;
  cashierId: string;
  status: string;
  openingBalance: number;
  closingBalance: number;
  actualCashCounted: number;
  cardBalance?: number;
  totalSales: number;
  totalExpenses: number;
  difference: number;
  cashier?: { id: string; name: string };
};

type DayGroup = {
  date: string;
  reportCount: number;
  draftCount: number;
  lockedCount: number;
  drawerActual: number;
  totals: {
    totalSales: number;
    cashSales: number;
    cardSales: number;
    expenses: number;
    difference: number;
  };
  reports: ReportRow[];
};

type CashflowData = {
  from: string;
  to: string;
  reportCount: number;
  dayCount: number;
  totals: CashflowTotals;
  days: DayGroup[];
};

const todayIso = () => new Date().toISOString().slice(0, 10);

function monthStartIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function formatDayHeading(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatShortDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

type Props = { embedded?: boolean };

export function AdminHistory({ embedded }: Props = {}) {
  const navigate = useNavigate();
  const [cashflow, setCashflow] = useState<CashflowData | null>(null);
  const [cashiers, setCashiers] = useState<User[]>([]);
  const [from, setFrom] = useState(monthStartIso);
  const [to, setTo] = useState(todayIso);
  const [cashierId, setCashierId] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ from, to });
      if (cashierId) params.set("cashierId", cashierId);
      if (status) params.set("status", status);
      const data = await api<CashflowData>(`/analytics/cashflow?${params}`);
      setCashflow(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setCashflow(null);
    } finally {
      setLoading(false);
    }
  }, [from, to, cashierId, status]);

  useEffect(() => {
    api<User[]>("/users")
      .then((list) => setCashiers(list.filter((u) => u.role === "CASHIER")))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const periodStats: StatItem[] = useMemo(() => {
    if (!cashflow) return [];
    const t = cashflow.totals;
    return [
      { label: "Total sales", value: t.totalSales, accent: true },
      { label: "Cash sales", value: t.cashSales },
      { label: "Card sales", value: t.cardSales },
      { label: "Platforms", value: t.platformSales },
      { label: "Returns", value: t.returns },
      { label: "Expenses", value: t.expenses },
      { label: "Payouts", value: t.payouts },
      { label: "Expected cash", value: t.expectedCash, sub: "Opening + cash sales − cash out (per shift)" },
      { label: "Actual counted", value: t.actualCash, sub: "Sum of all shift counts" },
      { label: "Card balance", value: t.cardBalance },
      {
        label: "Cash difference",
        value: t.difference,
        warn: t.difference < -0.01,
      },
    ];
  }, [cashflow]);

  const applyPreset = (preset: "week" | "month" | "30") => {
    const end = new Date();
    const start = new Date();
    if (preset === "week") {
      const day = end.getDay();
      const diff = day === 0 ? 6 : day - 1;
      start.setDate(end.getDate() - diff);
    } else if (preset === "month") {
      start.setDate(1);
    } else {
      start.setDate(end.getDate() - 29);
    }
    setFrom(start.toISOString().slice(0, 10));
    setTo(end.toISOString().slice(0, 10));
  };

  const toggleDay = (date: string) => {
    setCollapsed((c) => ({ ...c, [date]: !c[date] }));
  };

  const exportPdf = async () => {
    setExporting(true);
    setError("");
    try {
      const path = buildReportExportPath("pdf", {
        from,
        to,
        cashierId: cashierId || undefined,
        status: status || undefined,
      });
      await downloadFile(path, reportExportFilename("pdf", from, to));
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      {!embedded && (
        <PageHeader
          title="Reports"
          subtitle="Cash flow, balances, and shift reports by date"
          action={
            <div className="flex flex-wrap gap-2 justify-end">
              <Button
                variant="secondary"
                className="!py-2.5 !px-4 text-sm"
                onClick={() => void exportPdf()}
                disabled={exporting || loading}
              >
                {exporting ? "Exporting…" : "Export PDF"}
              </Button>
              <Button className="!py-2.5 !px-4 text-sm" onClick={() => navigate("/reports")}>
                All reports
              </Button>
            </div>
          }
        />
      )}
      {embedded && (
        <div className="flex flex-wrap gap-2 justify-end mb-4">
          <Button
            variant="secondary"
            className="!py-2.5 !px-4 text-sm"
            onClick={() => void exportPdf()}
            disabled={exporting || loading}
          >
            {exporting ? "Exporting…" : "Export PDF"}
          </Button>
        </div>
      )}

      <Card className="mb-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["This week", "week"],
              ["This month", "month"],
              ["Last 30 days", "30"],
            ] as const
          ).map(([label, key]) => (
            <button
              key={key}
              type="button"
              onClick={() => applyPreset(key)}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-black/5 hover:bg-black/10 transition"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="field-label">
            From
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="field-input" />
          </label>
          <label className="field-label">
            To
            <input type="date" value={to} min={from} max={todayIso()} onChange={(e) => setTo(e.target.value)} className="field-input" />
          </label>
          <label className="field-label">
            Cashier
            <select value={cashierId} onChange={(e) => setCashierId(e.target.value)} className="field-input">
              <option value="">All cashiers</option>
              {cashiers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="field-input">
              <option value="">All</option>
              <option value="LOCKED">Submitted only</option>
              <option value="DRAFT">Draft only</option>
            </select>
          </label>
        </div>
        <Button variant="dark" fullWidth onClick={load} disabled={loading}>
          {loading ? "Loading…" : "Update"}
        </Button>
      </Card>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      {loading && !cashflow ? (
        <Spinner label="Loading reports…" />
      ) : !cashflow || cashflow.reportCount === 0 ? (
        <EmptyState
          title="No reports in this period"
          description="Widen the date range or add a report for a past day."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                const params = new URLSearchParams({ date: from });
                if (cashierId) params.set("cashierId", cashierId);
                navigate(entryEditorUrl(from, cashierId || undefined));
              }}
            >
              Add report
            </Button>
          }
        />
      ) : (
        <>
          <div className="mb-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
              <p className="text-sm text-[var(--color-muted)]">
                {formatShortDate(cashflow.from)} – {formatShortDate(cashflow.to)} ·{" "}
                <strong className="text-[var(--color-ink)]">{cashflow.reportCount}</strong> reports across{" "}
                <strong className="text-[var(--color-ink)]">{cashflow.dayCount}</strong> days
              </p>
              <p className="text-xs text-[var(--color-muted)]">
                {cashflow.totals.lockedCount} submitted · {cashflow.totals.draftCount} draft
              </p>
            </div>
            <StatGrid items={periodStats} columns={3} />
          </div>

          <div className="space-y-4 pb-8">
            {cashflow.days.map((day) => {
              const isCollapsed = collapsed[day.date] === true;
              return (
                <Card key={day.date} className="!p-0 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleDay(day.date)}
                    className="w-full text-left px-4 py-4 md:px-5 bg-gradient-to-r from-[var(--color-cream)] to-white border-b border-black/5 hover:from-[var(--color-saffron)]/5 transition"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-lg">{formatDayHeading(day.date)}</p>
                        <p className="text-xs text-[var(--color-muted)] mt-0.5">
                          {day.reportCount} shift{day.reportCount === 1 ? "" : "s"}
                          {day.draftCount > 0 && ` · ${day.draftCount} draft`}
                          {day.lockedCount > 0 && ` · ${day.lockedCount} submitted`}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm">
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Sales</p>
                          <p className="font-bold tabular-nums">{fmt(day.totals.totalSales)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Drawer (last count)</p>
                          <p className="font-bold tabular-nums">{fmt(day.drawerActual)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Difference</p>
                          <p
                            className={`font-bold tabular-nums ${
                              day.totals.difference < -0.01 ? "text-[var(--color-danger)]" : ""
                            }`}
                          >
                            {fmt(day.totals.difference)}
                          </p>
                        </div>
                        <span className="self-center text-[var(--color-muted)] text-lg" aria-hidden>
                          {isCollapsed ? "▸" : "▾"}
                        </span>
                      </div>
                    </div>
                  </button>

                  {!isCollapsed && (
                    <ul className="divide-y divide-black/5">
                      {day.reports.map((r) => (
                        <li key={r.id}>
                          <Link
                            to={entryEditorUrl(day.date, r.cashierId)}
                            className="block px-4 py-4 md:px-5 hover:bg-[var(--color-cream)]/60 transition"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                              <div>
                                <p className="font-medium">{r.cashier?.name ?? "Cashier"}</p>
                                <div className="flex gap-1.5 mt-1">
                                  <Badge variant={entryStatusBadge(r.status)}>{r.status}</Badge>
                                </div>
                              </div>
                              <p
                                className={`text-lg font-bold tabular-nums ${
                                  r.difference < -0.01 ? "text-[var(--color-danger)]" : "text-[var(--color-ink)]"
                                }`}
                              >
                                {fmt(r.difference)}
                                <span className="text-xs font-normal text-[var(--color-muted)] ml-1">diff</span>
                              </p>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
                              {(
                                [
                                  ["Opening", r.openingBalance],
                                  ["Sales", r.totalSales],
                                  ["Expected", r.closingBalance],
                                  ["Actual", r.actualCashCounted],
                                  ["Expenses", r.totalExpenses],
                                  ["Card bal.", r.cardBalance ?? 0],
                                ] as const
                              ).map(([label, val]) => (
                                <div key={label} className="rounded-xl bg-[var(--color-cream)]/80 px-3 py-2">
                                  <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">{label}</p>
                                  <p className="font-semibold tabular-nums mt-0.5">{fmt(val)}</p>
                                </div>
                              ))}
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
