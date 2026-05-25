import { useEffect, useRef, useState } from "react";
import { downloadFile } from "../../api/client";

export type ExportType = "expenses" | "entries" | "payouts" | "deliveries";
export type ExportFormat = "csv" | "xlsx" | "pdf";

export type ExportConfig = {
  type: ExportType;
  /** Optional pre-set filters appended to the export URL. */
  from?: string;
  to?: string;
  cashierId?: string;
  paymentSource?: string;
  platform?: string;
  /** UI label override — defaults to "Export". */
  label?: string;
};

const FORMATS: { id: ExportFormat; label: string; description: string }[] = [
  { id: "csv", label: "CSV", description: "Plain spreadsheet text — opens in any tool" },
  { id: "xlsx", label: "Excel", description: "Formatted .xlsx with bold headers + frozen row" },
  { id: "pdf", label: "PDF", description: "Branded landscape PDF table" },
];

/** Download button with a format picker. Drop it on any list page with a
 *  config object — server picks the file name + content type per format. */
export function ExportButton({ config, className = "" }: { config: ExportConfig; className?: string }) {
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  const download = async (format: ExportFormat) => {
    setBusy(format);
    setError("");
    setOpen(false);
    try {
      const params = new URLSearchParams({ type: config.type, format });
      if (config.from) params.set("from", config.from);
      if (config.to) params.set("to", config.to);
      if (config.cashierId) params.set("cashierId", config.cashierId);
      if (config.paymentSource) params.set("paymentSource", config.paymentSource);
      if (config.platform) params.set("platform", config.platform);
      await downloadFile(`/exports?${params}`, guessFilename(config, format));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="inline-flex flex-col items-stretch relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy != null}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-black/10 bg-white text-sm hover:bg-[var(--color-cream)]/40 disabled:opacity-60 ${className}`}
        title="Download report"
      >
        <svg
          viewBox="0 0 24 24"
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        {busy ? `Preparing ${busy.toUpperCase()}…` : config.label ?? "Export"}
        <span className="text-[10px] text-[var(--color-muted)]">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 min-w-[240px] bg-white border border-black/10 rounded-xl shadow-lg overflow-hidden">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => void download(f.id)}
              className="w-full text-left px-3 py-2 hover:bg-[var(--color-cream)]/40"
            >
              <p className="text-sm font-medium">{f.label}</p>
              <p className="text-[11px] text-[var(--color-muted)]">{f.description}</p>
            </button>
          ))}
        </div>
      )}
      {error && (
        <p className="text-[10px] text-red-600 mt-1">{error}</p>
      )}
    </div>
  );
}

function guessFilename(config: ExportConfig, format: ExportFormat): string {
  const slug =
    config.type === "entries"
      ? "shift-reports"
      : config.type === "deliveries"
      ? "delivery-income"
      : config.type;
  const range = `${config.from ?? "all"}_${config.to ?? "today"}`;
  return `${slug}_${range}.${format}`;
}
