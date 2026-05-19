import type { ReactNode } from "react";
import { Badge } from "./Badge";

export function PageHeader({
  title,
  subtitle,
  badge,
  badgeVariant,
  action,
  back,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  badgeVariant?: "draft" | "locked" | "inactive" | "neutral";
  action?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <header className="mb-6 md:mb-8">
      {back && <div className="mb-3">{back}</div>}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--color-ink)]">{title}</h1>
            {badge && <Badge variant={badgeVariant ?? "neutral"}>{badge}</Badge>}
          </div>
          {subtitle && <p className="text-sm md:text-base text-[var(--color-muted)] mt-1.5 max-w-xl">{subtitle}</p>}
        </div>
        {action && <div className="flex flex-wrap items-center gap-2 shrink-0">{action}</div>}
      </div>
    </header>
  );
}
