import type { ReactNode } from "react";

/**
 * "Nothing to show" placeholder used wherever a list/table can be empty.
 *
 * <p>Prefer this over a bare "No data" string — the icon + description +
 * single CTA pattern turns a dead-end into a clear next step. The icon
 * is optional so existing callers don't need to be touched.</p>
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-black/10 bg-white/50">
      {icon && (
        <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-[var(--color-saffron-light)] text-[var(--color-saffron-dark)] flex items-center justify-center">
          {icon}
        </div>
      )}
      <p className="font-medium text-[var(--color-ink)]">{title}</p>
      {description && (
        <p className="text-sm text-[var(--color-muted)] mt-1 max-w-sm mx-auto">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
