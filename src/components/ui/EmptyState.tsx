import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-black/10 bg-white/50">
      <p className="font-medium text-[var(--color-ink)]">{title}</p>
      {description && <p className="text-sm text-[var(--color-muted)] mt-1 max-w-sm mx-auto">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
