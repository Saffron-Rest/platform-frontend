import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { api } from "../api/client";
import { fmt } from "../lib/calc";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";
import { Spinner } from "../components/ui/Spinner";

const TEMPLATE_KEY = "pnl-template";

const TEMPLATES = [
  { value: "GENERIC", label: "Standard" },
  { value: "US", label: "United States" },
  { value: "EU", label: "European Union" },
  { value: "PL", label: "Poland (RZiS)" },
] as const;

type PlLine = {
  key: string;
  label: string;
  amount?: number;
  indent?: number;
  bold?: boolean;
  subtotal?: boolean;
  section?: boolean;
};

type ProfitLossResponse = {
  from: string;
  to: string;
  template: string;
  templateLabel: string;
  status: string;
  reportCount: number;
  generatedAt: string;
  currency: string;
  includeLabor: boolean;
  laborUsesPaidAmounts?: boolean;
  laborAccrued?: number;
  laborPaid?: number;
  footerNote: string;
  margins: {
    grossProfit: number;
    operatingProfit: number;
    netProfit: number;
    grossMarginPct: number;
    operatingMarginPct: number;
    netMarginPct: number;
  };
  totals: {
    grossRevenue: number;
    returns: number;
    netRevenue: number;
    cogs: number;
    grossProfit: number;
    operatingExpenses: number;
    labor: number;
    operatingProfit: number;
    distributions: number;
    netProfit: number;
  };
  lines: PlLine[];
};

function monthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fmtPct(n: number) {
  return `${n.toFixed(1)}%`;
}

function fmtAmount(n: number) {
  if (n < 0) return `(${fmt(-n)})`;
  return fmt(n);
}

