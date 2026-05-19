import { num } from "../lib/numbers";

type Props = {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  variant?: "light" | "dark";
};

export function MoneyInput({ label, value, onChange, disabled, variant = "light" }: Props) {
  const display = num(value);
  const inputClass =
    variant === "dark"
      ? "w-full text-lg font-medium px-4 py-3 rounded-xl border border-white/20 bg-white/10 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-60"
      : "field-input text-lg font-medium pl-4 pr-12";

  return (
    <label className="block">
      <span
        className={`text-sm mb-1 block font-medium ${
          variant === "dark" ? "text-white/80" : "text-[var(--color-muted)]"
        }`}
      >
        {label}
      </span>
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          disabled={disabled}
          value={display}
          onChange={(e) => onChange(num(e.target.value))}
          className={inputClass}
        />
        {variant === "light" && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-[var(--color-muted)] pointer-events-none">
            PLN
          </span>
        )}
      </div>
    </label>
  );
}
