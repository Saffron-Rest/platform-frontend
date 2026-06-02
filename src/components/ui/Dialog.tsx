import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useDialogChrome } from "../../lib/useDialogChrome";

/**
 * Dialog size scale. {@code md} is the default for create/edit forms;
 * {@code wide} fits two-column layouts (recipe editor, owner expense
 * detail); {@code full} fills the viewport on small screens.
 */
export type DialogSize = "sm" | "md" | "lg" | "xl" | "full";

const SIZE_CLASS: Record<DialogSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  full: "max-w-[min(64rem,100vw-2rem)]",
};

type DialogContextValue = {
  /** Generated id used to wire {@code aria-labelledby} on the dialog
   *  root to the {@link DialogTitle} text inside. */
  titleId: string;
  /** Generated id used to wire {@code aria-describedby} when a body
   *  description is provided via {@link DialogDescription}. */
  descriptionId: string;
  close: () => void;
};

const DialogContext = createContext<DialogContextValue | null>(null);

function useDialogContext(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error("Dialog subcomponent used outside <Dialog>");
  }
  return ctx;
}

type DialogProps = {
  open: boolean;
  /** Required: called when the user requests to close (ESC, backdrop,
   *  the close affordance, or the explicit Cancel button). The caller
   *  decides whether to actually close — useful for dirty-check guards. */
  onClose: () => void;
  /** When {@code true}, ESC and backdrop click trigger a "Discard
   *  changes?" confirmation. Defaults to {@code false}. The confirmation
   *  message can be customised via {@link dirtyMessage}. */
  dirty?: boolean;
  dirtyMessage?: string;
  /** Disables ESC dismissal entirely (e.g. for blocking confirms). */
  dismissOnEsc?: boolean;
  /** Disables backdrop-click dismissal entirely. Defaults to {@code true}
   *  for forms (because mis-tap on tablet shouldn't lose data) but
   *  {@code false} for read-only previews — pass explicitly. */
  dismissOnBackdrop?: boolean;
  size?: DialogSize;
  /** When {@code true}, the dialog slides up from the bottom on mobile
   *  (the iOS bottom-sheet pattern) and centers on desktop. */
  bottomSheetOnMobile?: boolean;
  /** Optional accessible label when no {@link DialogTitle} is rendered. */
  ariaLabel?: string;
  className?: string;
  children: ReactNode;
};

/**
 * Modal dialog primitive. Replaces the ~6 ad-hoc DialogShell/Modal
 * implementations across admin pages. Provides:
 * <ul>
 *   <li>Focus trap + focus restoration on close.</li>
 *   <li>ESC + (optional) backdrop dismissal, with dirty-state guard.</li>
 *   <li>Body scroll lock.</li>
 *   <li>{@code role="dialog"}, {@code aria-modal}, {@code aria-labelledby}.</li>
 *   <li>Mobile bottom-sheet variant.</li>
 *   <li>{@code prefers-reduced-motion}-aware fade+scale entry.</li>
 * </ul>
 *
 * <p>Compose with {@link DialogTitle}, {@link DialogBody}, {@link DialogFooter}.</p>
 */
