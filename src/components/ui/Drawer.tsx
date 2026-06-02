import { useCallback, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDialogChrome } from "../../lib/useDialogChrome";

type Side = "right" | "left";
type Width = "sm" | "md" | "lg";

const WIDTH_CLASS: Record<Width, string> = {
  sm: "sm:w-[360px]",
  md: "sm:w-[440px]",
  lg: "sm:w-[560px]",
};

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  side?: Side;
  width?: Width;
  /** Accessible title rendered as the drawer's heading. Auto-wires
   *  {@code aria-labelledby} on the drawer root. */
  title: ReactNode;
  /** Optional muted subtitle below the title. */
  subtitle?: ReactNode;
  /** Hide the built-in title bar (useful when the consumer wants a
   *  custom header). The drawer is still labelled via {@code ariaLabel}. */
  hideHeader?: boolean;
  ariaLabel?: string;
  dismissOnEsc?: boolean;
  dismissOnBackdrop?: boolean;
  /** Footer slot pinned to the bottom of the drawer. */
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * Side drawer used for comments, history, audit detail, etc. Shares
 * focus-trap / scroll-lock / focus-restoration with {@link Dialog}, so
 * keyboard and screen-reader users get the same experience.
 *
 * <p>Full-screen on phones (mobile bottom-sheet would conflict with the
 * existing app's BottomNav), {@code w-[440px]} or wider on tablets and
 * desktops.</p>
 */
export function Drawer({
  open,
  onClose,
  side = "right",
  width = "md",
  title,
  subtitle,
  hideHeader = false,
  ariaLabel,
  dismissOnEsc = true,
  dismissOnBackdrop = true,
  footer,
  children,
  className = "",
}: DrawerProps) {
  const titleId = useId();

  const handleClose = useCallback(() => onClose(), [onClose]);

  const containerRef = useDialogChrome({
    open,
    onEsc: dismissOnEsc ? handleClose : undefined,
  });

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const sideClass =
    side === "right"
      ? "right-0 drawer-anim-right"
      : "left-0 drawer-anim-left";

  return createPortal(
    <div className="fixed inset-0 z-[var(--z-drawer,50)] dialog-anim-backdrop">
      <button
        type="button"
        aria-label="Close drawer"
        onClick={dismissOnBackdrop ? handleClose : undefined}
        tabIndex={-1}
        className={`absolute inset-0 bg-black/40 ${dismissOnBackdrop ? "cursor-pointer" : "cursor-default"}`}
      />
      <aside
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabel ? undefined : titleId}
        aria-label={ariaLabel}
        tabIndex={-1}
        className={`absolute top-0 bottom-0 ${sideClass} w-full ${WIDTH_CLASS[width]} bg-white shadow-xl flex flex-col focus:outline-none ${className}`}
      >
        {!hideHeader && (
          <div className="px-5 py-4 border-b border-black/[0.06] flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <h2 id={titleId} className="text-base font-semibold text-[var(--color-ink)] leading-tight">
                {title}
              </h2>
              {subtitle ? (
                <p className="text-sm text-[var(--color-muted)] mt-1 truncate">{subtitle}</p>
              ) : null}
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={handleClose}
              className="-mr-1 w-10 h-10 rounded-full inline-flex items-center justify-center text-[var(--color-muted)] hover:bg-black/5 hover:text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-saffron)] focus-visible:ring-offset-2"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer ? (
          <div className="px-5 py-3 border-t border-black/[0.06] bg-white">{footer}</div>
        ) : null}
      </aside>
    </div>,
    document.body
  );
}
