import { useCallback, useEffect, useMemo, useState } from "react";
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
  footerNote: string;
  margins: {
    grossProfit: number;
    operatingProfit: number;
    netProfit: number;
    grossMarginPct: number;
    operatingMarginPct: number;
    netMarginPct: number;
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

export function ProfitLoss() {
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
      <PageHeader
        title="Profit & Loss"
        subtitle="Automated statement from shift reports — revenue, expenses, and margins update as entries are submitted"
        badge={data?.templateLabel}
      />

      <Card className="mb-6 space-y-4">
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
            Include payroll labor (from attendance)
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

          <p className="text-xs text-[var(--color-muted)] leading-relaxed">{data.footerNote}</p>
        </>
      )}
    </div>
  );
}
