import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { fmt } from "../lib/calc";
import { useAuth } from "../context/AuthContext";
import { useOnboarding } from "../context/OnboardingContext";
import { Button } from "../components/ui/Button";
import { canOperate, isCashier } from "../lib/roles";
import { navGroupsForRole, allNavLinks } from "../lib/navigation";
import { TreasurySummaryCards } from "../components/admin/TreasurySummaryCards";
import { QuickActionGrid } from "../components/hub/QuickActionGrid";
import { HubSection } from "../components/hub/HubSection";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Badge, entryStatusBadge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton, SkeletonText } from "../components/ui/Skeleton";
import { Alert } from "../components/ui/Alert";
import type { WorkSchedule } from "../types";

type MonthTotals = {
  totalSales: number;
  cardBalance: number;
  difference: number;
};

type DashboardData = {
  date: string;
  totalSales: number;
  cashSales: number;
  cardSales: number;
  /** Manual delivery income recorded via Finance for today (already included in totalSales). */
  manualDeliverySales?: number;
  platforms: { wolt: number; bolt: number; uber: number; glovo: number; other: number };
  expenses: number;
  difference: number;
  entries: { id: string; cashierId: string; cashier: string; status: string; difference: number }[];
};

function monthStartIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function Dashboard() {
  const { user } = useAuth();
  const { openQuickGuide } = useOnboarding();
  const [data, setData] = useState<DashboardData | null>(null);
  const [monthTotals, setMonthTotals] = useState<MonthTotals | null>(null);
  const [schedule, setSchedule] = useState<WorkSchedule | null>(null);
  const [error, setError] = useState(false);

  const quickLinks = useMemo(() => {
    const groups = navGroupsForRole(user?.role);
    const links = allNavLinks(groups).filter((l) => l.to !== "/");
    if (isCashier(user?.role)) return links;
    return links.slice(0, 6);
  }, [user?.role]);

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
      <EmptyState title="Could not load home" description="Check that the backend is running." />
    ) : (
      <DashboardSkeleton />
    );
  }

  const greeting = canOperate(user?.role) ? "Restaurant overview" : `Hi, ${user?.name?.split(" ")[0] ?? "there"}`;

  return (
    <div className="space-y-8">
      <PageHeader
        kicker={canOperate(user?.role) ? "Overview" : "Today"}
        title={greeting}
        subtitle={
          canOperate(user?.role)
            ? `${data.date} · Sales today ${fmt(data.totalSales)}`
            : `${data.date} · Your shift`
        }
        action={
          <Button
            variant="secondary"
            className="!py-2 !px-4 text-sm"
            onClick={openQuickGuide}
            data-tour="tour-help"
          >
            Guided tour
          </Button>
        }
      />

      <HubSection title="Quick actions" tourId="tour-quick-actions">
        <QuickActionGrid items={quickLinks} accentFirst={isCashier(user?.role)} />
      </HubSection>

      {canOperate(user?.role) && (
        <HubSection title="Record quickly" tourId="tour-record-quickly">
          <div className="grid grid-cols-2 gap-3">
            <Link to="/finance?add=expense" className="hub-tile hub-tile-accent">
              <span className="text-2xl leading-none" aria-hidden>
                +
              </span>
              <span>
                <span className="block font-bold text-sm text-white">Add expense</span>
                <span className="block text-xs mt-0.5 text-white/80">Post-close or standalone</span>
              </span>
            </Link>
            <Link to="/finance?add=delivery" className="hub-tile hub-tile-accent">
              <span className="text-2xl leading-none" aria-hidden>
                +
              </span>
              <span>
                <span className="block font-bold text-sm text-white">Add delivery</span>
                <span className="block text-xs mt-0.5 text-white/80">Manual platform income</span>
              </span>
            </Link>
          </div>
        </HubSection>
      )}

      {canOperate(user?.role) && <TreasurySummaryCards tourId="tour-treasury" />}

      {isCashier(user?.role) && schedule && (
        <Alert variant={schedule.working ? "info" : "warning"}>
          {schedule.working ? (
            <>
              Scheduled today: <strong>{schedule.hoursLabel}</strong>
              {schedule.closingOnly && " · closing report only"}
            </>
          ) : (
            <>You are not scheduled to work today.</>
          )}
        </Alert>
      )}

      <HubSection title="Today’s numbers" tourId="tour-today-numbers">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatTile label="Total sales" value={data.totalSales} highlight />
          <StatTile label="Cash" value={data.cashSales} />
          <StatTile label="Card" value={data.cardSales} />
          <StatTile
            label="Platforms"
            value={
              data.platforms.wolt +
              data.platforms.bolt +
              data.platforms.uber +
              data.platforms.glovo +
              data.platforms.other
            }
          />
          <StatTile
            label="Drawer diff."
            value={data.difference}
            warn={data.difference < -0.01}
          />
        </div>
        {canOperate(user?.role) && (
          <p className="text-xs text-[var(--color-muted)] mt-2">
            Total sales = Cash + Card + Platforms (Wolt, Bolt, Uber, Glovo, other).
            {(data.manualDeliverySales ?? 0) > 0 && (
              <>
                {" "}
                Includes {fmt(data.manualDeliverySales ?? 0)} recorded via Finance.
              </>
            )}
          </p>
        )}
      </HubSection>

      {canOperate(user?.role) && monthTotals && (
        <Card className="!p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
            <h3 className="font-bold">This month</h3>
            <Link to="/reports" className="text-sm font-semibold text-[var(--color-saffron)] hover:underline">
              All reports →
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center sm:text-left sm:grid-cols-3">
            <div>
              <p className="text-xs text-[var(--color-muted)] font-semibold uppercase">Sales</p>
              <p className="text-xl font-bold tabular-nums mt-1">{fmt(monthTotals.totalSales)}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-muted)] font-semibold uppercase">Card pool</p>
              <p className="text-xl font-bold tabular-nums mt-1">{fmt(monthTotals.cardBalance)}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-muted)] font-semibold uppercase">Difference</p>
              <p
                className={`text-xl font-bold tabular-nums mt-1 ${
                  monthTotals.difference < -0.01 ? "text-[var(--color-danger)]" : ""
                }`}
              >
                {fmt(monthTotals.difference)}
              </p>
            </div>
          </div>
        </Card>
      )}

      {isCashier(user?.role) && data.entries.length === 0 && (
        <HubSection title="Your report" tourId="tour-your-report">
          <Card className="!p-5 text-center">
            <p className="font-semibold">No report started yet</p>
            <p className="text-sm text-[var(--color-muted)] mt-1">
              Open <strong>Shift report</strong> from quick actions to begin today&apos;s entry.
            </p>
            <Link to="/entry" className="inline-block mt-4">
              <Button>Open shift report</Button>
            </Link>
          </Card>
        </HubSection>
      )}

      {data.entries.length > 0 && (
        <HubSection
          title={canOperate(user?.role) ? "Today’s reports" : "Your report"}
          tourId={canOperate(user?.role) ? "tour-today-reports" : "tour-your-report"}
          action={
            canOperate(user?.role) ? (
              <Link to="/reports" className="text-sm font-semibold text-[var(--color-saffron)]">
                View all
              </Link>
            ) : undefined
          }
        >
          <Card className="!p-0 overflow-hidden divide-y divide-black/[0.06]">
            {(canOperate(user?.role) ? data.entries : [data.entries[0]]).map((e) => (
              <Link
                key={e.id}
                to={
                  canOperate(user?.role)
                    ? `/entry?date=${encodeURIComponent(data.date)}&cashierId=${encodeURIComponent(e.cashierId)}`
                    : "/entry"
                }
                className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-stone-50 transition"
              >
                <span className="font-semibold">{canOperate(user?.role) ? e.cashier : "Open report"}</span>
                <span className="flex items-center gap-2 shrink-0">
                  <Badge variant={entryStatusBadge(e.status)}>{e.status}</Badge>
                  <span
                    className={`text-sm font-bold tabular-nums ${
                      e.difference < -0.01 ? "text-[var(--color-danger)]" : ""
                    }`}
                  >
                    {fmt(e.difference)}
                  </span>
                </span>
              </Link>
            ))}
          </Card>
        </HubSection>
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
  highlight,
  warn,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-4 border ${
        highlight
          ? "bg-[var(--color-saffron)] text-white border-transparent col-span-2 lg:col-span-1"
          : warn
            ? "bg-red-50 border-red-200"
            : "surface-card"
      }`}
    >
      <p
        className={`text-xs font-bold uppercase tracking-wide ${
          highlight ? "text-white/75" : "text-[var(--color-muted)]"
        }`}
      >
        {label}
      </p>
      <p className="text-xl font-bold tabular-nums mt-1">{fmt(value)}</p>
    </div>
  );
}

/**
 * Skeleton placeholder for the dashboard while the initial fetch is in
 * flight. Mirrors the visual rhythm of the loaded page (header, quick-
 * actions row, hub cards) so the layout doesn't visibly jump when data
 * arrives.
 */
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-2/5" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="surface-card p-4 space-y-2">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-6 w-2/3" />
          </div>
        ))}
      </div>
      <div className="surface-card p-5 space-y-3">
        <Skeleton className="h-5 w-1/4" />
        <SkeletonText lines={3} />
      </div>
      <div className="surface-card p-5 space-y-3">
        <Skeleton className="h-5 w-1/3" />
        <SkeletonText lines={4} />
      </div>
    </div>
  );
}
