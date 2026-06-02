import {
  cloneElement,
  forwardRef,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

/**
 * Wraps a form control with a label, optional helper text, and optional
 * error message. Replaces the eight ad-hoc {@code Field} components
 * scattered across {@code AdminPayables}, {@code AdminOwnerExpenses},
 * {@code AdminStock}, {@code AdminRecipes}, {@code AdminIncidents},
 * {@code AdminCertifications}, {@code HaccpLogs}, and
 * {@code AdminChecklists} — each with subtly different styles.
 *
 * <p>Use {@link Input}, {@link Select}, {@link Textarea}, {@link Checkbox},
 * or {@link SwitchControl} as direct children, or pass a custom control
 * via {@code render}. The label, hint, and error are wired up with the
 * appropriate {@code htmlFor} / {@code aria-describedby} / {@code aria-invalid}
 * attributes so screen readers announce them in the right order.</p>
 */
type FieldProps = {
  label: ReactNode;
  /** Helper text rendered below the field in muted style. */
  hint?: ReactNode;
  /** Error message rendered below the field (replaces the hint when set). */
  error?: ReactNode;
  /** Mark the field as required (renders an asterisk + aria-required hint). */
  required?: boolean;
  /** Mark the field as optional (renders "(optional)" suffix on the label). */
  optional?: boolean;
  /** Receives the wired ids so the consumer can pass them to a custom
   *  control (e.g. a third-party date picker). */
  render?: (ctx: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
  /** Direct control children — receive the wiring through React.cloneElement
   *  so consumers don't have to remember the htmlFor/id dance. */
  children?: ReactNode;
  className?: string;
};

export function Field({
  label,
  hint,
  error,
  required,
  optional,
  render,
  children,
  className = "",
}: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = error ? errorId : hint ? hintId : undefined;
  const invalid = !!error;

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-semibold text-[var(--color-ink)]/80">
        <span>{label}</span>
        {required ? (
          <span aria-hidden="true" className="text-[var(--color-saffron)] ml-0.5">
            *
          </span>
        ) : null}
        {optional ? (
          <span className="ml-1 font-normal text-xs text-[var(--color-muted)]">(optional)</span>
        ) : null}
      </label>
      <div className="mt-1.5">
        {render
          ? render({ id, describedBy, invalid })
          : injectFieldProps(children, { id, describedBy, invalid, required })}
      </div>
      {error ? (
        <p id={errorId} className="text-xs text-[var(--color-danger)] mt-1.5">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-[var(--color-muted)] mt-1">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type ChildProps = {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  required?: boolean;
};

function injectFieldProps(
  children: ReactNode,
  ctx: { id: string; describedBy: string | undefined; invalid: boolean; required?: boolean }
): ReactNode {
  if (!children) return null;
  // We only inject when the child is a single element. Multiple children
  // (e.g. an input with a sibling button) keep the responsibility on the
  // caller so the wiring stays predictable.
  if (isValidElement(children)) {
    const el = children as ReactElement<ChildProps>;
    const next: ChildProps = {
      id: el.props.id ?? ctx.id,
      "aria-describedby": el.props["aria-describedby"] ?? ctx.describedBy,
      "aria-invalid": el.props["aria-invalid"] ?? (ctx.invalid || undefined),
      required: el.props.required ?? ctx.required,
    };
    return cloneElement(el, next);
  }
  return children;
}

/* ── Controls ───────────────────────────────────────────────────────── */

type CommonInputProps = {
  /** Render compact (smaller height + padding). Useful in dense table editors. */
  size?: "md" | "sm";
};

type InputProps = InputHTMLAttributes<HTMLInputElement> & CommonInputProps;

const inputClass =
  "w-full rounded-xl border border-black/[0.08] bg-white text-base focus:outline-none focus:ring-2 focus:ring-[var(--color-saffron)]/35 focus:border-[var(--color-saffron)] disabled:opacity-60 disabled:bg-stone-50 aria-[invalid=true]:border-[var(--color-danger)] aria-[invalid=true]:focus:ring-[var(--color-danger)]/30";

/**
 * Standard text input. Sized for tablet touch targets by default
 * ({@code min-h-11}, large font on touch). Pass {@code size="sm"} for
 * dense table editors.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = "md", className = "", ...rest },
  ref
) {
  const padding = size === "sm" ? "px-3 py-2 text-sm min-h-9" : "px-3.5 py-3 min-h-11";
  return (
    <input ref={ref} className={`${inputClass} ${padding} ${className}`} {...rest} />
  );
});

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> &
  CommonInputProps & { children: ReactNode };

/** Native {@code <select>} matching the {@link Input} styling. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { size = "md", className = "", children, ...rest },
  ref
) {
  const padding = size === "sm" ? "px-3 py-2 text-sm min-h-9" : "px-3.5 py-3 min-h-11";
  return (
    <select ref={ref} className={`${inputClass} ${padding} pr-9 appearance-none bg-no-repeat bg-[right_0.75rem_center] ${className}`}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%236b635c'><path d='M5.5 7.5l4.5 4.5 4.5-4.5z'/></svg>\")",
        backgroundSize: "16px 16px",
      }}
      {...rest}
    >
      {children}
    </select>
  );
});

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className = "", rows = 3, ...rest },
  ref
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={`${inputClass} px-3.5 py-3 ${className}`}
      {...rest}
    />
  );
});

/* ── Checkbox / Switch ─────────────────────────────────────────────── */

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> & {
  label?: ReactNode;
  description?: ReactNode;
};

/**
 * Native checkbox with a tap-friendly label area. The whole row is
 * clickable, the label sits to the right of the box, and an optional
 * {@code description} renders below.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, description, className = "", id: idProp, ...rest },
  ref
) {
  const reactId = useId();
  const id = idProp ?? reactId;
  return (
    <label
      htmlFor={id}
      className={`flex items-start gap-2.5 cursor-pointer min-h-11 py-1 ${className}`}
    >
      <input
        ref={ref}
        id={id}
        type="checkbox"
        className="mt-1 w-4 h-4 rounded border-black/20 text-[var(--color-saffron)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-saffron)] focus-visible:ring-offset-1"
        {...rest}
      />
      {(label || description) && (
        <div className="flex-1 min-w-0">
          {label && (
            <span className="text-sm text-[var(--color-ink)]">{label}</span>
          )}
          {description && (
            <span className="block text-xs text-[var(--color-muted)] mt-0.5">{description}</span>
          )}
        </div>
      )}
    </label>
  );
});

type SwitchControlProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  /** Accessible name when {@code label} is omitted (e.g. dense table cell). */
  ariaLabel?: string;
  className?: string;
};

/**
 * iOS-style toggle. Implements the WAI-ARIA {@code switch} role rather
 * than re-styling a checkbox, so screen readers announce the state as
 * "on/off" instead of "checked/not checked".
 */
export function SwitchControl({
  checked,
  onChange,
  label,
  description,
  disabled,
  ariaLabel,
  className = "",
}: SwitchControlProps) {
  return (
    <label className={`flex items-center gap-3 cursor-pointer min-h-11 ${disabled ? "opacity-60 cursor-not-allowed" : ""} ${className}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-saffron)] focus-visible:ring-offset-2 ${
          checked ? "bg-[var(--color-saffron)]" : "bg-black/15"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
      {(label || description) && (
        <span className="flex-1 min-w-0">
          {label && (
            <span className="text-sm text-[var(--color-ink)]">{label}</span>
          )}
          {description && (
            <span className="block text-xs text-[var(--color-muted)] mt-0.5">{description}</span>
          )}
        </span>
      )}
    </label>
  );
}