export function ProfitLoss({ asTab }: { asTab?: boolean } = {}) {
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [template, setTemplate] = useState(() => localStorage.getItem(TEMPLATE_KEY) || "EU");
  const [includeLabor, setIncludeLabor] = useState(true);
  const [lockedOnly, setLockedOnly] = useState(true);
  const [data, setData] = useState<ProfitLossResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams({
        from,
        to,
        template,
        includeLabor: String(includeLabor),
        status: lockedOnly ? "LOCKED" : "ALL",
      });
      const res = await api<ProfitLossResponse>(`/analytics/profit-loss?${q}`);
      setData(res);
      localStorage.setItem(TEMPLATE_KEY, template);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : "Failed to load P&L");
    } finally {
      setLoading(false);
    }
  }, [from, to, template, includeLabor, lockedOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  const presets = useMemo(
    () => [
      {
        label: "This month",
        apply: () => {
          setFrom(monthStart());
          setTo(today());
        },
      },
      {
        label: "Last 30 days",
        apply: () => {
          const end = new Date();
          const start = new Date();
          start.setDate(start.getDate() - 29);
          setFrom(start.toISOString().slice(0, 10));
          setTo(end.toISOString().slice(0, 10));
        },
      },
      {
        label: "Last month",
        apply: () => {
          const now = new Date();
          const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const end = new Date(now.getFullYear(), now.getMonth(), 0);
          setFrom(start.toISOString().slice(0, 10));
          setTo(end.toISOString().slice(0, 10));
        },
      },
    ],
    []
  );

  return (
    <div className="max-w-4xl mx-auto w-full">
      {!asTab && (
        <PageHeader
          title="Profit & Loss"
          subtitle="Automated statement from shift reports — revenue, expenses, and margins update as entries are submitted"
          badge={data?.templateLabel}
        />
      )}

      <Card className="mb-6 space-y-4" data-tour="tour-pl-dates">
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={p.apply}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-black/5 hover:bg-black/10 transition"
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="field-label">
            From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="field-input" />
          </label>
          <label className="field-label">
            To
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="field-input" />
          </label>
        </div>

        <label className="field-label">
          Statement format
          <select
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            className="field-input"
          >
            {TEMPLATES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-2 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeLabor}
              onChange={(e) => setIncludeLabor(e.target.checked)}
              className="rounded border-black/20"
            />
            Include salary cost (paid payouts in date range, or earned if none paid yet)
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={lockedOnly}
              onChange={(e) => setLockedOnly(e.target.checked)}
              className="rounded border-black/20"
            />
            Submitted reports only
          </label>
        </div>

        <Button variant="dark" fullWidth onClick={() => void load()} disabled={loading}>
          {loading ? "Updating…" : "Refresh statement"}
        </Button>
        {error && <Alert variant="error">{error}</Alert>}
      </Card>

      {loading && !data && (
        <Card className="py-12 flex justify-center">
          <Spinner label="Building P&L…" />
        </Card>
      )}

      {data && (
        <>
          <p className="text-sm text-[var(--color-muted)] mb-4">
            {data.from} → {data.to} · <strong>{data.reportCount}</strong>{" "}
            {data.reportCount === 1 ? "report" : "reports"} · Updated{" "}
            {new Date(data.generatedAt).toLocaleString()}
            {data.includeLabor && data.laborUsesPaidAmounts && data.laborPaid != null && (
              <span className="block mt-1">
                Labor line uses salary <strong>paid</strong> in this range ({fmt(data.laborPaid)}).
                {data.laborAccrued != null && data.laborAccrued > data.laborPaid + 0.01 && (
                  <span>
                    {" "}Accrued from <strong>scheduled shifts</strong>:{" "}
                    {fmt(data.laborAccrued)}.
                  </span>
                )}
              </span>
            )}
          </p>

          <div className="grid sm:grid-cols-3 gap-3 mb-6">
            {(
              [
                ["Gross margin", data.margins.grossMarginPct, data.margins.grossProfit],
                ["Operating margin", data.margins.operatingMarginPct, data.margins.operatingProfit],
                ["Net margin", data.margins.netMarginPct, data.margins.netProfit],
              ] as const
            ).map(([label, pct, profit]) => (
              <Card key={label} className="!p-4">
                <p className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide">{label}</p>
                <p className="text-2xl font-bold tabular-nums mt-1 text-[var(--color-saffron)]">{fmtPct(pct)}</p>
                <p className="text-sm tabular-nums mt-1 text-[var(--color-ink)]">{fmt(profit)}</p>
              </Card>
            ))}
          </div>

          <Card className="mb-6 overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {data.lines.map((row, i) => {
                  if (row.section) {
                    return (
                      <tr key={`s-${i}`} className="border-t border-black/10 first:border-t-0">
                        <td colSpan={2} className="pt-4 pb-1 font-semibold text-[var(--color-ink)]">
                          {row.label}
                        </td>
                      </tr>
                    );
                  }
                  const indent = (row.indent ?? 0) * 12;
                  const isSubtotal = row.subtotal;
                  return (
                    <tr
                      key={`${row.key}-${i}`}
                      className={isSubtotal ? "border-t border-black/15" : ""}
                    >
                      <td
                        className={`py-1.5 pr-4 ${isSubtotal ? "font-semibold pt-3" : "text-[var(--color-muted)]"}`}
                        style={{ paddingLeft: indent }}
                      >
                        {row.label}
                      </td>
                      <td
                        className={`py-1.5 text-right tabular-nums whitespace-nowrap ${
                          isSubtotal ? "font-bold pt-3" : ""
                        } ${(row.amount ?? 0) < 0 ? "text-red-700" : ""}`}
                      >
                        {row.amount != null ? fmtAmount(row.amount) : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          {data.totals && data.totals.netRevenue > 0 && (
            <ProfitAdvisor totals={data.totals} margins={data.margins} />
          )}

          <p className="text-xs text-[var(--color-muted)] leading-relaxed">{data.footerNote}</p>
        </>
      )}
    </div>
  );
}

// ─── Profit Advisor ──────────────────────────────────────────────────────────

type Totals = ProfitLossResponse["totals"];
type Margins = ProfitLossResponse["margins"];

const TARGET_OPTIONS = [5, 8, 10, 12, 15];


function ProfitAdvisor({ totals, margins }: { totals: Totals; margins: Margins }) {
  const [targetPct, setTargetPct] = useState(10);
  const [customTarget, setCustomTarget] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const r = totals.netRevenue;
  const foodCostPct  = r > 0 ? (totals.cogs / r) * 100 : 0;
  const laborPct     = r > 0 ? (totals.labor / r) * 100 : 0;
  const netMarginPct = margins.netMarginPct;

  // PLN gain per 1% improvement on each lever
  // Revenue: extra revenue × gross margin (since COGS scales, OE/labor stay fixed)
  const revenueGain  = (r * 0.01) * (margins.grossMarginPct / 100);
  const cogsGain     = totals.cogs             * 0.01;
  const laborGain    = totals.labor            * 0.01;
  const opexGain     = totals.operatingExpenses * 0.01;

  const levers = [
    { key: "revenue",  label: "Revenue +1%",       gain: revenueGain,  note: "More customers / higher prices" },
    { key: "cogs",     label: "Food cost −1%",      gain: cogsGain,     note: "Reduce waste, renegotiate suppliers" },
    { key: "labor",    label: "Labor −1%",          gain: laborGain,    note: "Scheduling optimisation" },
    { key: "opex",     label: "Operating costs −1%", gain: opexGain,     note: "Utilities, packaging, marketing" },
  ].sort((a, b) => b.gain - a.gain);

  const effectiveTarget = customTarget !== "" ? Number(customTarget) : targetPct;
  const targetNetProfit = r * (effectiveTarget / 100);
  const gap             = targetNetProfit - totals.netProfit;
  const alreadyThere    = gap <= 0;

  // How much of each lever needed to close the gap
  const revenueNeededPct = revenueGain > 0 ? gap / revenueGain : 0;
  const cogsNeededPct    = cogsGain    > 0 ? gap / cogsGain    : 0;
  const laborNeededPct   = laborGain   > 0 ? gap / laborGain   : 0;

  return (
    <Card className="mb-6 space-y-6 !p-5">
      <div>
        <p className="font-bold text-base">Profit improvement</p>
        <p className="text-xs text-[var(--color-muted)] mt-0.5">
          Based on this period's figures vs restaurant industry benchmarks
        </p>
      </div>

      {/* ── Benchmarks ── */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase text-[var(--color-muted)]">Benchmarks</p>
        <BenchmarkRow
          label="Food cost"
          valuePct={foodCostPct}
          amount={totals.cogs}
          good={foodCostPct <= 35}
          hint="Target < 35% of revenue"
          direction="lower"
        />
        <BenchmarkRow
          label="Labor cost"
          valuePct={laborPct}
          amount={totals.labor}
          good={laborPct <= 35}
          hint="Target < 35% of revenue"
          direction="lower"
        />
        <BenchmarkRow
          label="Net margin"
          valuePct={netMarginPct}
          amount={totals.netProfit}
          good={netMarginPct >= 5}
          hint="Target > 5% of revenue"
          direction="higher"
        />
      </div>

      {/* ── Lever calculator ── */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase text-[var(--color-muted)]">
          What moves net profit the most — per 1% improvement
        </p>
        <div className="space-y-2">
          {levers.map((lever, i) => (
            <div key={lever.key} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className={`text-sm font-semibold${i === 0 ? " text-[var(--color-saffron)]" : ""}`}>
                    {lever.label}
                  </span>
                  {i === 0 && (
                    <span className="text-xs bg-[var(--color-saffron)]/10 text-[var(--color-saffron)] font-medium px-1.5 py-0.5 rounded-full">
                      biggest lever
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--color-muted)]">{lever.note}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold tabular-nums text-green-700">+{fmt(Math.round(lever.gain))}</p>
                <p className="text-xs text-[var(--color-muted)]">PLN / 1%</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Gap to target ── */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase text-[var(--color-muted)]">Gap to target net margin</p>

        <div className="flex flex-wrap gap-1.5 items-center">
          {TARGET_OPTIONS.map((t) => (
            <button
              key={t}
              onClick={() => { setTargetPct(t); setCustomTarget(""); }}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                customTarget === "" && targetPct === t
                  ? "bg-[var(--color-saffron)] text-white"
                  : "bg-black/5 hover:bg-black/10"
              }`}
            >
              {t}%
            </button>
          ))}
          <input
            ref={inputRef}
            type="number"
            min={1}
            max={50}
            placeholder="Custom %"
            value={customTarget}
            onChange={(e) => setCustomTarget(e.target.value)}
            className="w-20 px-2 py-1 text-xs rounded-lg border border-black/10 bg-white"
          />
        </div>

        {alreadyThere ? (
          <div className="rounded-xl bg-green-50 border border-green-200 p-4">
            <p className="font-semibold text-green-800">
              You're already at {fmtPct(netMarginPct)} — above your {effectiveTarget}% target.
            </p>
            <p className="text-sm text-green-700 mt-0.5">
              Try setting a higher target to find your next growth opportunity.
            </p>
          </div>
        ) : (
          <div className="rounded-xl bg-black/[0.03] border border-black/10 p-4 space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm text-[var(--color-muted)]">Current net profit</span>
              <span className="font-bold tabular-nums">{fmt(totals.netProfit)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm text-[var(--color-muted)]">Target at {effectiveTarget}%</span>
              <span className="font-bold tabular-nums">{fmt(Math.round(targetNetProfit))}</span>
            </div>
            <div className="flex items-baseline justify-between gap-2 border-t border-black/10 pt-3">
              <span className="text-sm font-semibold">Gap to close</span>
              <span className="font-bold tabular-nums text-[var(--color-danger)]">
                {fmt(Math.round(gap))}
              </span>
            </div>

            <p className="text-xs font-semibold uppercase text-[var(--color-muted)] pt-1">How to close it</p>
            <GapRow
              label="Increase revenue"
              pct={revenueNeededPct}
              amount={gap / (margins.grossMarginPct / 100)}
              note={`+${fmt(Math.round(gap / (margins.grossMarginPct / 100)))} more revenue`}
            />
            <GapRow
              label="Reduce food cost"
              pct={cogsNeededPct}
              amount={gap}
              note={`save ${fmt(Math.round(gap))} in COGS`}
            />
            <GapRow
              label="Reduce labor"
              pct={laborNeededPct}
              amount={gap}
              note={`save ${fmt(Math.round(gap))} in labor`}
            />
          </div>
        )}
      </div>
    </Card>
  );
}

function BenchmarkRow({
  label,
  valuePct,
  amount,
  good,
  hint,
  direction,
}: {
  label: string;
  valuePct: number;
  amount: number;
  good: boolean;
  hint: string;
  direction: "lower" | "higher";
}) {
  const color = good ? "text-green-700" : direction === "lower" ? "text-red-700" : "text-amber-700";
  const bg    = good ? "bg-green-50"    : direction === "lower" ? "bg-red-50"    : "bg-amber-50";
  const icon  = good ? "✓" : direction === "lower" ? "↑ High" : "↓ Low";

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold">{label}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${color} ${bg}`}>
            {icon}
          </span>
        </div>
        <p className="text-xs text-[var(--color-muted)]">{hint}</p>
      </div>
      <div className="text-right shrink-0">
        <p className={`font-bold tabular-nums ${color}`}>{valuePct.toFixed(1)}%</p>
        <p className="text-xs text-[var(--color-muted)] tabular-nums">{fmt(amount)}</p>
      </div>
    </div>
  );
}

function GapRow({
  label,
  pct,
  amount: _amount,
  note,
}: {
  label: string;
  pct: number;
  amount: number;
  note: string;
}) {
  const feasible = pct > 0 && pct <= 50;
  return (
    <div className="flex items-baseline justify-between gap-2 text-sm">
      <span className="text-[var(--color-muted)]">{label}</span>
      <span className={`text-right tabular-nums font-semibold${feasible ? "" : " text-[var(--color-muted)]"}`}>
        {feasible ? `${pct.toFixed(1)}% (${note})` : "—"}
      </span>
    </div>
  );
}
