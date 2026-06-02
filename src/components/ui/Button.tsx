import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "dark";
type Size = "sm" | "md" | "lg";

const styles: Record<Variant, string> = {
  primary:
    "bg-[var(--color-lime)] text-[var(--color-forest)] hover:bg-[var(--color-lime-soft)] shadow-sm shadow-[var(--color-lime)]/30",
  secondary:
    "border text-[var(--color-ink)] bg-white hover:bg-[var(--color-cream)]",
  ghost: "text-[var(--color-muted)] hover:bg-[var(--color-stone)] hover:text-[var(--color-ink)]",
  danger: "text-[var(--color-danger)] border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 hover:bg-[var(--color-danger)]/10",
  dark: "bg-[var(--color-forest)] text-[var(--color-lime)] hover:bg-[var(--color-forest-deep)]",
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs font-medium min-h-11 md:min-h-8",
  md: "px-4 py-2 text-sm font-semibold min-h-12 md:min-h-9",
  lg: "px-5 py-2.5 text-sm font-semibold min-h-12 md:min-h-10",
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
        "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition",
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
