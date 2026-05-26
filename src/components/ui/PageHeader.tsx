import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Badge } from "./Badge";
import { IconChevronRight } from "../icons";

export type PageHeaderTab = {
  id: string;
  label: string;
  to?: string;
  /** When neither `to` nor `onClick` is given the tab is purely visual. */
  onClick?: () => void;
  active?: boolean;
  badge?: string | number;
};

export type Breadcrumb = {
  label: string;
  to?: string;
};

/**
 * Standard chrome at the top of every page.
 *
 * <p>v2 adds an optional breadcrumb trail, a "kicker" (small uppercase
 * section label above the title — looks like Stripe's category labels),
 * a tabs row for in-page navigation, and an optional meta row for
 * badges/timestamps. All slots are optional so the simplest call
 * <code>&lt;PageHeader title="X" /&gt;</code> still works.</p>
 *
 * <p>Layout rules:
 * <ul>
 *   <li>Breadcrumb stays on the left, single-line, ellipsis on overflow.</li>
 *   <li>Title is the page identity; never abbreviated.</li>
 *   <li>Actions are top-right on desktop, full-width below the title on mobile.</li>
 *   <li>Tabs row is the bottom edge, underlined, scroll-x when overflowing.</li>
 * </ul></p>
 */
export function PageHeader({
  kicker,
  breadcrumbs,
  title,
  subtitle,
  badge,
  badgeVariant,
  action,
  back,
  tabs,
  meta,
}: {
  /** Tiny uppercase label above the title (e.g. "Operations"). */
  kicker?: string;
  /** Crumb trail; current page is added implicitly via {@code title}. */
  breadcrumbs?: Breadcrumb[];
  title: string;
  subtitle?: string;
  badge?: string;
  badgeVariant?: "draft" | "locked" | "inactive" | "neutral";
  action?: ReactNode;
  back?: ReactNode;
  /** In-page tabs that sit under the title (e.g. Schedule list vs calendar). */
  tabs?: PageHeaderTab[];
  /** Auxiliary metadata row (status pills, last-updated, etc.). */
  meta?: ReactNode;
}) {
  return (
    <header className="mb-6 md:mb-8">
      {back && <div className="mb-3">{back}</div>}

      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav
          aria-label="Breadcrumb"
          className="mb-2 flex items-center gap-1.5 text-xs text-[var(--color-muted)] overflow-x-auto whitespace-nowrap"
        >
          {breadcrumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1.5 min-w-0">
              {c.to ? (
                <Link
                  to={c.to}
                  className="hover:text-[var(--color-ink)] transition-colors truncate max-w-[12rem]"
                >
                  {c.label}
                </Link>
              ) : (
                <span className="truncate max-w-[12rem]">{c.label}</span>
              )}
              {i < breadcrumbs.length - 1 && (
                <IconChevronRight className="w-3 h-3 shrink-0 text-[var(--color-muted)]/60" />
              )}
            </span>
          ))}
        </nav>
      )}

      {kicker && (
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-saffron-dark)] mb-1.5">
          {kicker}
        </p>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--color-ink)]">
              {title}
            </h1>
            {badge && <Badge variant={badgeVariant ?? "neutral"}>{badge}</Badge>}
          </div>
          {subtitle && (
            <p className="text-sm md:text-base text-[var(--color-muted)] mt-1.5 max-w-xl">
              {subtitle}
            </p>
          )}
          {meta && <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div>}
        </div>
        {action && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">{action}</div>
        )}
      </div>

      {tabs && tabs.length > 0 && (
        <div className="mt-5 border-b border-black/[0.06] -mx-4 px-4 md:mx-0 md:px-0">
          <div className="flex items-center gap-1 overflow-x-auto">
            {tabs.map((t) => {
              const className = `relative px-3 py-2.5 text-sm whitespace-nowrap transition-colors ${
                t.active
                  ? "text-[var(--color-ink)] font-semibold"
                  : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              }`;
              const inner = (
                <>
                  <span>{t.label}</span>
                  {t.badge !== undefined && t.badge !== null && t.badge !== "" && (
                    <span className="ml-1.5 inline-flex items-center justify-center min-w-[1.25rem] h-4 px-1 text-[10px] font-semibold rounded-full bg-black/5 text-[var(--color-muted)]">
                      {t.badge}
                    </span>
                  )}
                  {t.active && (
                    <span
                      aria-hidden
                      className="absolute left-2 right-2 -bottom-px h-[2px] bg-[var(--color-saffron)] rounded-full"
                    />
                  )}
                </>
              );
              if (t.to) {
                return (
                  <Link key={t.id} to={t.to} className={className}>
                    {inner}
                  </Link>
                );
              }
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={t.onClick}
                  className={className}
                >
                  {inner}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}
