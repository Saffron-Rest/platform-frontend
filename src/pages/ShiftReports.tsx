import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { fmt, totalSalesFromEntry } from "../lib/calc";
import { todayLocalIso } from "../lib/dates";
import { entryEditorUrl } from "../lib/reportNav";
import { formatReportDateShort, reportDateRelativeLabel } from "../lib/reportDates";
import { canOperate } from "../lib/roles";
import { useAuth } from "../context/AuthContext";
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
import { TagFilterDropdown } from "../components/tags/TagFilterDropdown";
import { TagPicker } from "../components/tags/TagPicker";
import {
  CommentsDrawer,
  CommentsTrigger,
} from "../components/comments/CommentsDrawer";
import { ExportButton } from "../components/export/ExportButton";
import { SavedViewsBar } from "../components/savedViews/SavedViewsBar";
import { syncEntry } from "../api/entries";

type ShiftReportFilters = {
  from: string;
  to: string;
  filterCashierId: string;
  filterStatus: string;
  filterTagIds: string[];
};
import type { Tag } from "../api/tags";

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

function ReportListCard({
  report,
  onDelete,
  onSync,
  syncing,
  onTagsChange,
  onOpenComments,
  commentCountOverride,
}: {
  report: DailyEntry;
  /** Set only for admin/manager — when present, renders the inline Remove
   * action. The backend already gates on operations role and requires a
   * delete reason, this is purely a UI affordance. */
  onDelete?: (report: DailyEntry) => void;
  /** Force-recompute totals for this report on the server and refresh the
   *  card. Available to every role — the backend allows cashiers to sync
   *  their own entry and ops to sync any entry. */
  onSync?: (report: DailyEntry) => void;
  /** True while this card's sync is in-flight (parent owns the spinner). */
  syncing?: boolean;
  /** Notified when tags change so the parent can keep its list in sync
   *  without re-fetching. */
  onTagsChange?: (id: string, tags: Tag[]) => void;
  onOpenComments?: (report: DailyEntry) => void;
  /** Live count fed back from the drawer; falls back to the value the
   *  list endpoint returned at first load. */
  commentCountOverride?: number;
}) {
  const sales = totalSalesFromEntry(report);
  const submitted = report.status === "LOCKED";
  const short = report.difference < -0.01;
  const canDelete = !submitted && onDelete != null;
  const canSync = onSync != null;

  return (
    <div
      className={`rounded-2xl border bg-white hover:shadow-md transition group ${
        submitted
          ? "border-black/8 hover:border-[var(--color-success)]/35"
          : "border-[var(--color-saffron)]/25 hover:border-[var(--color-saffron)]/50"
      }`}
    >
    <Link
      to={entryEditorUrl(report.date, report.cashierId)}
      className="block p-4 rounded-t-2xl"
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
          <div className="text-right shrink-0 flex flex-col items-end gap-1">
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
            {canSync && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onSync!(report);
                }}
                disabled={syncing}
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[var(--color-saffron-dark)] hover:underline disabled:opacity-60 disabled:no-underline"
                title="Recompute totals from the latest data (expenses, manual deliveries, salary payments, treasury %)"
              >
                <span aria-hidden className={syncing ? "inline-block animate-spin" : "inline-block"}>↻</span>
                {syncing ? "Syncing…" : "Sync"}
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete!(report);
                }}
                className="mt-1 text-xs font-medium text-red-600 hover:underline"
                title="Remove this draft report"
              >
                Remove draft
              </button>
            )}
          </div>
        </div>
      </div>
    </Link>
    <div className="px-4 pb-3 -mt-1 border-t border-black/5 pt-2 flex items-center gap-3 flex-wrap">
      <TagPicker
        entityType="ENTRY"
        entityId={report.id}
        initialTags={report.tags ?? []}
        size="sm"
        onChange={(next) => onTagsChange?.(report.id, next)}
      />
      {onOpenComments && (
        <CommentsTrigger
          count={commentCountOverride ?? report.commentCount ?? 0}
          onClick={() => onOpenComments(report)}
        />
      )}
    </div>
    </div>
  );
}

