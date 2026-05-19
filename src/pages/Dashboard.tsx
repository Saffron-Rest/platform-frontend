import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { fmt } from "../lib/calc";
import { useAuth } from "../context/AuthContext";
import { canOperate, isCashier } from "../lib/roles";
import { TreasurySummaryCards } from "../components/admin/TreasurySummaryCards";
import { PageHeader } from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Badge, entryStatusBadge } from "../components/ui/Badge";
import { Spinner } from "../components/ui/Spinner";
import { EmptyState } from "../components/ui/EmptyState";
import { Alert } from "../components/ui/Alert";
import { StatGrid, type StatItem } from "../components/admin/StatGrid";
import type { WorkSchedule } from "../types";

type MonthTotals = {
  totalSales: number;
  cashSales: number;
  cardSales: number;
  platformSales: number;
  expenses: number;
  expectedCash: number;
  actualCash: number;
  difference: number;
  cardBalance: number;
};

function monthStartIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

type DashboardData = {
  date: string;
  totalSales: number;
  cashSales: number;
  cardSales: number;
  platforms: { wolt: number; bolt: number; uber: number; glovo: number; other: number };
  expenses: number;
  netCashFlow: number;
  difference: number;
  entries: { id: string; cashierId: string; cashier: string; status: string; difference: number }[];
};

