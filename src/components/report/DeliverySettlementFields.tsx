import { MoneyInput } from "../MoneyInput";
import { fmt } from "../../lib/calc";
import {
  PLATFORM_ROWS,
  platformSettledToCard,
  suggestedPlatformToCard,
} from "../../lib/treasuryCalc";
import type { EntryFormData, Platforms, TreasurySettings } from "../../types";

type Props = {
  data: EntryFormData;
  onChange: (d: EntryFormData) => void;
  disabled?: boolean;
  platforms: Platforms;
  treasurySettings: Pick<TreasurySettings, "platformSettlementRates">;
};

export function DeliverySettlementFields({
  data,
  onChange,
  disabled,
  platforms,
  treasurySettings,
}: Props) {
  const rates = treasurySettings.platformSettlementRates;
  const platformEnabled: Record<string, boolean> = {
    wolt: platforms.wolt,
    bolt: platforms.bolt,
    uberEats: platforms.uberEats,
    glovo: platforms.glovo,
    other: platforms.other,
  };

  const rows = PLATFORM_ROWS.filter((row) => platformEnabled[row.key]);
  const hasDeliverySales = rows.some((row) => num(data[row.salesKey]) > 0);
  const hasManual = rows.some((row) => data[row.settledKey] != null);

  if (!hasDeliverySales && !hasManual) return null;

  const setSettled = (key: keyof EntryFormData, value: number | null) =>
    onChange({ ...data, [key]: value });

  return (
    <div className="mt-4 pt-4 border-t border-black/10 space-y-3">
      <div>
        <p className="text-sm font-medium text-[var(--color-ink)]">Delivery → card / bank</p>
        <p className="text-xs text-[var(--color-muted)] mt-0.5">
          Default uses Settings percentages. Uncheck to enter the exact amount that reached your card
          account when it differs.
        </p>
      </div>
      {rows.map((row) => {
        const sales = num(data[row.salesKey]);
        if (sales <= 0 && data[row.settledKey] == null) return null;
        const rate = rates[row.key] ?? 0.5;
        const suggested = suggestedPlatformToCard(sales, rate);
        const useDefault = data[row.settledKey] == null;
        const effective = platformSettledToCard(
          data,
          row.key,
          row.salesKey,
          row.settledKey,
          rates
        );

        return (
          <div key={row.key} className="rounded-xl bg-white/80 border border-black/5 p-3 space-y-2">
            <div className="flex justify-between items-baseline gap-2 text-sm">
              <span className="font-medium">{row.label}</span>
              <span className="text-[var(--color-muted)] tabular-nums">
                Sales {fmt(sales)}
                {useDefault && (
                  <span className="text-[var(--color-saffron)]"> · {Math.round(rate * 100)}%</span>
                )}
              </span>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={useDefault}
                disabled={disabled}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSettled(row.settledKey, null);
                  } else {
                    setSettled(row.settledKey, suggested);
                  }
                }}
                className="w-4 h-4"
              />
              <span>Use default ({fmt(suggested)} at {Math.round(rate * 100)}%)</span>
            </label>
            {!useDefault && (
              <MoneyInput
                label="Amount to card"
                value={num(data[row.settledKey]) || suggested}
                onChange={(v) => setSettled(row.settledKey, v)}
                disabled={disabled}
              />
            )}
            <p className="text-xs text-[var(--color-muted)] tabular-nums">
              Counts toward treasury card balance: <strong>{fmt(effective)}</strong>
            </p>
          </div>
        );
      })}
    </div>
  );
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}
