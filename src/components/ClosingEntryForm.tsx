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
  const difference = actual - opening;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/80">
        <p className="text-sm text-blue-950 leading-relaxed">
          <strong className="font-semibold">Closing shift</strong> — record cash at handover and your final count.
          Sales and expenses are handled by other shifts or admin.
        </p>
      </div>

      <section className="bg-white rounded-2xl p-4 shadow-sm border border-black/5">
        <h3 className="font-semibold text-base mb-3 text-[var(--color-saffron-dark)]">Opening</h3>
        <OpeningBalanceField
          value={data.openingBalance}
          onChange={(v) => set("openingBalance", v)}
          disabled={disabled}
          editable={openingEditable}
          openingHint={openingHint}
        />
      </section>

      <section className="bg-[var(--color-ink)] text-white rounded-2xl p-5 shadow-md">
        <h3 className="font-semibold text-lg mb-1">Closing count</h3>
        <p className="text-white/60 text-sm mb-4">Count all cash in the drawer before you leave.</p>
        <MoneyInput
          label="Actual cash counted"
          value={data.actualCashCounted}
          onChange={(v) => set("actualCashCounted", v)}
          disabled={disabled}
          variant="dark"
        />
        <div
          className={`mt-4 p-4 rounded-xl text-center font-semibold text-lg ${
            difference < -0.01
              ? "bg-[var(--color-danger)]/25 text-red-100"
              : difference > 0.01
                ? "bg-emerald-500/25 text-emerald-100"
                : "bg-white/10"
          }`}
        >
          <p className="text-white/70 text-xs font-normal uppercase tracking-wide mb-1">Vs opening</p>
          {fmt(difference)}
          {difference < -0.01 && <span className="block text-sm mt-1">Shortage</span>}
          {difference > 0.01 && <span className="block text-sm mt-1">Overage</span>}
        </div>
        <p className="text-white/50 text-xs mt-3 text-center">
          Opening was {fmt(opening)} for this shift.
        </p>
      </section>

      <label className="block">
        <span className="field-label">Notes (optional)</span>
        <textarea
          disabled={disabled}
          value={data.notes || ""}
          onChange={(e) => set("notes", e.target.value)}
          rows={2}
          placeholder="Handover notes, safe drops…"
          className="field-input resize-none"
        />
      </label>
    </div>
  );
}
