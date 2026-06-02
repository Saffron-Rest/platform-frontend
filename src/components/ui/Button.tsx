import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "dark";
type Size = "sm" | "md" | "lg";

const styles: Record<Variant, string> = {
  primary:
    "bg-[var(--color-saffron)] text-white hover:bg-[var(--color-saffron-dark)] shadow-sm shadow-[var(--color-saffron)]/20",
  secondary:
    "border-2 border-[var(--color-saffron)] text-[var(--color-saffron)] bg-white hover:bg-[var(--color-saffron)]/5",
  ghost: "text-[var(--color-muted)] hover:bg-black/5 hover:text-[var(--color-ink)]",
  danger: "bg-red-50 text-[var(--color-danger)] border border-red-200 hover:bg-red-100",
  dark: "bg-[var(--color-ink)] text-white hover:bg-black",
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-2 text-xs md:text-sm min-h-9",
  md: "px-5 py-3 text-sm md:text-base min-h-11",
  lg: "px-6 py-3.5 text-base md:text-lg min-h-12",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  /** Show an inline spinner and block the click. Visual cue for in-flight
   *  async actions — fixes the "Saving…" text-only freeze pattern. */
  loading?: boolean;
  children: ReactNode;
};

/**
 * Inline spinner sized to match button text height. Hand-rolled to avoid
 * the {@code <Spinner>}'s built-in {@code py-16} block wrapper.
 */
function InlineSpinner() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="animate-spin w-4 h-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="9" opacity="0.25" />
      <path d="M21 12a9 9 0 0 1-9 9" />
    </svg>
  );
}

export function Button({
  variant = "primary",
  size = "md",
  fullWidth,
  loading = false,
  className = "",
  children,
  disabled,
  type,
  onClick,
  ...props
}: Props) {
  const isDisabled = disabled || loading;
  return (
    <button
      type={type ?? "button"}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      onClick={loading ? undefined : onClick}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition",
        sizes[size],
        "disabled:opacity-50 disabled:pointer-events-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-saffron)] focus-visible:ring-offset-2",
        fullWidth ? "w-full" : "",
        styles[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {loading && <InlineSpinner />}
      {children}
    </button>
  );
}
