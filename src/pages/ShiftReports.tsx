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
    loadList();
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
      <div>
        <PageHeader
          title="Shift reports"
          subtitle="Totals grouped by day"
          action={
            <Button variant="secondary" className="!py-2.5 !px-4 text-sm" onClick={() => setTab("list")}>
              ← Report list
            </Button>
          }
        />
        <TreasurySummaryCards className="mb-6" compact />
        <AdminHistory embedded />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Shift reports"
        subtitle="Find, create, and edit cashier daily reports"
        action={
          <Button
            variant="secondary"
            className="!py-2.5 !px-4 text-sm"
            onClick={() => setTab("summary")}
          >
            Summary by day
          </Button>
        }
      />

      <TreasurySummaryCards className="mb-6" compact />

      <Card className="mb-6 !p-5 border-2 border-[var(--color-saffron)]/35 bg-gradient-to-br from-[var(--color-saffron)]/10 to-white">
        <h2 className="font-semibold text-lg text-[var(--color-ink)]">Create or open a report</h2>
        <p className="text-sm text-[var(--color-muted)] mt-1 mb-4">
          Choose the <strong>business date</strong> and <strong>cashier</strong>. Opens the full report
          form — create a new draft or edit an existing one.
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
      </Card>

      <Card className="mb-4 space-y-4">
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
        <Button variant="dark" fullWidth onClick={loadList} disabled={loading}>
          {loading ? "Loading…" : "Refresh list"}
        </Button>
      </Card>

      {error && (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      )}

      {loading ? (
        <Spinner label="Loading reports…" />
      ) : sortedReports.length === 0 ? (
        <EmptyState
          title="No reports in this range"
          description="Try a wider date range, or use “Open report” above to create one for a specific day."
          action={
            <Button variant="secondary" onClick={openNewReport}>
              Create report
            </Button>
          }
        />
      ) : (
        <div className="space-y-2 pb-8">
          <p className="text-sm text-[var(--color-muted)] mb-3">
            <strong className="text-[var(--color-ink)]">{sortedReports.length}</strong> report
            {sortedReports.length === 1 ? "" : "s"} · newest first
          </p>
          {sortedReports.map((r) => {
            const sales = totalSalesFromEntry(r);
            return (
              <Link
                key={r.id}
                to={entryEditorUrl(r.date, r.cashierId)}
                className="block rounded-2xl border border-black/8 bg-white p-4 hover:border-[var(--color-saffron)]/40 hover:shadow-md transition"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[var(--color-ink)]">
                      {r.cashier?.name ?? "Cashier"}
                    </p>
                    <p className="text-sm text-[var(--color-muted)] mt-0.5">
                      {formatReportDateShort(r.date)}
                      <span className="mx-1.5">·</span>
                      <span className="text-[var(--color-saffron-dark)] font-medium">
                        {reportDateRelativeLabel(r.date)}
                      </span>
                    </p>
                    <div className="mt-2">
                      <Badge variant={entryStatusBadge(r.status)}>
                        {r.status === "LOCKED" ? "Submitted" : "Draft"}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[var(--color-muted)] uppercase tracking-wide">
                      Cash difference
                    </p>
                    <p
                      className={`text-xl font-bold tabular-nums ${
                        r.difference < -0.01 ? "text-[var(--color-danger)]" : "text-[var(--color-ink)]"
                      }`}
                    >
                      {fmt(r.difference)}
                    </p>
                    <p className="text-xs text-[var(--color-muted)] mt-1">Sales {fmt(sales)}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
