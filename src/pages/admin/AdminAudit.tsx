import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../../api/client";
import type { User } from "../../types";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { Spinner } from "../../components/ui/Spinner";
import { EmptyState } from "../../components/ui/EmptyState";
import { AuditFilters, type AuditFilterState } from "../../components/audit/AuditFilters";
import { AuditEventRow } from "../../components/audit/AuditEventRow";
import { AuditDetailPanel, type AuditLogDetail } from "../../components/audit/AuditDetailPanel";
import { dayGroupKey, formatDayGroup } from "../../lib/auditDisplay";

type AuditResponse = {
  items: AuditLogDetail[];
  total: number;
  limit: number;
  offset: number;
};

const emptyFilters = (): AuditFilterState => ({
  q: "",
  action: "",
  entityType: "",
  userId: "",
  entityId: "",
  from: "",
  to: "",
});

export function AdminAudit() {
  const location = useLocation();
  const initialSelected = (location.state as { selectedId?: string } | null)?.selectedId;
  const [data, setData] = useState<AuditResponse | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [filters, setFilters] = useState<AuditFilterState>(emptyFilters);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelected ?? null);
  const [selected, setSelected] = useState<AuditLogDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      if (filters.action) params.set("action", filters.action);
      if (filters.entityType) params.set("entityType", filters.entityType);
      if (filters.userId) params.set("userId", filters.userId);
      if (filters.entityId) params.set("entityId", filters.entityId);
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      if (filters.q.trim()) params.set("q", filters.q.trim());
      const res = await api<AuditResponse>(`/audit?${params}`);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit log");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [filters, offset]);

  useEffect(() => {
    api<User[]>("/users").then(setUsers).catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!selectedId) {
      setSelected(null);
      return;
    }
    setDetailLoading(true);
    api<AuditLogDetail>(`/audit/${selectedId}`)
      .then(setSelected)
      .catch(() => setSelected(null))
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  const grouped = useMemo(() => {
    const items = data?.items ?? [];
    const map = new Map<string, AuditLogDetail[]>();
    for (const log of items) {
      const key = dayGroupKey(log.createdAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(log);
    }
    return [...map.entries()];
  }, [data?.items]);

  const total = data?.total ?? 0;
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.max(1, Math.ceil(total / limit));

  const selectLog = (id: string) => setSelectedId((prev) => (prev === id ? null : id));

  return (
    <div className="pb-8">
      <PageHeader
        title="Audit trail"
        subtitle="Who did what, when — for compliance and troubleshooting"
      />

      <div data-tour="tour-audit-filters">
      <AuditFilters
        filters={filters}
        users={users}
        onChange={setFilters}
        onApply={() => {
          setOffset(0);
          setSelectedId(null);
          load();
        }}
        onClear={() => {
          setFilters(emptyFilters());
          setOffset(0);
          setSelectedId(null);
        }}
      />
      </div>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] lg:gap-0 lg:items-stretch">
        <Card className="!p-0 overflow-hidden lg:rounded-r-none lg:border-r-0 min-h-[24rem]">
          <div className="px-4 py-3 border-b border-black/5 flex flex-wrap justify-between items-center gap-2 bg-gradient-to-r from-[var(--color-cream)]/80 to-white">
            <span className="text-sm font-medium">
              {loading && data ? "Refreshing…" : `${total} event${total === 1 ? "" : "s"}`}
            </span>
            {total > 0 && (
              <span className="text-xs text-[var(--color-muted)]">
                Page {page} of {pages}
              </span>
            )}
          </div>

          {loading && !data ? (
            <div className="py-16">
              <Spinner label="Loading activity…" />
            </div>
          ) : grouped.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="No activity found"
                description="Try a wider date range or remove filters."
                action={
                  <Button variant="secondary" onClick={() => setFilters(emptyFilters())}>
                    Clear filters
                  </Button>
                }
              />
            </div>
          ) : (
            <div className={`max-h-[calc(100vh-14rem)] overflow-y-auto ${loading ? "opacity-60 pointer-events-none" : ""}`}>
              {grouped.map(([day, logs]) => (
                <section key={day}>
                  <div className="sticky top-0 z-10 px-4 py-2 bg-white/95 backdrop-blur border-b border-black/5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                      {formatDayGroup(day)}
                    </p>
                  </div>
                  <ul>
                    {logs.map((log) => (
                      <li key={log.id}>
                        <AuditEventRow
                          log={log}
                          selected={selectedId === log.id}
                          onClick={() => selectLog(log.id)}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}

          {pages > 1 && (
            <div className="flex justify-between items-center px-4 py-3 border-t border-black/5 bg-[var(--color-cream)]/30">
              <Button
                variant="secondary"
                disabled={offset === 0 || loading}
                onClick={() => {
                  setOffset(Math.max(0, offset - limit));
                  setSelectedId(null);
                }}
              >
                Previous
              </Button>
              <span className="text-xs text-[var(--color-muted)]">
                {offset + 1}–{Math.min(offset + limit, total)} of {total}
              </span>
              <Button
                variant="secondary"
                disabled={offset + limit >= total || loading}
                onClick={() => {
                  setOffset(offset + limit);
                  setSelectedId(null);
                }}
              >
                Next
              </Button>
            </div>
          )}
        </Card>

        <div className="hidden lg:block lg:rounded-r-2xl lg:border lg:border-black/[0.06] lg:overflow-hidden lg:shadow-sm min-h-[24rem]">
          <AuditDetailPanel
            log={selected}
            loading={detailLoading}
            onClose={() => setSelectedId(null)}
            variant="panel"
          />
        </div>
      </div>

      {(selectedId || detailLoading) && (
        <AuditDetailPanel
          log={selected}
          loading={detailLoading}
          onClose={() => setSelectedId(null)}
          variant="drawer"
        />
      )}
    </div>
  );
}
