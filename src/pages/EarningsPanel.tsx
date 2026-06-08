import { useEffect, useMemo, useState } from "react";
import {
  createPayoutRequest,
  getMyEarnings,
  type MyEarnings,
  type PayoutRequest,
} from "../api/earnings";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";
import { Spinner } from "../components/ui/Spinner";
import { Money } from "../components/ui/Money";

const fmtDate = (iso: string) =>
  new Date(iso + (iso.includes("T") ? "" : "T00:00:00")).toLocaleDateString(undefined, {
    day: "2-digit", month: "short", year: "numeric",
  });

const thisMonthRange = () => {
  const now = new Date();
  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const toStr = `${to.getFullYear()}-${String(to.getMonth() + 1).padStart(2, "0")}-${String(to.getDate()).padStart(2, "0")}`;
  return { from, to: toStr };
};

const statusBadge = (s: PayoutRequest["status"]) => {
  if (s === "PENDING") return "bg-amber-100 text-amber-800 ring-amber-200";
  if (s === "APPROVED") return "bg-emerald-100 text-emerald-800 ring-emerald-200";
  return "bg-red-100 text-red-700 ring-red-200";
};

export function EarningsPanel() {
  const [range] = useState(thisMonthRange);
  const [data, setData] = useState<MyEarnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showShifts, setShowShifts] = useState(false);

  const [requestOpen, setRequestOpen] = useState(false);
  const [requestAmount, setRequestAmount] = useState("");
  const [requestNotes, setRequestNotes] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [requestErr, setRequestErr] = useState("");

  const load = () => {
    setLoading(true);
    setError("");
    getMyEarnings(range.from, range.to)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const hasPending = useMemo(
    () => data?.requests.some((r) => r.status === "PENDING") ?? false,
    [data],
  );

  const submitRequest = async () => {
    const amt = parseFloat(requestAmount);
    if (!amt || amt <= 0) { setRequestErr("Enter a valid amount"); return; }
    setRequesting(true);
    setRequestErr("");
    try {
      await createPayoutRequest(amt, requestNotes.trim() || undefined);
      setRequestOpen(false);
      setRequestAmount("");
      setRequestNotes("");
      load();
    } catch (e) {
      setRequestErr(e instanceof Error ? e.message : "Request failed");
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <PageHeader
        kicker="Payroll"
        title="My earnings"
        subtitle={`${fmtDate(range.from)} – ${fmtDate(range.to)}`}
      />

      {error && <Alert variant="error">{error}</Alert>}

      {loading ? (
        <div className="py-16"><Spinner /></div>
      ) : !data ? null : (
        <>
          {/* ── Summary tiles ──────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-black/8 bg-[var(--color-cream)]/60 p-4">
              <p className="text-xs uppercase tracking-wider text-[var(--color-muted)]">Earned to date</p>
              <p className="text-2xl font-bold text-[var(--color-ink)] mt-1">
                <Money value={data.earnedToDate} />
              </p>
              <p className="text-xs text-[var(--color-muted)] mt-0.5">
                of <Money value={data.totalPay} /> total this period
              </p>
            </div>
            <div className="rounded-xl border border-black/8 bg-[var(--color-cream)]/60 p-4">
              <p className="text-xs uppercase tracking-wider text-[var(--color-muted)]">Already paid</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">
                <Money value={data.paidAmount} />
              </p>
              <p className="text-xs text-[var(--color-muted)] mt-0.5">
                <Money value={data.owedNow} /> owed now
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex justify-between text-xs text-[var(--color-muted)] mb-1">
              <span>Paid</span>
              <span>{data.totalPay > 0 ? Math.round((data.paidAmount / data.totalPay) * 100) : 0}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-black/8 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${data.totalPay > 0 ? Math.min(100, (data.paidAmount / data.totalPay) * 100) : 0}%` }}
              />
            </div>
            {data.fullyPaid && (
              <p className="text-xs text-emerald-700 font-medium mt-1">Fully paid this period ✓</p>
            )}
          </div>

          {/* ── Request payout ─────────────────────────────────────────── */}
          {!requestOpen ? (
            <div className="flex items-center gap-3">
              <Button
                onClick={() => { setRequestOpen(true); setRequestAmount(data.owedNow.toFixed(2)); }}
                disabled={hasPending || data.owedNow <= 0}
              >
                Request payout
              </Button>
              {hasPending && (
                <span className="text-sm text-amber-700">
                  You have a pending request — wait for admin to review it.
                </span>
              )}
              {!hasPending && data.owedNow <= 0 && (
                <span className="text-sm text-[var(--color-muted)]">Nothing owed right now.</span>
              )}
            </div>
          ) : (
            <Card>
              <h3 className="font-semibold text-sm mb-3">Request a payout</h3>
              {requestErr && <Alert variant="error" className="mb-3">{requestErr}</Alert>}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider">
                    Amount (PLN)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={data.owedNow}
                    value={requestAmount}
                    onChange={(e) => setRequestAmount(e.target.value)}
                    className="field-input mt-1 w-full"
                    placeholder={`Up to ${data.owedNow.toFixed(2)}`}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider">
                    Note (optional)
                  </label>
                  <textarea
                    rows={2}
                    value={requestNotes}
                    onChange={(e) => setRequestNotes(e.target.value)}
                    className="field-input mt-1 w-full"
                    placeholder="e.g. rent due this week"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => void submitRequest()} disabled={requesting}>
                    {requesting ? "Sending…" : "Send request"}
                  </Button>
                  <Button variant="ghost" onClick={() => setRequestOpen(false)}>Cancel</Button>
                </div>
              </div>
            </Card>
          )}

          {/* ── Payout request history ─────────────────────────────────── */}
          {data.requests.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-ink)] mb-2">Payout requests</h3>
              <div className="space-y-2">
                {data.requests.map((r) => (
                  <div key={r.id} className="rounded-xl border border-black/8 px-4 py-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full ring-1 font-medium ${statusBadge(r.status)}`}>
                          {r.status}
                        </span>
                        <span className="text-sm font-semibold text-[var(--color-ink)]">
                          <Money value={r.requestedAmount} />
                        </span>
                        <span className="text-xs text-[var(--color-muted)]">
                          requested {fmtDate(r.requestedDate)}
                        </span>
                      </div>
                      {r.notes && (
                        <p className="text-xs text-[var(--color-muted)] mt-1">{r.notes}</p>
                      )}
                      {r.adminNotes && (
                        <p className="text-xs text-[var(--color-muted)] mt-1 italic">
                          Admin: {r.adminNotes}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Shift breakdown ────────────────────────────────────────── */}
          <div>
            <button
              type="button"
              onClick={() => setShowShifts((v) => !v)}
              className="text-sm text-[var(--color-saffron-dark)] hover:underline"
            >
              {showShifts ? "Hide" : "Show"} shift breakdown ({data.shifts.length} shifts, {data.totalHours.toFixed(1)}h)
            </button>
            {showShifts && data.shifts.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[var(--color-muted)] uppercase tracking-wide">
                      <th className="pb-1.5 pr-3">Date</th>
                      <th className="pb-1.5 pr-3">Hours</th>
                      <th className="pb-1.5 pr-3 text-right">Pay</th>
                      <th className="pb-1.5">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5">
                    {data.shifts.map((s, i) => (
                      <tr key={i}>
                        <td className="py-1.5 pr-3 font-medium">{fmtDate(s.date)}</td>
                        <td className="py-1.5 pr-3 font-mono">
                          {s.hoursLabel}{s.tillCloseAssumed ? "*" : ""}
                        </td>
                        <td className="py-1.5 pr-3 text-right font-mono">
                          <Money value={s.pay} />
                        </td>
                        <td className="py-1.5 text-[var(--color-muted)]">{s.payNote}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.shifts.some((s) => s.tillCloseAssumed) && (
                  <p className="text-[10px] text-[var(--color-muted)] mt-1">
                    * Hours estimated from restaurant close time
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── Payments received ──────────────────────────────────────── */}
          {data.payments.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-ink)] mb-2">Payments received</h3>
              <div className="space-y-1.5">
                {data.payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span className="text-[var(--color-muted)]">{fmtDate(p.paidDate)}</span>
                    <span className="font-medium text-emerald-700"><Money value={p.amount} /></span>
                    <span className="text-xs text-[var(--color-muted)]">
                      {p.source.toLowerCase()}{p.notes ? ` · ${p.notes}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
