import type { ReactNode } from "react";
import { Badge } from "./Badge";

export function PageHeader({
  title,
  subtitle,
  badge,
  badgeVariant,
  action,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  badgeVariant?: "draft" | "locked" | "inactive" | "neutral";
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div className="min-w-0">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-[var(--color-muted)] mt-1">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {badge && <Badge variant={badgeVariant ?? "neutral"}>{badge}</Badge>}
        {action}
      </div>
    </div>
  );
}
