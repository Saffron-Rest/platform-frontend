import { useState } from "react";
import { downloadFile, api } from "../api/client";
import { buildReportExportPath, reportExportFilename } from "../lib/reportExport";
import { fmt } from "../lib/calc";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";

type Summary = {
  period: string;
  from: string;
  to: string;
  count: number;
  totals: { sales: number; returns: number; expenses: number; difference: number };
};

export function Reports() {
  const [period, setPeriod] = useState("daily");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState<string | null>(null);

  const loadSummary = async () => {
    setError("");
    try {
      const data = await api<Summary>(`/reports/summary?period=${period}&date=${date}`);
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load summary");
      setSummary(null);
    }
  };

  const exportFile = async (format: "pdf" | "csv" | "excel") => {
    setExporting(format);
    setError("");
    try {
      const path = buildReportExportPath(format, { period, date, status: "LOCKED" });
      const filename = reportExportFilename(format, summary?.from ?? date, summary?.to);
      await downloadFile(path, filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Analytics"
        subtitle="Summaries and exports for locked (submitted) reports only"
      />

      <Card className="mb-6 space-y-4">
        <div className="flex gap-2 flex-wrap">
          {(["daily", "weekly", "monthly"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-full text-sm font-medium capitalize transition ${
                period === p ? "bg-[var(--color-saffron)] text-white shadow-sm" : "bg-black/5 hover:bg-black/10"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <label className="field-label">
          Reference date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field-input" />
        </label>
        <Button variant="dark" fullWidth onClick={loadSummary}>
          Load summary
        </Button>
        {error && <Alert variant="error">{error}</Alert>}
        <p className="text-xs text-[var(--color-muted)]">
          Pick the day/week/month you want. Only submitted reports are included.
        </p>
      </Card>

      {summary && (
        <Card className="mb-6">
          <p className="text-sm text-[var(--color-muted)]">
            {summary.from} → {summary.to} · <strong>{summary.count}</strong> {summary.count === 1 ? "entry" : "entries"}
          </p>
          <div className="grid grid-cols-2 gap-4 mt-4">
            {(
              [
                ["Sales", summary.totals.sales],
                ["Returns", summary.totals.returns],
                ["Expenses", summary.totals.expenses],
                ["Difference", summary.totals.difference],
              ] as const
            ).map(([label, val]) => (
              <div key={label} className="rounded-xl bg-[var(--color-cream)] p-3">
                <p className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide">{label}</p>
                <p className="text-lg font-bold tabular-nums mt-1">{fmt(val)}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-2">
        {(["pdf", "excel", "csv"] as const).map((f) => (
          <Button
            key={f}
            onClick={() => void exportFile(f)}
            disabled={exporting !== null}
            className="uppercase text-xs py-4"
          >
            {exporting === f ? "…" : f}
          </Button>
        ))}
      </div>
    </div>
  );
}
