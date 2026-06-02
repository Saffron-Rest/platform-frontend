import { useId, type ReactNode } from "react";

export type TabItem<TValue extends string = string> = {
  value: TValue;
  label: ReactNode;
  /** Optional muted count to the right of the label (e.g. "Outstanding · 12"). */
  count?: number | string;
  /** Hide this tab entirely (useful with permission-aware menus). */
  hidden?: boolean;
  /** Disable interaction without removing the tab from layout. */
  disabled?: boolean;
};

type CommonProps<TValue extends string> = {
  items: TabItem<TValue>[];
  value: TValue;
  onChange: (value: TValue) => void;
  /** Accessible label for the tablist. Required for screen readers. */
  ariaLabel: string;
  className?: string;
};

/* ── Underline tabs ────────────────────────────────────────────────── */

/**
 * Underline tabs — the primary in-page navigation pattern. Use for
 * top-of-page sub-sections (e.g. "Outstanding / All / Settled" on the
 * payables page). For in-card filters use {@link SegmentedControl}.
 *
 * <p>Implements WAI-ARIA tablist semantics: arrow-key navigation,
 * {@code role="tab"}, {@code aria-selected}, focus-visible ring.</p>
 */
export function Tabs<TValue extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  className = "",
}: CommonProps<TValue>) {
  return (
    <div className={`relative ${className}`}>
      <div
        role="tablist"
        aria-label={ariaLabel}
        className="flex items-end gap-1 overflow-x-auto scrollbar-thin border-b border-black/[0.06] -mb-px"
      >
        {items
          .filter((it) => !it.hidden)
          .map((item) => {
            const isActive = item.value === value;
            return (
              <button
                key={item.value}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-disabled={item.disabled || undefined}
                tabIndex={isActive ? 0 : -1}
                disabled={item.disabled}
                onClick={() => !item.disabled && onChange(item.value)}
                onKeyDown={(e) => handleArrowKey(e, items, value, onChange)}
                className={[
                  "relative px-4 py-2.5 text-sm font-semibold whitespace-nowrap min-h-11 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-saffron)] focus-visible:ring-offset-1",
                  isActive
                    ? "text-[var(--color-saffron-dark)]"
                    : "text-[var(--color-muted)] hover:text-[var(--color-ink)]",
                  item.disabled ? "opacity-40 cursor-not-allowed" : "",
                ].join(" ")}
              >
                {item.label}
                {item.count !== undefined && (
                  <span
                    className={`ml-1.5 inline-flex items-center justify-center min-w-5 px-1.5 text-[10px] rounded-full ${
                      isActive
                        ? "bg-[var(--color-saffron)]/15 text-[var(--color-saffron-dark)]"
                        : "bg-black/5 text-[var(--color-muted)]"
                    }`}
                  >
                    {item.count}
                  </span>
                )}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute left-3 right-3 -bottom-px h-[2px] bg-[var(--color-saffron)] rounded-full"
                  />
                )}
              </button>
            );
          })}
      </div>
    </div>
  );
}

/* ── Segmented control ─────────────────────────────────────────────── */

type SegmentedProps<TValue extends string> = CommonProps<TValue> & {
  /** Visual size — {@code sm} for filter rows, {@code md} (default) for
   *  primary in-card switches. */
  size?: "sm" | "md";
};

/**
 * iOS-style segmented control. Use for in-card filters where space is
 * tight and the options are few (≤4). For more options, prefer
 * {@link Tabs}. Renders inside a cream tray so it's clearly distinct
 * from page-level navigation.
 */
export function SegmentedControl<TValue extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  size = "md",
  className = "",
}: SegmentedProps<TValue>) {
  const padding = size === "sm" ? "px-3 py-1.5 min-h-9 text-xs" : "px-4 py-2 min-h-10 text-sm";
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`inline-flex bg-black/[0.04] rounded-xl p-1 gap-0.5 ${className}`}
    >
      {items
        .filter((it) => !it.hidden)
        .map((item) => {
          const isActive = item.value === value;
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              disabled={item.disabled}
              onClick={() => !item.disabled && onChange(item.value)}
              onKeyDown={(e) => handleArrowKey(e, items, value, onChange)}
              className={[
                padding,
                "rounded-lg font-semibold whitespace-nowrap transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-saffron)] focus-visible:ring-offset-1",
                isActive
                  ? "bg-white text-[var(--color-ink)] shadow-sm"
                  : "text-[var(--color-muted)] hover:text-[var(--color-ink)]",
                item.disabled ? "opacity-40 cursor-not-allowed" : "",
              ].join(" ")}
            >
              {item.label}
              {item.count !== undefined && (
                <span className="ml-1.5 text-[10px] tabular-nums text-[var(--color-muted)]">
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
    </div>
  );
}

/* ── Tab panel slot (optional helper) ──────────────────────────────── */

/**
 * Wrap a tab's contents to wire {@code aria-labelledby} between the
 * tab and its panel. Optional — many pages render the active panel
 * without a wrapper, and that's fine.
 */
export function TabPanel({
  active,
  children,
  className = "",
}: {
  active: boolean;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div
      role="tabpanel"
      id={id}
      hidden={!active}
      aria-hidden={!active}
      className={className}
    >
      {active ? children : null}
    </div>
  );
}

/* ── Internal: arrow-key navigation ────────────────────────────────── */

function handleArrowKey<TValue extends string>(
  e: React.KeyboardEvent<HTMLButtonElement>,
  items: TabItem<TValue>[],
  current: TValue,
  onChange: (v: TValue) => void
) {
  const visible = items.filter((it) => !it.hidden && !it.disabled);
  const idx = visible.findIndex((it) => it.value === current);
  if (idx < 0) return;
  let next = idx;
  if (e.key === "ArrowRight" || e.key === "ArrowDown") {
    next = (idx + 1) % visible.length;
  } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
    next = (idx - 1 + visible.length) % visible.length;
  } else if (e.key === "Home") {
    next = 0;
  } else if (e.key === "End") {
    next = visible.length - 1;
  } else {
    return;
  }
  e.preventDefault();
  onChange(visible[next].value);
}
