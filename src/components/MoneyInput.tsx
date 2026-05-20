import { useEffect, useRef, useState } from "react";
import { formatMoneyForInput, parseMoneyInput } from "../lib/numbers";

type Props = {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  variant?: "light" | "dark";
  placeholder?: string;
};

export function MoneyInput({
  label,
  value,
  onChange,
  disabled,
  variant = "light",
  placeholder = "0.00",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState<string>(() => formatMoneyForInput(value));

  /** Sync from prop only when not actively editing, so external resets
   *  (load entry, save) update the field but don't eat the user's typing. */
  useEffect(() => {
    if (focused) return;
    setRaw(formatMoneyForInput(value));
  }, [value, focused]);

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
          ref={inputRef}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          disabled={disabled}
          placeholder={placeholder}
          value={raw}
          onFocus={(e) => {
            setFocused(true);
            e.target.select();
          }}
          onChange={(e) => {
            const next = e.target.value;
            const parsed = parseMoneyInput(next);
            if (parsed === null) {
              setRaw(next);
              return;
            }
            setRaw(next);
            if (parsed !== value) onChange(parsed);
          }}
          onBlur={() => {
            setFocused(false);
            const parsed = parseMoneyInput(raw);
            const committed = parsed ?? 0;
            if (committed !== value) onChange(committed);
            setRaw(formatMoneyForInput(committed));
          }}
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
