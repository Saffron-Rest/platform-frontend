import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { fmt, totalSalesFromEntry } from "../lib/calc";
import { todayLocalIso } from "../lib/dates";
import { entryEditorUrl } from "../lib/reportNav";
import { formatReportDateShort, reportDateRelativeLabel } from "../lib/reportDates";
import type { DailyEntry, User } from "../types";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge, entryStatusBadge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { Spinner } from "../components/ui/Spinner";
import { Alert } from "../components/ui/Alert";
import { AdminHistory } from "./AdminHistory";
import { TreasurySummaryCards } from "../components/admin/TreasurySummaryCards";

const todayIso = todayLocalIso;

function monthStartIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function weekStartIso() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

type Tab = "list" | "summary";

function ReportListCard({ report }: { report: DailyEntry }) {
  const sales = totalSalesFromEntry(report);
  const submitted = report.status === "LOCKED";
  const short = report.difference < -0.01;

  return (
    <Link
      to={entryEditorUrl(report.date, report.cashierId)}
      className={`block rounded-2xl border bg-white p-4 hover:shadow-md transition group ${
        submitted
          ? "border-black/8 hover:border-[var(--color-success)]/35"
          : "border-[var(--color-saffron)]/25 hover:border-[var(--color-saffron)]/50"
      }`}
    >
      <div className="flex gap-3">
        <div
          className={`w-1 shrink-0 rounded-full self-stretch min-h-[3rem] ${
            submitted ? "bg-[var(--color-success)]/50" : "bg-[var(--color-saffron)]"
          }`}
          aria-hidden
        />
        <div className="flex-1 min-w-0 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-[var(--color-ink)] group-hover:text-[var(--color-saffron-dark)]">
              {report.cashier?.name ?? "Cashier"}
            </p>
            <div className="mt-2">
              <Badge variant={entryStatusBadge(report.status)}>
                {submitted ? "Submitted" : "Draft"}
              </Badge>
            </div>
            <p className="text-xs text-[var(--color-muted)] mt-2">
              Sales {fmt(sales)}
              {report.closingOnly && " · closing shift"}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Difference</p>
            <p
              className={`text-xl font-bold tabular-nums ${
                short ? "text-[var(--color-danger)]" : "text-[var(--color-ink)]"
              }`}
            >
              {fmt(report.difference)}
            </p>
            <p className="text-xs text-[var(--color-saffron)] font-medium mt-1 opacity-0 group-hover:opacity-100 transition">
              Open →
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function ShiftReports() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: Tab = searchParams.get("view") === "summary" ? "summary" : "list";

  const [cashiers, setCashiers] = useState<User[]>([]);
  const [reports, setReports] = useState<DailyEntry[]>([]);
  const [from, setFrom] = useState(weekStartIso);
  const [to, setTo] = useState(todayIso);
  const [filterCashierId, setFilterCashierId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [newDate, setNewDate] = useState(todayIso);
  const [newCashierId, setNewCashierId] = useState("");

  const setTab = (next: Tab) => {
    const p = new URLSearchParams(searchParams);
    if (next === "summary") p.set("view", "summary");
    else p.delete("view");
    setSearchParams(p, { replace: true });
  };

  useEffect(() => {
    api<User[]>("/users")
      .then((list) => {
        const active = list.filter((u) => u.role === "CASHIER" && u.active !== false);
        setCashiers(active);
        if (active.length && !newCashierId) setNewCashierId(active[0].id);
      })
      .catch(() => {});
  }, []);

  const loadList = useCallback(async () => {
    if (tab !== "list") return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ from, to });
      if (filterCashierId) params.set("cashierId", filterCashierId);
      if (filterStatus) params.set("status", filterStatus);
      const list = await api<DailyEntry[]>(`/entries?${params}`);
      setReports(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reports");
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [from, to, filterCashierId, filterStatus, tab]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const sortedReports = useMemo(
    () =>
      [...reports].sort((a, b) => {
        const d = b.date.localeCompare(a.date);
        if (d !== 0) return d;
        return (a.cashier?.name ?? "").localeCompare(b.cashier?.name ?? "");
      }),
    [reports]
  );

  const groupedByDate = useMemo(() => {
    const map = new Map<string, DailyEntry[]>();
    for (const r of sortedReports) {
      const list = map.get(r.date) ?? [];
      list.push(r);
      map.set(r.date, list);
    }
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [sortedReports]);

  const stats = useMemo(() => {
    const draft = reports.filter((r) => r.status !== "LOCKED").length;
    const submitted = reports.filter((r) => r.status === "LOCKED").length;
    const sales = reports.reduce((s, r) => s + totalSalesFromEntry(r), 0);
    return { draft, submitted, sales, total: reports.length };
  }, [reports]);

  const todayIsoVal = todayIso();
  const todayReports = useMemo(
    () => sortedReports.filter((r) => r.date === todayIsoVal),
    [sortedReports, todayIsoVal]
  );
  const groupedExcludingToday = useMemo(
    () => groupedByDate.filter(([date]) => date !== todayIsoVal),
    [groupedByDate, todayIsoVal]
  );

  const applyPreset = (key: "today" | "week" | "month") => {
    const t = todayIso();
    if (key === "today") {
      setFrom(t);
      setTo(t);
    } else if (key === "week") {
      setFrom(weekStartIso());
      setTo(t);
    } else {
      setFrom(monthStartIso());
      setTo(t);
    }
  };

  const openNewReport = () => {
    if (!newCashierId) {
      setError("Choose a cashier for the new report.");
      return;
    }
    navigate(entryEditorUrl(newDate, newCashierId));
  };

  if (tab === "summary") {
    return (
      <div className="space-y-6">
        <PageHeader title="Shift reports" subtitle="Totals grouped by day" />
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={() => setTab("list")} className="tab-pill tab-pill-active">
            ← Back to list
          </button>
        </div>
        <TreasurySummaryCards compact />
        <AdminHistory embedded />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shift reports"
        subtitle="Find, create, and edit cashier daily reports"
      />

      <div className="flex gap-2 flex-wrap">
        <button type="button" onClick={() => setTab("list")} className="tab-pill tab-pill-active">
          All reports
        </button>
        <button type="button" onClick={() => setTab("summary")} className="tab-pill tab-pill-idle">
          Summary by day
        </button>
      </div>

      <TreasurySummaryCards compact />

      <Card
        data-tour="tour-reports-open"
        className="!p-5 border-2 border-[var(--color-saffron)]/35 bg-gradient-to-br from-[var(--color-saffron)]/10 to-white"
      >
        <h2 className="font-semibold text-lg text-[var(--color-ink)]">Open a report</h2>
        <p className="text-sm text-[var(--color-muted)] mt-1 mb-4">
          Pick the business date and cashier. You will get the full form — new draft or existing report.
        </p>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="field-label">
            Report date
            <input
              type="date"
              value={newDate}
              max={todayIso()}
              onChange={(e) => setNewDate(e.target.value)}
              className="field-input bg-white"
            />
          </label>
          <label className="field-label">
            Cashier
            <select
              value={newCashierId}
              onChange={(e) => setNewCashierId(e.target.value)}
              className="field-input bg-white"
            >
              <option value="">Select cashier…</option>
              {cashiers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <Button className="!py-3 sm:min-w-[10rem]" onClick={openNewReport}>
            Open report
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[var(--color-saffron)]/20">
          <Button
            variant="secondary"
            className="!py-2 !px-3 text-sm"
            onClick={() => {
              setNewDate(todayIso());
              applyPreset("today");
            }}
          >
            Jump to today
          </Button>
        </div>
      </Card>

      {!loading && stats.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatChip label="Reports" value={String(stats.total)} />
          <StatChip label="Drafts" value={String(stats.draft)} warn={stats.draft > 0} />
          <StatChip label="Submitted" value={String(stats.submitted)} />
          <StatChip label="Sales in range" value={fmt(stats.sales)} />
        </div>
      )}

      {todayReports.length > 0 && from <= todayIsoVal && to >= todayIsoVal && (
        <section>
          <h2 className="section-title mb-3">Today</h2>
          <div className="space-y-2">
            {todayReports.map((r) => (
              <ReportListCard key={r.id} report={r} />
            ))}
          </div>
        </section>
      )}

      <Card className="space-y-4" data-tour="tour-reports-filters">
        <h2 className="font-semibold text-[var(--color-ink)]">Browse reports</h2>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["Today", "today"],
              ["This week", "week"],
              ["This month", "month"],
            ] as const
          ).map(([label, key]) => (
            <button
              key={key}
              type="button"
              onClick={() => applyPreset(key)}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-black/5 hover:bg-[var(--color-saffron)]/15 transition"
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
              max={todayIso()}
              onChange={(e) => setTo(e.target.value)}
              className="field-input"
            />
          </label>
          <label className="field-label">
            Cashier
            <select
              value={filterCashierId}
              onChange={(e) => setFilterCashierId(e.target.value)}
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
            Status
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="field-input"
            >
              <option value="">All</option>
              <option value="LOCKED">Submitted</option>
              <option value="DRAFT">Draft</option>
            </select>
          </label>
        </div>
      </Card>

      {error && (
        <Alert variant="error">{error}</Alert>
      )}

      {loading ? (
        <Spinner label="Loading reports…" />
      ) : sortedReports.length === 0 ? (
        <EmptyState
          title="No reports in this range"
          description="Try a wider date range, or use “Open report” above to create one."
          action={
            <Button variant="secondary" onClick={openNewReport}>
              Create report
            </Button>
          }
        />
      ) : (
        <section className="space-y-6 pb-8">
          {groupedExcludingToday.map(([date, dayReports]) => (
              <div key={date}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                  <h2 className="font-semibold text-[var(--color-ink)]">
                    {formatReportDateShort(date)}
                  </h2>
                  <span className="text-sm text-[var(--color-saffron-dark)] font-medium">
                    {reportDateRelativeLabel(date)}
                    <span className="text-[var(--color-muted)] font-normal mx-1.5">·</span>
                    {dayReports.length} report{dayReports.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="space-y-2">
                  {dayReports.map((r) => (
                    <ReportListCard key={r.id} report={r} />
                  ))}
                </div>
              </div>
            ))}
        </section>
      )}
    </div>
  );
}

function StatChip({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div
      className={`rounded-xl border px-3 py-2.5 ${
        warn ? "border-amber-200 bg-amber-50" : "border-black/6 bg-white"
      }`}
    >
      <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">{label}</p>
      <p className={`text-lg font-bold tabular-nums mt-0.5 ${warn ? "text-amber-900" : "text-[var(--color-ink)]"}`}>
        {value}
      </p>
    </div>
  );
}
