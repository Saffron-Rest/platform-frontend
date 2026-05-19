import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { PayrollReport } from "../types";
import { fmt } from "../lib/calc";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";

function monthBounds(year: number, month: number) {
  const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const last = new Date(year, month + 1, 0).getDate();
  const to = `${year}-${String(month + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return { from, to };
}

function monthLabel(year: number, month: number) {
  return new Date(year, month, 1).toLocaleString("pl-PL", { month: "long", year: "numeric" });
}

export function SalariesPanel() {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [report, setReport] = useState<PayrollReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const { from, to } = useMemo(() => monthBounds(viewYear, viewMonth), [viewYear, viewMonth]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api<PayrollReport>(`/salaries?from=${from}&to=${to}`);
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load salaries");
    } finally {
      setLoading(false);
    }
  }, [from, to, refreshKey]);

  useEffect(() => {
    load();
  }, [load]);

  const goMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-2 text-sm text-[var(--color-muted)]">
        <h3 className="font-semibold text-[var(--color-ink)]">How pay is calculated</h3>
        <p>
          Till-close shifts use that weekday&apos;s closing time from{" "}
          <Link to="/admin/hours" className="text-[var(--color-saffron)] font-medium">
            Restaurant hours
          </Link>
          .
        </p>
        <ul className="space-y-1.5 list-disc pl-4">
          <li>
            <strong>Hourly</strong> — hours worked × rate (varies by day).
          </li>
          <li>
            <strong>Daily</strong> — day rate × (shift hours ÷ open hours that day).
          </li>
          <li>
            <strong>Monthly</strong> — monthly salary × (days worked ÷ days in period).
          </li>
        </ul>
        <p className="text-xs pt-1">
          Pay rates are set per cashier in{" "}
          <Link to="/admin/team" className="text-[var(--color-saffron)] font-medium">
            Team
          </Link>
          .
        </p>
      </Card>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => goMonth(-1)} className="!px-3">
            ←
          </Button>
          <h3 className="font-semibold text-lg capitalize min-w-[10rem] text-center">
            {monthLabel(viewYear, viewMonth)}
          </h3>
          <Button variant="secondary" onClick={() => goMonth(1)} className="!px-3">
            →
          </Button>
        </div>
        <Button variant="secondary" onClick={() => setRefreshKey((k) => k + 1)} className="!text-sm">
          Refresh
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {loading ? (
        <p className="text-center text-[var(--color-muted)] py-8">Calculating salaries…</p>
      ) : report ? (
        <>
          <div className="bg-[var(--color-ink)] text-white rounded-2xl p-4 flex justify-between items-center">
            <div>
              <p className="text-white/70 text-sm">Total payroll</p>
              <p className="text-2xl font-bold tabular-nums">{fmt(report.grandTotalPay)}</p>
            </div>
            <div className="text-right">
              <p className="text-white/70 text-sm">Hours logged</p>
              <p className="text-xl font-semibold tabular-nums">{report.grandTotalHours.toFixed(1)} h</p>
            </div>
          </div>

          <ul className="space-y-3">
            {report.employees.map((e) => (
              <li key={e.userId} className="bg-white rounded-2xl border border-black/5 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpanded(expanded === e.userId ? null : e.userId)}
                  className="w-full p-4 text-left flex flex-wrap items-center justify-between gap-3 hover:bg-[var(--color-cream)]/50"
                >
                  <div className="min-w-0">
                    <p className="font-semibold">{e.name}</p>
                    <p className="text-sm text-[var(--color-muted)]">
                      {e.payTypeLabel} · {e.payAmount} {e.payAmountLabel}
                    </p>
                    <p className="text-xs text-[var(--color-muted)] mt-0.5">
                      {e.shiftCount} day{e.shiftCount === 1 ? "" : "s"} · {e.totalHours.toFixed(1)} h
                    </p>
                  </div>
                  <p className="text-lg font-bold tabular-nums text-[var(--color-saffron-dark)]">
                    {fmt(e.totalPay)}
                  </p>
                </button>

                {expanded === e.userId && (
                  <div className="px-4 pb-4 border-t border-black/5 bg-[var(--color-cream)]/30">
                    <p className="text-xs text-[var(--color-muted)] py-2">{e.calculationSummary}</p>
                    {e.shifts.length > 0 ? (
                      <ul className="space-y-1">
                        {e.shifts.map((s) => (
                          <li
                            key={s.date}
                            className="flex justify-between text-sm py-1.5 px-2 rounded-lg bg-white/80"
                          >
                            <span>
                              {s.date} · {s.hoursLabel}
                            </span>
                            <span className="tabular-nums text-right text-[var(--color-muted)]">
                              {s.hours.toFixed(1)} h · {fmt(s.pay)}
                              {s.payNote && (
                                <span className="block text-[10px]">{s.payNote}</span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-[var(--color-muted)]">No attendance this period.</p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
