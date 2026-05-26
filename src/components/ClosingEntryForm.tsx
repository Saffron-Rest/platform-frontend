import { MoneyInput } from "./MoneyInput";
import { OpeningBalanceField } from "./OpeningBalanceField";
import type { EntryFormData, OpeningHint } from "../types";
import { fmt } from "../lib/calc";
import { num } from "../lib/numbers";

type Props = {
  data: EntryFormData;
  onChange: (d: EntryFormData) => void;
  disabled?: boolean;
  openingEditable?: boolean;
  openingHint?: OpeningHint | null;
};

/**
 * Simplified report form for a closing-only cashier.
 *
 * <p>Order is intentional and inverted from the full editor:
 * <ol>
 *   <li><b>Count the drawer</b> — the job. Big dark card at the very top
 *       with the "Match expected" quick-fill chip.</li>
 *   <li><b>Confirm opening</b> — usually pre-filled from a handover, so
 *       the cashier just verifies it.</li>
 *   <li><b>Notes</b> — optional handover or anomaly notes.</li>
 * </ol></p>
 *
 * <p>The diff readout under the count input now says "Drawer change"
 * (actual − opening) rather than the misleading "Vs opening", because
 * in a closing-only flow there are no sales/expenses in the form to
 * compute a true expected-vs-actual difference here — the backend
 * recomputes the shift's true difference after submit using the
 * opening cashier's data.</p>
 */
export function ClosingEntryForm({
  data,
  onChange,
  disabled,
  openingEditable = true,
  openingHint,
}: Props) {
  const set = (key: keyof EntryFormData, value: number | string) =>
    onChange({ ...data, [key]: value });

  const opening = num(data.openingBalance);
  const actual = num(data.actualCashCounted);
  const change = actual - opening;
  const hasCount = actual > 0;

  const matchOpening = () => set("actualCashCounted", opening);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/80">
        <p className="text-sm text-blue-950 leading-relaxed">
          <strong className="font-semibold">Closing shift</strong> — count the drawer at hand-over.
          Sales and expenses are recorded by the opening cashier or your admin.
        </p>
      </div>

      {/* 1. Count — the cashier's primary job, top of the screen. */}
      <section
        id="report-section-closing"
        className="report-section-anchor bg-[var(--color-ink)] text-white rounded-2xl p-5 shadow-md"
      >
        <div className="flex items-baseline justify-between gap-3 mb-1">
          <h3 className="font-semibold text-lg">Count the drawer</h3>
          <span className="text-[10px] font-bold text-white/55 uppercase tracking-wider">
            Step 1
          </span>
        </div>
        <p className="text-white/60 text-sm mb-4">
          Count physical cash, coins, and IOUs. Enter the total.
        </p>
        <MoneyInput
          label="Actual cash counted"
          value={data.actualCashCounted}
          onChange={(v) => set("actualCashCounted", v)}
          disabled={disabled}
          variant="dark"
        />
        {!disabled && opening > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={matchOpening}
              className="text-xs font-semibold text-white/90 bg-white/10 hover:bg-white/15 rounded-full px-3 py-1.5 border border-white/15 transition"
            >
              Same as opening ({fmt(opening)})
            </button>
          </div>
        )}
        <div
          className={`mt-4 p-4 rounded-xl text-center font-semibold text-lg ${
            change < -0.01
              ? "bg-[var(--color-danger)]/25 text-red-100"
              : change > 0.01
                ? "bg-emerald-500/25 text-emerald-100"
                : "bg-white/10"
          }`}
        >
          <p className="text-white/70 text-xs font-normal uppercase tracking-wide mb-1">
            Drawer change vs opening
          </p>
          {hasCount ? fmt(change) : "—"}
          {hasCount && change < -0.01 && (
            <span className="block text-sm mt-1">Cash decreased during shift</span>
          )}
          {hasCount && change > 0.01 && (
            <span className="block text-sm mt-1">Cash increased during shift</span>
          )}
          {hasCount && Math.abs(change) <= 0.01 && (
            <span className="block text-sm mt-1 text-white/70">
              Drawer matches opening
            </span>
          )}
        </div>
        <p className="text-white/45 text-[11px] mt-3 text-center leading-relaxed">
          Your shift difference vs sales is computed by the system after
          you submit, using the opening cashier's data.
        </p>
      </section>

      {/* 2. Opening — usually a confirmation, so smaller weight. */}
      <section
        id="report-section-opening"
        className="report-section-anchor bg-white rounded-2xl p-4 shadow-sm border border-black/5"
      >
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <h3 className="font-semibold text-base text-[var(--color-saffron-dark)]">
            Confirm opening cash
          </h3>
          <span className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider">
            Step 2
          </span>
        </div>
        <OpeningBalanceField
          value={data.openingBalance}
          onChange={(v) => set("openingBalance", v)}
          disabled={disabled}
          editable={openingEditable}
          openingHint={openingHint}
        />
      </section>

      {/* 3. Notes — optional. */}
      <section className="bg-white rounded-2xl p-4 shadow-sm border border-black/5">
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <h3 className="font-semibold text-base text-[var(--color-ink)]">Notes</h3>
          <span className="text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-wider">
            Optional
          </span>
        </div>
        <textarea
          disabled={disabled}
          value={data.notes || ""}
          onChange={(e) => set("notes", e.target.value)}
          rows={2}
          placeholder="Handover notes, safe drops, anomalies…"
          className="field-input resize-none w-full"
        />
      </section>
    </div>
  );
}
