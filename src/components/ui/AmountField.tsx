import { useEffect, useState } from "react";
import { formatMoneyForInput, parseMoneyInput } from "../../lib/numbers";

type BaseProps = {
  label: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
};

type NonNullableProps = BaseProps & {
  value: number;
  onChange: (v: number) => void;
  nullable?: false;
};

type NullableProps = BaseProps & {
  value: number | null;
  onChange: (v: number | null) => void;
  nullable: true;
};

type Props = NonNullableProps | NullableProps;

const DEFAULT_INPUT_CLASS = "w-full mt-1 px-3 py-2 rounded-lg border bg-white text-lg font-medium";

function externalToRaw(value: number | null | undefined): string {
  if (value == null) return "";
  return formatMoneyForInput(value);
}

/** Reusable decimal-friendly amount input that accepts `.` and `,`, allows partial
 *  entries like `12.` during typing, and only commits the parsed number on valid
 *  input. Set `nullable` to allow an empty value (commits `null`). */
export function AmountField(props: Props) {
  const {
    label,
    disabled,
    placeholder = "0.00",
    className = "",
    inputClassName = DEFAULT_INPUT_CLASS,
  } = props;
  const value = props.value;
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState<string>(() => externalToRaw(value));

  useEffect(() => {
    if (focused) return;
    setRaw(externalToRaw(value));
  }, [value, focused]);

  const commit = (next: number | null) => {
    if (props.nullable) {
      if (next !== props.value) props.onChange(next);
    } else {
      const committed = next ?? 0;
      if (committed !== props.value) props.onChange(committed);
    }
  };

  return (
    <label className={`block ${className}`}>
      {label}
      <input
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
          // Always show what the user typed (partial input ok)
          setRaw(next);
          const parsed = parseMoneyInput(next);
          if (parsed === null) return;
          if (next.trim() === "" && props.nullable) {
            commit(null);
            return;
          }
          commit(parsed);
        }}
        onBlur={() => {
          setFocused(false);
          const trimmed = raw.trim();
          if (trimmed === "") {
            commit(props.nullable ? null : 0);
            setRaw(props.nullable ? "" : externalToRaw(0));
            return;
          }
          const parsed = parseMoneyInput(trimmed);
          const committed = parsed ?? (props.nullable ? null : 0);
          commit(committed);
          setRaw(externalToRaw(committed));
        }}
        className={inputClassName}
      />
    </label>
  );
}