export function Dialog({
  open,
  onClose,
  dirty = false,
  dirtyMessage = "Discard your changes?",
  dismissOnEsc = true,
  dismissOnBackdrop = true,
  size = "md",
  bottomSheetOnMobile = true,
  ariaLabel,
  className = "",
  children,
}: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();

  const requestClose = useCallback(() => {
    if (dirty && !window.confirm(dirtyMessage)) return;
    onClose();
  }, [dirty, dirtyMessage, onClose]);

  const containerRef = useDialogChrome({
    open,
    onEsc: dismissOnEsc ? requestClose : undefined,
  });

  const ctx = useMemo<DialogContextValue>(
    () => ({ titleId, descriptionId, close: onClose }),
    [titleId, descriptionId, onClose]
  );

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const layoutClass = bottomSheetOnMobile
    ? "items-end md:items-center"
    : "items-center";
  const panelMobileClass = bottomSheetOnMobile
    ? "rounded-t-2xl rounded-b-none md:rounded-2xl"
    : "rounded-2xl";

  return createPortal(
    <DialogContext.Provider value={ctx}>
      <div
        aria-hidden={false}
        className={`fixed inset-0 z-[var(--z-modal,50)] flex justify-center ${layoutClass} dialog-anim-backdrop`}
      >
        <button
          type="button"
          aria-label="Close dialog"
          onClick={dismissOnBackdrop ? requestClose : undefined}
          tabIndex={-1}
          className={`absolute inset-0 bg-black/40 ${dismissOnBackdrop ? "cursor-pointer" : "cursor-default"}`}
        />
        <div
          ref={containerRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={ariaLabel ? undefined : titleId}
          aria-label={ariaLabel}
          tabIndex={-1}
          className={`relative w-full ${SIZE_CLASS[size]} ${panelMobileClass} bg-white shadow-xl dialog-anim-panel max-h-[90vh] flex flex-col focus:outline-none ${className}`}
        >
          {children}
        </div>
      </div>
    </DialogContext.Provider>,
    document.body
  );
}

/**
 * Sticky dialog title bar. Renders an {@code <h2>} wired to
 * {@code aria-labelledby} on the dialog root and a 44pt close button.
 */
export function DialogTitle({
  children,
  description,
  hideClose,
}: {
  children: ReactNode;
  description?: ReactNode;
  hideClose?: boolean;
}) {
  const { titleId, descriptionId, close } = useDialogContext();
  return (
    <div className="sticky top-0 z-10 bg-white px-5 py-4 border-b border-black/[0.06] flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <h2 id={titleId} className="text-base font-semibold text-[var(--color-ink)] leading-tight">
          {children}
        </h2>
        {description ? (
          <p id={descriptionId} className="text-sm text-[var(--color-muted)] mt-1">
            {description}
          </p>
        ) : null}
      </div>
      {!hideClose && (
        <button
          type="button"
          aria-label="Close"
          onClick={close}
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
      )}
    </div>
  );
}

/**
 * Scrollable dialog body. Caps to the dialog's max height so the title
 * and footer stay sticky.
 */
export function DialogBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`px-5 py-4 overflow-y-auto flex-1 min-h-0 ${className}`}>
      {children}
    </div>
  );
}

/**
 * Sticky dialog footer. Right-aligns by default; pass {@code justify}
 * to override (e.g. for destructive-on-left layouts).
 */
export function DialogFooter({
  children,
  className = "",
  justify = "end",
}: {
  children: ReactNode;
  className?: string;
  justify?: "start" | "end" | "between";
}) {
  const justifyClass =
    justify === "start"
      ? "justify-start"
      : justify === "between"
      ? "justify-between"
      : "justify-end";
  return (
    <div
      className={`sticky bottom-0 bg-white px-5 py-3 border-t border-black/[0.06] flex items-center gap-2 ${justifyClass} ${className}`}
    >
      {children}
    </div>
  );
}

type DialogFormProps = Omit<DialogProps, "children"> & {
  /** Submit handler. Receives the native form event. Default behaviour
   *  prevents reload — caller just performs the side-effect. */
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
  /** Form id, useful when the submit button lives outside the form
   *  (e.g. in a sticky footer that can't be a descendant). */
  formId?: string;
};

/**
 * Dialog whose body is a {@code <form>}. Wires Enter-to-submit to the
 * primary action without per-page boilerplate, and lets the submit
 * button live in a sticky {@link DialogFooter} via the {@code form} attr.
 */
export function DialogForm({ onSubmit, children, formId, ...props }: DialogFormProps) {
  const handleSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      onSubmit(e);
    },
    [onSubmit]
  );
  return (
    <Dialog {...props}>
      <form id={formId} onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
        {children}
      </form>
    </Dialog>
  );
}

/**
 * Hook helper: tracks whether a dialog body has unsaved edits. Wire the
 * returned {@code markDirty} into your form's onChange and pass the
 * boolean to {@code <Dialog dirty>}. Resets when {@code open} flips.
 */
export function useDialogDirty(open: boolean) {
  const [dirty, setDirty] = useState(false);
  if (!open && dirty) {
    // Reset lazily on close so the next opening starts clean.
    queueMicrotask(() => setDirty(false));
  }
  return { dirty, markDirty: () => setDirty(true), reset: () => setDirty(false) };
}