export function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [monthTotals, setMonthTotals] = useState<MonthTotals | null>(null);
  const [schedule, setSchedule] = useState<WorkSchedule | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api<DashboardData>("/dashboard")
      .then(setData)
      .catch(() => setError(true));
    if (isCashier(user?.role)) {
      api<WorkSchedule>("/shifts/today")
        .then(setSchedule)
        .catch(() => setSchedule(null));
    }
    if (canOperate(user?.role)) {
      const to = new Date().toISOString().slice(0, 10);
      api<{ totals: MonthTotals }>(`/analytics/cashflow?from=${monthStartIso()}&to=${to}`)
        .then((r) => setMonthTotals(r.totals))
        .catch(() => setMonthTotals(null));
    }
  }, [user?.role]);

  if (!data) {
    return error ? (
      <EmptyState title="Could not load dashboard" description="Check that the backend is running." />
    ) : (
      <Spinner label="Loading dashboard…" />
    );
  }

  const cards = [
    { label: "Total sales", value: data.totalSales, accent: true },
    { label: "Cash", value: data.cashSales },
    { label: "Card", value: data.cardSales },
    { label: "Expenses", value: data.expenses },
    { label: "Net cash flow", value: data.netCashFlow },
    {
      label: "Difference",
      value: data.difference,
      warn: data.difference < -0.01,
    },
  ];

  return (
    <div>
      <PageHeader
        title={canOperate(user?.role) ? "Overview" : "Today"}
        subtitle={
          canOperate(user?.role)
            ? `${data.date} · Today’s restaurant totals`
            : `${data.date} · Your shift today`
        }
        action={
          <div className="flex gap-2">
            {canOperate(user?.role) && (
              <Link to="/reports">
                <Button className="!py-2.5 !px-4 text-sm">
                  Shift reports
                </Button>
              </Link>
            )}
            {!canOperate(user?.role) && (
              <Link to="/entry">
                <Button className="!py-2.5 !px-4 text-sm">+ Report</Button>
              </Link>
            )}
          </div>
        }
      />

      {canOperate(user?.role) && (
        <TreasurySummaryCards className="mb-6" />
      )}

      {isCashier(user?.role) && schedule && (
        <Alert variant={schedule.working ? "info" : "warning"} className="mb-4">
          {schedule.working ? (
            <>
              Your shift today: <strong>{schedule.hoursLabel}</strong>
              {schedule.closingOnly && " (closing report only)"}
            </>
          ) : (
            <>You are <strong>not scheduled</strong> to work today.</>
          )}
        </Alert>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`rounded-2xl p-4 border transition ${
              c.accent
                ? "bg-[var(--color-saffron)] text-white border-transparent col-span-2 md:col-span-1 shadow-md shadow-[var(--color-saffron)]/20"
                : c.warn
                  ? "bg-red-50 border-red-200"
                  : "bg-white border-black/[0.06] shadow-sm"
            }`}
          >
            <p className={`text-xs font-medium uppercase tracking-wide ${c.accent ? "text-white/80" : "text-[var(--color-muted)]"}`}>
              {c.label}
            </p>
            <p className="text-xl md:text-2xl font-bold mt-1 tabular-nums">{fmt(c.value)}</p>
          </div>
        ))}
      </div>

      {canOperate(user?.role) && monthTotals && (
        <Card className="mb-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
            <h3 className="font-semibold">This month — cash flow</h3>
            <Link to="/history" className="text-sm font-medium text-[var(--color-saffron)] hover:underline">
              View by date →
            </Link>
          </div>
          <StatGrid
            items={
              [
                { label: "Sales", value: monthTotals.totalSales, accent: true },
                { label: "Cash", value: monthTotals.cashSales },
                { label: "Card", value: monthTotals.cardSales },
                { label: "Expenses", value: monthTotals.expenses },
                { label: "Expected cash", value: monthTotals.expectedCash },
                { label: "Actual counted", value: monthTotals.actualCash },
                { label: "Card balance", value: monthTotals.cardBalance },
                {
                  label: "Difference",
                  value: monthTotals.difference,
                  warn: monthTotals.difference < -0.01,
                },
              ] satisfies StatItem[]
            }
            columns={3}
          />
        </Card>
      )}

      <Card className="mb-6">
        <h3 className="font-semibold mb-3">{canOperate(user?.role) ? "Today — platforms" : "Delivery platforms"}</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {(
            [
              ["Wolt", data.platforms.wolt],
              ["Bolt", data.platforms.bolt],
              ["Uber Eats", data.platforms.uber],
              ["Glovo", data.platforms.glovo],
              ["Other", data.platforms.other],
            ] as const
          ).map(([name, val]) => (
            <div key={name} className="flex justify-between py-1 border-b border-black/5 last:border-0">
              <span className="text-[var(--color-muted)]">{name}</span>
              <strong className="tabular-nums">{fmt(val)}</strong>
            </div>
          ))}
        </div>
      </Card>

      {canOperate(user?.role) && data.entries.length > 0 && (
        <Card>
          <h3 className="font-semibold mb-3">Today&apos;s shift reports</h3>
          <ul className="divide-y divide-black/5">
            {data.entries.map((e) => (
              <li key={e.id}>
                <Link
                  to={`/entry?date=${encodeURIComponent(data.date)}&cashierId=${encodeURIComponent(e.cashierId)}`}
                  className="flex justify-between items-center py-3 gap-3 hover:bg-[var(--color-cream)] -mx-2 px-2 rounded-lg transition"
                >
                  <span className="font-medium">{e.cashier}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={entryStatusBadge(e.status)}>{e.status}</Badge>
                    <span
                      className={`text-sm font-semibold tabular-nums ${
                        e.difference < -0.01 ? "text-[var(--color-danger)]" : ""
                      }`}
                    >
                      {fmt(e.difference)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {isCashier(user?.role) && data.entries.length > 0 && (
        <Card>
          <Link
            to="/entry"
            className="flex justify-between items-center gap-3 hover:bg-[var(--color-cream)] -mx-2 px-2 py-2 rounded-lg transition"
          >
            <span className="font-medium">Your report today</span>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={entryStatusBadge(data.entries[0].status)}>{data.entries[0].status}</Badge>
              <span
                className={`text-sm font-semibold tabular-nums ${
                  data.entries[0].difference < -0.01 ? "text-[var(--color-danger)]" : ""
                }`}
              >
                {fmt(data.entries[0].difference)}
              </span>
            </div>
          </Link>
        </Card>
      )}
    </div>
  );
}
