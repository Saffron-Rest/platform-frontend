import type { ReactNode } from "react";

/**
 * Badge tone vocabulary.
 *
 * <p><b>Semantic tones</b> ({@code success}, {@code info}, {@code warning},
 * {@code danger}, {@code brand}) are the canonical names — use these in
 * new code so the meaning is unambiguous (overdue → danger, not "draft").
 *
 * <p><b>Legacy tones</b> ({@code draft}, {@code locked}, {@code inactive},
 * {@code neutral}) are kept for backwards compatibility with the 20+
 * existing call sites. They map onto semantic tones internally — when
 * touching those call sites, prefer the semantic name.
 */
export type BadgeTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "brand"
  // Legacy aliases — keep until call sites migrate.
  | "draft"
  | "locked"
  | "inactive";

export type BadgeIntensity = "subtle" | "solid";

const SUBTLE: Record<BadgeTone, string> = {
  neutral: "bg-black/5 text-[var(--color-muted)]",
  info: "bg-blue-100 text-blue-900",
  success: "bg-emerald-100 text-emerald-900",
  warning: "bg-amber-100 text-amber-900",
  danger: "bg-red-100 text-red-900",
  brand: "bg-[var(--color-saffron)]/12 text-[var(--color-saffron-dark)]",
  // Legacy aliases:
  draft: "bg-amber-100 text-amber-900",
  locked: "bg-emerald-100 text-emerald-900",
  inactive: "bg-gray-100 text-gray-600",
};

const SOLID: Record<BadgeTone, string> = {
  neutral: "bg-[var(--color-ink)] text-white",
  info: "bg-blue-600 text-white",
  success: "bg-emerald-600 text-white",
  warning: "bg-amber-500 text-white",
  danger: "bg-[var(--color-danger)] text-white",
  brand: "bg-[var(--color-saffron)] text-white",
  draft: "bg-amber-500 text-white",
  locked: "bg-emerald-600 text-white",
  inactive: "bg-gray-500 text-white",
};

export type BadgeProps = {
  children: ReactNode;
  /** Preferred prop. Falls back to {@code variant} when absent. */
  tone?: BadgeTone;
  /** Legacy prop name — equivalent to {@code tone}. */
  variant?: BadgeTone;
  /** Visual weight. {@code subtle} (default) is best for dense lists;
   *  {@code solid} reads stronger and is good for hero rows. */
  intensity?: BadgeIntensity;
  className?: string;
  /** Optional native tooltip — useful for status badges that need a
   *  one-line explanation on hover (e.g. "Rate changed"). */
  title?: string;
  /** Optional leading icon slot. Pair colour with shape for users who
   *  can't distinguish status by hue alone (a11y best practice). */
  icon?: ReactNode;
};

/**
 * Compact status pill. Use {@code tone="danger"} for failures (overdue,
 * voided), {@code tone="warning"} for at-risk states, {@code tone="success"}
 * for done/paid, {@code tone="info"} for benign messages,
 * {@code tone="brand"} for owner highlights, and {@code tone="neutral"}
 * for muted state.
 */
export function Badge({
  children,
  tone,
  variant,
  intensity = "subtle",
  className = "",
  title,
  icon,
}: BadgeProps) {
  const resolved = tone ?? variant ?? "neutral";
  const palette = intensity === "solid" ? SOLID : SUBTLE;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${palette[resolved]} ${className}`}
      title={title}
    >
      {icon ? <span className="-ml-0.5 inline-flex items-center">{icon}</span> : null}
      {children}
    </span>
  );
}

/** @deprecated import {@link entryStatusTone} from {@code lib/statusBadges} instead. */
export function entryStatusBadge(status: string): BadgeTone {
  return status === "LOCKED" ? "locked" : "draft";
}