export function ShiftReports() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canRemove = canOperate(user?.role);
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: Tab = searchParams.get("view") === "summary" ? "summary" : "list";

  const [cashiers, setCashiers] = useState<User[]>([]);
  const [reports, setReports] = useState<DailyEntry[]>([]);
  const [from, setFrom] = useState(weekStartIso);
  const [to, setTo] = useState(todayIso);
  const [filterCashierId, setFilterCashierId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);
  const [commentsFor, setCommentsFor] = useState<DailyEntry | null>(null);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);

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
      for (const id of filterTagIds) params.append("tagId", id);
      const list = await api<DailyEntry[]>(`/entries?${params}`);
      setReports(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reports");
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [from, to, filterCashierId, filterStatus, filterTagIds, tab]);

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

  const handleReportTagsChange = useCallback((id: string, tags: Tag[]) => {
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, tags } : r)));
  }, []);

  const handleDeleteReport = useCallback(
    async (report: DailyEntry) => {
      if (report.status === "LOCKED") {
        setError("Submitted reports must be unlocked before removal.");
        return;
      }
      // Backend requires a reason ≥ 3 chars; a native prompt keeps this
      // pleasant for the rare admin-only flow without dragging in a modal.
      const who = report.cashier?.name ?? "this cashier";
      const reason = window.prompt(
        `Remove the draft report for ${who} on ${report.date}?\n\nThis cannot be undone. Enter a short reason for the audit log (min 3 chars):`,
        ""
      );
      if (reason == null) return;
      const trimmed = reason.trim();
      if (trimmed.length < 3) {
        setError("Delete reason must be at least 3 characters.");
        return;
      }
      setError("");
      setMessage("");
      try {
        await api(`/entries/${report.id}`, {
          method: "DELETE",
          body: JSON.stringify({ reason: trimmed }),
        });
        setMessage(`Draft report for ${who} removed.`);
        setReports((prev) => prev.filter((r) => r.id !== report.id));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not remove report");
      }
    },
    []
  );

  /**
   * Re-sync a single report: hits {@code POST /entries/{id}/sync} to force a
   * server-side recompute, then patches that row in local state with the
   * fresh DTO. Available to every role — the backend enforces who can sync
   * what. Used when the user just edited an expense / manual delivery /
   * salary payment elsewhere and the difference column looks stale.
   */
  const handleSyncReport = useCallback(async (report: DailyEntry) => {
    setSyncingId(report.id);
    setError("");
    try {
      const fresh = await syncEntry(report.id);
      setReports((prev) => prev.map((r) => (r.id === report.id ? { ...r, ...fresh } : r)));
      setMessage(
        `Recomputed totals for ${report.cashier?.name ?? "cashier"} (${report.date}).`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sync report");
    } finally {
      setSyncingId(null);
    }
  }, []);

  /**
   * Bulk "Sync all" — re-fetches the list and runs {@code syncEntry} for
   * every visible report in parallel. Bounded by the number of reports in
   * the current filter so it stays snappy.
   */
  const handleSyncAll = useCallback(async () => {
    if (syncingAll || loading) return;
    setSyncingAll(true);
    setError("");
    setMessage("");
    try {
      await loadList();
      // Snapshot the current list *after* the reload so we sync exactly the
      // rows the user can see right now.
      const targets = (await api<DailyEntry[]>(
        `/entries?${(() => {
          const params = new URLSearchParams({ from, to });
          if (filterCashierId) params.set("cashierId", filterCashierId);
          if (filterStatus) params.set("status", filterStatus);
          for (const id of filterTagIds) params.append("tagId", id);
          return params.toString();
        })()}`,
      )) ?? [];
      const synced = await Promise.allSettled(
        targets.map((r) => syncEntry(r.id)),
      );
      const ok = synced.filter((s) => s.status === "fulfilled").length;
      setReports(
        targets.map((r, i) => {
          const result = synced[i];
          return result.status === "fulfilled"
            ? { ...r, ...(result.value as Partial<DailyEntry>) }
            : r;
        }),
      );
      setMessage(`Recomputed ${ok}/${targets.length} reports.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sync");
    } finally {
      setSyncingAll(false);
    }
  }, [filterCashierId, filterStatus, filterTagIds, from, loadList, loading, syncingAll, to]);

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
        action={
          <button
            type="button"
            onClick={() => void handleSyncAll()}
            disabled={syncingAll || loading}
            className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md bg-white border border-black/10 hover:bg-[var(--color-cream)]/60 disabled:opacity-60 disabled:cursor-not-allowed"
            title="Re-fetch the list and recompute totals for every visible report"
          >
            <span aria-hidden className={syncingAll ? "inline-block animate-spin" : "inline-block"}>↻</span>
            {syncingAll ? "Syncing…" : "Sync all"}
          </button>
        }
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
              <ReportListCard
                key={r.id}
                report={r}
                onDelete={canRemove ? handleDeleteReport : undefined}
                onSync={handleSyncReport}
                syncing={syncingId === r.id}
                onTagsChange={handleReportTagsChange}
                onOpenComments={setCommentsFor}
                commentCountOverride={commentCounts[r.id]}
              />
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
          <div className="field-label">
            <span className="invisible">Tag filter</span>
            <TagFilterDropdown
              selectedTagIds={filterTagIds}
              onChange={setFilterTagIds}
              label="Tags"
            />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between flex-wrap gap-3">
          <SavedViewsBar<ShiftReportFilters>
            page="reports"
            currentFilters={{
              from,
              to,
              filterCashierId,
              filterStatus,
              filterTagIds,
            }}
            onApply={(f) => {
              if (typeof f.from === "string") setFrom(f.from);
              if (typeof f.to === "string") setTo(f.to);
              if (typeof f.filterCashierId === "string") setFilterCashierId(f.filterCashierId);
              if (typeof f.filterStatus === "string") setFilterStatus(f.filterStatus);
              if (Array.isArray(f.filterTagIds)) setFilterTagIds(f.filterTagIds);
            }}
          />
          <ExportButton
            config={{
              type: "entries",
              from,
              to,
              cashierId: filterCashierId || undefined,
            }}
          />
        </div>
      </Card>

      {error && (
        <Alert variant="error">{error}</Alert>
      )}
      {message && <Alert variant="success">{message}</Alert>}

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
                    <ReportListCard
                      key={r.id}
                      report={r}
                      onDelete={canRemove ? handleDeleteReport : undefined}
                      onSync={handleSyncReport}
                      syncing={syncingId === r.id}
                      onTagsChange={handleReportTagsChange}
                      onOpenComments={setCommentsFor}
                      commentCountOverride={commentCounts[r.id]}
                    />
                  ))}
                </div>
              </div>
            ))}
        </section>
      )}
      <CommentsDrawer
        open={commentsFor != null}
        entityType={commentsFor ? "ENTRY" : null}
        entityId={commentsFor?.id ?? null}
        title={
          commentsFor
            ? `${commentsFor.cashier?.name ?? "Cashier"} · ${commentsFor.date}`
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
