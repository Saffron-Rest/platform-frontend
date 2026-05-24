import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { PaymentSource, PayrollEmployee, PayrollReport } from "../types";
import { fmt } from "../lib/calc";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";
import { Badge } from "../components/ui/Badge";

function monthBounds(year: number, month: number) {
  const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const last = new Date(year, month + 1, 0).getDate();
  const to = `${year}-${String(month + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return { from, to };
}

function monthLabel(year: number, month: number) {
  return new Date(year, month, 1).toLocaleString("pl-PL", { month: "long", year: "numeric" });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function PaySalaryForm({
  employee,
  periodFrom,
  periodTo,
  onPaid,
}: {
  employee: PayrollEmployee;
  periodFrom: string;
  periodTo: string;
  onPaid: () => void;
}) {
  const remaining = employee.remainingPay ?? Math.max(0, employee.totalPay - (employee.paidAmount ?? 0));
  const [amount, setAmount] = useState(String(remaining > 0 ? remaining : employee.totalPay));
  const [source, setSource] = useState<PaymentSource>("CASH");
  const [paidDate, setPaidDate] = useState(todayIso());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    setAmount(String(remaining > 0 ? remaining : employee.totalPay));
  }, [employee.userId, remaining, employee.totalPay]);

  const submit = async () => {
    setErr("");
    setSaving(true);
    try {
      await api("/treasury/salary-payments", {
        method: "POST",
        body: JSON.stringify({
          userId: employee.userId,
          amount: Number(amount),
          paidDate,
          source,
          periodFrom,
          periodTo,
          notes: notes.trim() || null,
        }),
      });
      onPaid();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setSaving(false);
    }
  };

  if (employee.totalPay <= 0) {
    return (
      <p className="text-sm text-[var(--color-muted)] py-2">No pay due for this period.</p>
    );
  }

  if (remaining <= 0.005 && (employee.paidAmount ?? 0) > 0) {
    return (
      <p className="text-sm text-emerald-700 py-2 font-medium">
        Paid in full for this period ({fmt(employee.paidAmount ?? 0)} recorded).
      </p>
    );
  }

  return (
    <div className="mt-3 p-3 rounded-xl bg-white border border-black/10 space-y-3">
      <p className="text-sm font-semibold">Record salary payment</p>
      {(employee.paidAmount ?? 0) > 0 && (
        <p className="text-xs text-[var(--color-muted)]">
          Already paid {fmt(employee.paidAmount ?? 0)} · remaining {fmt(remaining)}
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="field-label">
          Amount (PLN)
          <input
            type="number"
            min={0.01}
            step={0.01}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="field-input"
          />
        </label>
        <label className="field-label">
          Paid on
          <input
            type="date"
            value={paidDate}
            onChange={(e) => setPaidDate(e.target.value)}
            className="field-input"
          />
        </label>
      </div>
      <div className="flex gap-2">
        {(["CASH", "CARD"] as PaymentSource[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSource(s)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium border ${
              source === s
                ? "bg-[var(--color-saffron)] text-white border-[var(--color-saffron)]"
                : "bg-white border-black/10"
            }`}
          >
            From {s === "CASH" ? "cash" : "card"}
          </button>
        ))}
      </div>
      <label className="field-label">
        Note (optional)
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="field-input"
          placeholder="e.g. May payroll"
        />
      </label>
      {err && <Alert variant="error">{err}</Alert>}
      <Button type="button" fullWidth disabled={saving} onClick={submit}>
        {saving ? "Recording…" : `Pay ${fmt(Number(amount))} from ${source.toLowerCase()}`}
      </Button>
    </div>
  );
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
      const payroll = await api<PayrollReport>(`/salaries?from=${from}&to=${to}`);
      setReport(payroll);
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

  const grandPaid = report?.grandTotalPaid ?? 0;
  const grandRemaining = report?.grandTotalRemaining ?? Math.max(0, (report?.grandTotalPay ?? 0) - grandPaid);

  return (
    <div className="space-y-4">
      {/* "How pay works" — the previous copy ("Earned is calculated from
          attendance") implied we tracked clock-in/clock-out, which we
          don't. The new copy spells out the actual algorithm so the user
          can predict the number before opening the breakdown. */}
      <Card className="space-y-2 text-sm text-[var(--color-muted)]">
        <h3 className="font-semibold text-[var(--color-ink)]">How pay is calculated</h3>
        <p>
          <strong>Earned</strong> is computed from each cashier's <strong>scheduled shifts</strong>{" "}
          (this app does not track clock-in / clock-out) and their pay setting:
        </p>
        <ul className="list-disc pl-5 space-y-0.5">
          <li><strong>Hourly</strong> — (shift end − shift start) × hourly rate, per day.</li>
          <li><strong>Daily</strong> — day rate × (shift hours ÷ open hours), capped at one full day.</li>
          <li><strong>Monthly</strong> — monthly salary × (days worked ÷ days in period).</li>
        </ul>
        <p>
          <strong>Paid</strong> is what you recorded as payouts (reduces treasury cash/card).{" "}
          <Link to="/admin/payouts" className="text-[var(--color-saffron)] font-medium">
            View all payouts →
          </Link>
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
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="bg-[var(--color-ink)] text-white rounded-2xl p-4">
              <p className="text-white/70 text-sm">Earned</p>
              <p className="text-2xl font-bold tabular-nums">{fmt(report.grandTotalPay)}</p>
            </div>
            <div className="bg-emerald-700 text-white rounded-2xl p-4">
              <p className="text-white/80 text-sm">Paid</p>
              <p className="text-2xl font-bold tabular-nums">{fmt(grandPaid)}</p>
            </div>
            <div className="bg-amber-600 text-white rounded-2xl p-4">
              <p className="text-white/80 text-sm">Remaining</p>
              <p className="text-2xl font-bold tabular-nums">{fmt(grandRemaining)}</p>
            </div>
          </div>
          <p className="text-xs text-center text-[var(--color-muted)]">
            {report.grandTotalHours.toFixed(1)} <strong>scheduled</strong> hours this period
            {" · "}
            <Link to="/admin/attendance" className="text-[var(--color-saffron)] font-medium">
              View schedule
            </Link>
          </p>

          <ul className="space-y-3">
            {report.employees.map((e) => {
              const paid = e.paidAmount ?? 0;
              const remaining = e.remainingPay ?? Math.max(0, e.totalPay - paid);
              const isMonthly = e.payType === "MONTHLY";
              const isHourly = e.payType === "HOURLY";

              // What to show under the cashier's name. Hours genuinely
              // matter for HOURLY pay; for MONTHLY they don't drive the
              // total at all (only "days worked" does — see
              // SalaryCalculator.monthlyPayForPeriod). For DAILY they
              // matter partially (fraction of a day). Showing the right
              // metric next to the right pay type is the single biggest
              // clarity win in this page.
              const subline = isMonthly
                ? `${e.shiftCount} day${e.shiftCount === 1 ? "" : "s"} worked of ${report.calendarDays} in period`
                : isHourly
                  ? `${e.shiftCount} day${e.shiftCount === 1 ? "" : "s"} · ${e.totalHours.toFixed(1)} scheduled h`
                  : `${e.shiftCount} day${e.shiftCount === 1 ? "" : "s"} · ${e.totalHours.toFixed(1)} h scheduled`;

              return (
                <li key={e.userId} className="bg-white rounded-2xl border border-black/5 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpanded(expanded === e.userId ? null : e.userId)}
                    className="w-full p-4 text-left flex flex-wrap items-center justify-between gap-3 hover:bg-[var(--color-cream)]/50"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">{e.name}</p>
                        {e.fullyPaid && e.totalPay > 0 && (
                          <Badge variant="locked">Paid</Badge>
                        )}
                        {paid > 0 && remaining > 0.01 && (
                          <Badge variant="neutral">Partial</Badge>
                        )}
                        {!e.active && (
                          <Badge variant="neutral">Inactive</Badge>
                        )}
                        {e.usesPayHistory && (
                          <Badge variant="neutral" title="Pay rate changed during this period — totals below honour each shift's effective rate.">
                            Rate changed
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-[var(--color-muted)]">
                        {/* Show the CURRENT rate prefixed with "Now" when
                            history is in play, so the user understands the
                            headline rate is not what every shift used. */}
                        {e.usesPayHistory ? "Now: " : ""}
                        {e.payTypeLabel} · {e.payAmount} {e.payAmountLabel}
                      </p>
                      <p className="text-xs text-[var(--color-muted)] mt-0.5">
                        {subline}
                        {paid > 0 && (
                          <span>
                            {" "}
                            · paid {fmt(paid)}
                            {remaining > 0.01 && ` · owed ${fmt(remaining)}`}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-[var(--color-muted)] uppercase tracking-wide">Earned</p>
                      <p className="text-lg font-bold tabular-nums text-[var(--color-saffron-dark)]">
                        {fmt(e.totalPay)}
                      </p>
                      {remaining > 0.01 && (
                        <p className="text-sm font-medium text-amber-700 tabular-nums">
                          Owed {fmt(remaining)}
                        </p>
                      )}
                    </div>
                  </button>

                  {expanded === e.userId && (
                    <div className="px-4 pb-4 border-t border-black/5 bg-[var(--color-cream)]/30">
                      <p className="text-xs text-[var(--color-muted)] py-2">{e.calculationSummary}</p>
                      {(e.payments?.length ?? 0) > 0 && (
                        <ul className="mb-3 text-sm space-y-1">
                          {e.payments!.map((p) => (
                            <li
                              key={p.id}
                              className="flex justify-between py-1 px-2 rounded-lg bg-white/80"
                            >
                              <span>
                                {p.paidDate} · {p.source.toLowerCase()}
                                {p.notes && (
                                  <span className="text-[var(--color-muted)]"> · {p.notes}</span>
                                )}
                              </span>
                              <span className="font-medium tabular-nums">{fmt(p.amount)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {e.shifts.length > 0 ? (
                        <ul className="space-y-1">
                          {e.shifts.map((s) => {
                            // For monthly pay, the per-shift "pay" field is
                            // bandTotal / daysInBand (purely so the column
                            // sums to the period total). Showing it next to
                            // the hours figure for that day mis-suggests
                            // "this many hours produced this much pay" —
                            // which is false for monthly. Render the hours
                            // figure only when the user can meaningfully
                            // act on it.
                            const showHours = (s.payType ?? e.payType) !== "MONTHLY";
                            return (
                              <li
                                key={s.date}
                                className="flex justify-between text-sm py-1.5 px-2 rounded-lg bg-white/80 gap-3"
                              >
                                <span className="min-w-0 flex-1">
                                  <span className="font-medium">{s.date}</span>{" "}
                                  · {s.hoursLabel}
                                  {s.tillCloseAssumed && (
                                    <span
                                      className="ml-2 inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-1.5 py-0.5 text-[10px] font-semibold"
                                      title="No end time was set — hours estimated using restaurant close. Set an end time on the schedule for an exact figure."
                                    >
                                      est.
                                    </span>
                                  )}
                                </span>
                                <span className="tabular-nums text-right text-[var(--color-muted)] flex-shrink-0">
                                  {showHours && <>{s.hours.toFixed(1)} h · </>}
                                  {fmt(s.pay)}
                                  {s.payNote && (
                                    <span className="block text-[10px]">{s.payNote}</span>
                                  )}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="text-sm text-[var(--color-muted)]">
                          {e.active
                            ? "Not scheduled this period."
                            : "Inactive employee — no shifts in this period."}{" "}
                          <Link
                            to="/admin/attendance"
                            className="text-[var(--color-saffron)] font-medium"
                          >
                            Edit schedule →
                          </Link>
                        </p>
                      )}
                      <PaySalaryForm
                        employee={e}
                        periodFrom={from}
                        periodTo={to}
                        onPaid={() => setRefreshKey((k) => k + 1)}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </div>
  );
}
