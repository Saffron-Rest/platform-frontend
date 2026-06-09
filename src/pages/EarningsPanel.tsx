import { useEffect, useMemo, useState } from "react";
import {
  createPayoutRequest,
  getMyEarnings,
  type MyEarnings,
  type PayoutRequest,
} from "../api/earnings";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";
import { Spinner } from "../components/ui/Spinner";

// ─── helpers ─────────────────────────────────────────────────────────────────

const fmtDate = (iso: string) =>
  new Date(iso + (iso.includes("T") ? "" : "T00:00:00")).toLocaleDateString(undefined, {
    day: "2-digit", month: "short", year: "numeric",
  });

const monthLabel = (y: number, m: number) =>
  new Date(y, m, 1).toLocaleString(undefined, { month: "long", year: "numeric" });

const isoMonth = (y: number, m: number) => {
  const from = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const to = `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
};

const statusConfig = (s: PayoutRequest["status"]) => ({
  PENDING:  { label: "Waiting for manager approval", color: "bg-amber-100 text-amber-800 border-amber-200" },
  APPROVED: { label: "Approved — will be paid soon",  color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  DECLINED: { label: "Not approved",                  color: "bg-red-50 text-red-700 border-red-200" },
}[s]);

// ─── page ─────────────────────────────────────────────────────────────────────

export function EarningsPanel() {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const { from, to } = useMemo(() => isoMonth(year, month), [year, month]);

  const [data, setData]       = useState<MyEarnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  // Payout request form
  const [askOpen,      setAskOpen]      = useState(false);
  const [askAmount,    setAskAmount]    = useState("");
  const [askNote,      setAskNote]      = useState("");
  const [asking,       setAsking]       = useState(false);
  const [askErr,       setAskErr]       = useState("");

  const load = () => {
    setLoading(true);
    setError("");
    setData(null);
    getMyEarnings(from, to)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load your pay data"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [from, to]); // eslint-disable-line react-hooks/exhaustive-deps

  const pending = useMemo(
    () => data?.requests.find((r) => r.status === "PENDING") ?? null,
    [data],
  );

  const prevMonth = () => {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
    if (isCurrentMonth) return;
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  };

  const sendRequest = async () => {
    const amt = parseFloat(askAmount);
    if (!amt || amt <= 0) { setAskErr("Enter an amount greater than 0"); return; }
    setAsking(true);
    setAskErr("");
    try {
      await createPayoutRequest(amt, askNote.trim() || undefined);
      setAskOpen(false);
      setAskAmount("");
      setAskNote("");
      load();
    } catch (e) {
      setAskErr(e instanceof Error ? e.message : "Could not send your request");
    } finally {
      setAsking(false);
    }
  };

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  return (
    <div className="space-y-5 max-w-lg mx-auto pb-10">

      {/* ── Month navigation ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={prevMonth}
          className="p-2 rounded-lg hover:bg-black/5 text-[var(--color-muted)] transition-colors"
          aria-label="Previous month"
        >
          ←
        </button>
        <h1 className="text-lg font-semibold text-[var(--color-ink)]">
          {monthLabel(year, month)}
        </h1>
        <button
          type="button"
          onClick={nextMonth}
          disabled={isCurrentMonth}
          className="p-2 rounded-lg hover:bg-black/5 text-[var(--color-muted)] transition-colors disabled:opacity-30"
          aria-label="Next month"
        >
          →
        </button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {loading ? (
        <div className="py-20 flex justify-center"><Spinner /></div>
      ) : !data ? null : (
        <>
          {/* ── Hero: what you're owed right now ─────────────────────── */}
          <div className="rounded-2xl bg-[var(--color-saffron)] text-white px-6 py-6 text-center shadow-sm">
            <p className="text-sm font-medium opacity-80 mb-1">You are owed right now</p>
            <p className="text-5xl font-bold tabular-nums">
              {data.owedNow.toFixed(2)}
              <span className="text-2xl font-normal ml-1 opacity-80">zł</span>
            </p>
            {data.owedNow <= 0 && data.paidAmount > 0 && (
              <p className="text-sm opacity-80 mt-2">All caught up for this period ✓</p>
            )}
            {data.owedNow <= 0 && data.paidAmount <= 0 && data.totalPay <= 0 && (
              <p className="text-sm opacity-80 mt-2">No shifts recorded this month yet</p>
            )}
          </div>

          {/* ── Three numbers ─────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-3">
            <StatBox
              label="Earned this month"
              value={data.totalPay}
              hint={`${data.totalHours.toFixed(1)}h worked`}
            />
            <StatBox
              label="Already paid"
              value={data.paidAmount}
              hint={data.paidAmount > 0 ? "received" : "none yet"}
              positive
            />
            <StatBox
              label="Still to come"
              value={Math.max(0, data.totalPay - data.paidAmount)}
              hint="by end of month"
            />
          </div>


          {/* ── Pay period progress bar ───────────────────────────────── */}
          {data.totalPay > 0 && (
            <div>
              <div className="flex justify-between text-xs text-[var(--color-muted)] mb-1.5">
                <span>Month progress</span>
                <span>
                  {Math.round((data.paidAmount / data.totalPay) * 100)}% paid
                </span>
              </div>
              <div className="h-2 rounded-full bg-black/8 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, (data.paidAmount / data.totalPay) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* ── Pending payout request ───────────────────────────────── */}
          {pending && (
            <div className={`rounded-xl border px-4 py-3 ${statusConfig(pending.status).color}`}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">
                    Payout request: {pending.requestedAmount.toFixed(2)} zł
                  </p>
                  <p className="text-xs mt-0.5">{statusConfig(pending.status).label}</p>
                  {pending.notes && (
                    <p className="text-xs mt-1 opacity-70">Your note: {pending.notes}</p>
                  )}
                </div>
                <span className="text-2xl">⏳</span>
              </div>
            </div>
          )}

          {/* ── Ask for payout CTA ───────────────────────────────────── */}
          {!pending && !askOpen && (
            <div className="rounded-2xl border-2 border-dashed border-[var(--color-saffron)]/40 px-5 py-5 text-center space-y-3">
              <p className="text-sm text-[var(--color-muted)]">
                {data.owedNow > 0
                  ? `You have ${data.owedNow.toFixed(2)} zł waiting. Ask your manager to pay it out.`
                  : "When you are owed money, you can ask your manager to pay it out here."}
              </p>
              <Button
                onClick={() => {
                  setAskOpen(true);
                  setAskAmount(data.owedNow > 0 ? data.owedNow.toFixed(2) : "");
                }}
                disabled={data.owedNow <= 0}
              >
                Ask for payout
              </Button>
            </div>
          )}

          {askOpen && (
            <Card>
              <h3 className="font-semibold mb-1">Ask for a payout</h3>
              <p className="text-sm text-[var(--color-muted)] mb-4">
                Your manager will see this and either approve or decline it. You can
                request any amount up to what you are owed.
              </p>
              {askErr && <Alert variant="error" className="mb-3">{askErr}</Alert>}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-ink)] mb-1">
                    How much do you need? (zł)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={data.owedNow}
                    value={askAmount}
                    onChange={(e) => setAskAmount(e.target.value)}
                    className="field-input w-full"
                    autoFocus
                    placeholder={data.owedNow > 0 ? `Max ${data.owedNow.toFixed(2)} zł` : ""}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-ink)] mb-1">
                    Reason <span className="text-[var(--color-muted)] font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={askNote}
                    onChange={(e) => setAskNote(e.target.value)}
                    className="field-input w-full"
                    placeholder="e.g. rent is due Friday"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button onClick={() => void sendRequest()} disabled={asking}>
                    {asking ? "Sending…" : "Send request"}
                  </Button>
                  <Button variant="ghost" onClick={() => { setAskOpen(false); setAskErr(""); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* ── Past payout requests ─────────────────────────────────── */}
          {data.requests.filter((r) => r !== pending).length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-ink)] mb-2">Past requests</h3>
              <div className="space-y-2">
                {data.requests.filter((r) => r !== pending).map((r) => {
                  const cfg = statusConfig(r.status);
                  return (
                    <div key={r.id} className={`rounded-xl border px-4 py-3 ${cfg.color}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">{r.requestedAmount.toFixed(2)} zł</p>
                          <p className="text-xs mt-0.5">{cfg.label}</p>
                          {r.adminNotes && (
                            <p className="text-xs mt-1 opacity-70">Manager note: {r.adminNotes}</p>
                          )}
                        </div>
                        <p className="text-xs text-right opacity-60 shrink-0">{fmtDate(r.requestedDate)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Payments already received ─────────────────────────────── */}
          {data.payments.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-ink)] mb-2">
                Payments you received this month
              </h3>
              <div className="rounded-xl border border-black/8 divide-y divide-black/5 overflow-hidden">
                {data.payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-[var(--color-ink)]">
                        {p.amount.toFixed(2)} zł
                      </p>
                      <p className="text-xs text-[var(--color-muted)]">
                        {fmtDate(p.paidDate)}{p.notes ? ` · ${p.notes}` : ""}
                      </p>
                    </div>
                    <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                      paid
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

// ─── small sub-component ─────────────────────────────────────────────────────

function StatBox({ label, value, hint, positive = false }: {
  label: string;
  value: number;
  hint: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-xl border border-black/8 bg-[var(--color-cream)]/40 px-3 py-3">
      <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted)] leading-tight">{label}</p>
      <p className={`text-xl font-bold mt-1 tabular-nums ${positive ? "text-emerald-700" : "text-[var(--color-ink)]"}`}>
        {value.toFixed(2)}
        <span className="text-xs font-normal ml-0.5 opacity-60">zł</span>
      </p>
      <p className="text-[10px] text-[var(--color-muted)] mt-0.5">{hint}</p>
    </div>
  );
}
