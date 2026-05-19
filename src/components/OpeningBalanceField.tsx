import { MoneyInput } from "./MoneyInput";
import { OpeningHintText } from "./OpeningHintText";
import type { OpeningHint } from "../types";
import { fmt } from "../lib/calc";

type Props = {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  editable?: boolean;
  openingHint?: OpeningHint | null;
};

export function OpeningBalanceField({
  value,
  onChange,
  disabled,
  editable = true,
  openingHint,
}: Props) {
  const readOnly = disabled || !editable;

  return (
    <div className="sm:col-span-2">
      {readOnly ? (
        <div className="rounded-xl border border-black/10 bg-[var(--color-cream)]/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            Cash in drawer at start
          </p>
          <p className="text-2xl font-bold tabular-nums mt-1">{fmt(value)}</p>
          <p className="text-xs text-[var(--color-muted)] mt-2 leading-relaxed">
            Matches the restaurant&apos;s last <strong>actual cash counted</strong> (any shift).
            Only an admin can change this.
          </p>
        </div>
      ) : (
        <MoneyInput
          label="Cash in drawer at start"
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
      )}

      {openingHint && (
        <div className="mt-2 p-3 rounded-xl bg-[var(--color-cream)] border border-black/5">
          <OpeningHintText hint={openingHint} />
          {editable && !openingHint.handoverPending && (
            <p className="text-xs text-[var(--color-muted)] mt-1">
              Override only if the drawer did not match that count.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
