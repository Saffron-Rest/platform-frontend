type SpinnerSize = "sm" | "md" | "lg" | "block";

const SIZE: Record<SpinnerSize, { wrapper: string; circle: string; label: string }> = {
  sm: {
    wrapper: "inline-flex items-center gap-2",
    circle: "w-4 h-4 border-2",
    label: "text-xs text-[var(--color-muted)]",
  },
  md: {
    wrapper: "inline-flex items-center gap-2",
    circle: "w-5 h-5 border-2",
    label: "text-sm text-[var(--color-muted)]",
  },
  lg: {
    wrapper: "inline-flex flex-col items-center justify-center gap-3",
    circle: "w-10 h-10 border-[3px]",
    label: "text-sm text-[var(--color-muted)]",
  },
  block: {
    wrapper: "flex flex-col items-center justify-center py-16 gap-3 w-full",
    circle: "w-8 h-8 border-2",
    label: "text-sm text-[var(--color-muted)]",
  },
};

type SpinnerProps = {
  /** Size variant. {@code block} (default) keeps the legacy
   *  {@code py-16}-centered behaviour so existing call sites don't
   *  break; pass {@code sm}/{@code md}/{@code lg} for inline contexts
   *  (button, dialog title bar, table row). */
  size?: SpinnerSize;
  label?: string;
  /** Hide the visible label but keep it announced to screen readers via
   *  {@code aria-label}. Useful inside buttons. */
  hideLabel?: boolean;
  className?: string;
};

/**
 * Loading indicator. The default {@code size="block"} matches the
 * pre-Phase-2 component (vertical centred block with label below) so
 * legacy call sites keep rendering identically. New code should pick
 * an explicit size: {@code sm} inside buttons, {@code md} alongside
 * inline labels, {@code lg} for full-page loading states, and
 * {@code block} for list-page placeholders.
 */
export function Spinner({
  size = "block",
  label = "Loading…",
  hideLabel,
  className = "",
}: SpinnerProps) {
  const s = SIZE[size];
  return (
    <div
      className={`${s.wrapper} ${className}`}
      role="status"
      aria-live="polite"
      aria-label={hideLabel ? label : undefined}
    >
      <span
        className={`${s.circle} rounded-full border-[var(--color-saffron)]/30 border-t-[var(--color-saffron)] animate-spin`}
        aria-hidden="true"
      />
      {label && !hideLabel ? <span className={s.label}>{label}</span> : null}
    </div>
  );
}
