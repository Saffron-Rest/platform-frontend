import { useState } from "react";
import { downloadFile } from "../../api/client";

export type ExportType = "expenses" | "entries" | "payouts" | "deliveries";

export type ExportConfig = {
  type: ExportType;
  /** Optional pre-set filters appended to the export URL. */
  from?: string;
  to?: string;
  cashierId?: string;
  paymentSource?: string;
  platform?: string;
  /** UI label override — defaults to "Export CSV". */
  label?: string;
};

/** Small download button — drop it on any list page with a config object.
 *  Filename is generated server-side based on type + range. */
export function ExportButton({ config, className = "" }: { config: ExportConfig; className?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const onClick = async () => {
    setBusy(true);
    setError("");
    try {
      const params = new URLSearchParams({ type: config.type });
      if (config.from) params.set("from", config.from);
      if (config.to) params.set("to", config.to);
      if (config.cashierId) params.set("cashierId", config.cashierId);
      if (config.paymentSource) params.set("paymentSource", config.paymentSource);
      if (config.platform) params.set("platform", config.platform);
      const filename = guessFilename(config);
      await downloadFile(`/exports?${params}`, filename);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="inline-flex flex-col items-stretch">
      <button
        type="button"
        onClick={() => void onClick()}
        disabled={busy}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-black/10 bg-white text-sm hover:bg-[var(--color-cream)]/40 disabled:opacity-60 ${className}`}
        title="Download CSV"
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
        {busy ? "Preparing…" : config.label ?? "Export CSV"}
      </button>
      {error && (
        <p className="text-[10px] text-red-600 mt-1">{error}</p>
      )}
    </div>
  );
}

function guessFilename(config: ExportConfig): string {
  const slug =
    config.type === "entries"
      ? "shift-reports"
      : config.type === "deliveries"
      ? "delivery-income"
      : config.type;
  const range = `${config.from ?? "all"}_${config.to ?? "today"}`;
  return `${slug}_${range}.csv`;
}
