import type { ReactNode } from "react";

type Variant = "success" | "error" | "info" | "warning";

const styles: Record<Variant, string> = {
  success: "bg-emerald-50 text-emerald-900 border-emerald-200",
  error: "bg-red-50 text-[var(--color-danger)] border-red-200",
  info: "bg-blue-50 text-blue-900 border-blue-200",
  warning: "bg-amber-50 text-amber-900 border-amber-200",
};

/**
 * Variant → ARIA role mapping. Only error/warning announce immediately
 * (`alert`); success/info use {@code status} so screen readers don't
 * interrupt the user with non-urgent content.
 */
const roles: Record<Variant, "alert" | "status"> = {
  success: "status",
  info: "status",
  warning: "alert",
  error: "alert",
};

type Props = {
  children: ReactNode;
  variant?: Variant;
  /** Optional bold lead. Pairs nicely with a longer description in {@code children}. */
  title?: ReactNode;
  /** Optional action slot rendered on the right (e.g. a Retry button). */
  action?: ReactNode;
  className?: string;
};

/**
 * Inline alert/notice block. Renders a {@code <div>} (not a {@code <p>})
 * so titles, lists, and buttons can nest inside it. Use the {@link
 * useToast} hook for transient/dismissible messages instead.
 */
export function Alert({
  children,
  variant = "info",
  title,
  action,
  className = "",
}: Props) {
  return (
    <div
      role={roles[variant]}
      className={`text-sm py-2.5 px-3 rounded-xl border flex items-start gap-3 ${styles[variant]} ${className}`}
    >
      <div className="flex-1 min-w-0">
        {title ? <p className="font-semibold mb-0.5">{title}</p> : null}
        <div className={title ? "" : ""}>{children}</div>
      </div>
      {action ? <div className="shrink-0 self-center">{action}</div> : null}
    </div>
  );
}
