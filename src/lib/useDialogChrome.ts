import { useEffect, useRef } from "react";

/**
 * Tags inside a tree that should be considered focusable for trap purposes.
 * Mirrors the standard list used by libraries like focus-trap, kept small
 * and synchronous so we don't pull a dep just for a modal.
 */
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "[contenteditable='true']",
].join(",");

function getFocusable(root: HTMLElement): HTMLElement[] {
  const els = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  return els.filter(
    (el) => !el.hasAttribute("disabled") && el.offsetParent !== null
  );
}

type Options = {
  open: boolean;
  /** Called when ESC is pressed. The component decides whether to close. */
  onEsc?: () => void;
  /** Disable Tab cycling. Use with care — only for nested portals where
   *  another wrapper already traps focus. */
  trapFocus?: boolean;
  /** Initial element to focus when the dialog opens. Defaults to the first
   *  focusable child, falling back to the dialog root. */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  /** Lock body scroll while open. Defaults to {@code true}. */
  lockScroll?: boolean;
};

/**
 * Centralized chrome for modal-like surfaces (dialogs, drawers, sheets,
 * confirms, command palettes). Handles:
 * <ul>
 *   <li>ESC to dismiss (delegates the close decision back to caller).</li>
 *   <li>Body scroll lock while open.</li>
 *   <li>Focus restoration to the previously-focused element on close.</li>
 *   <li>Auto-focus on open.</li>
 *   <li>Tab/Shift+Tab focus trap inside the surface.</li>
 * </ul>
 *
 * <p>Returns a ref to attach to the dialog root container.</p>
 */
export function useDialogChrome({
  open,
  onEsc,
  trapFocus = true,
  initialFocusRef,
  lockScroll = true,
}: Options) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current =
      (document.activeElement as HTMLElement | null) ?? null;

    const container = containerRef.current;
    if (container) {
      const focusOn =
        initialFocusRef?.current ?? getFocusable(container)[0] ?? container;
      const t = window.setTimeout(() => focusOn.focus({ preventScroll: true }), 0);
      return () => window.clearTimeout(t);
    }
  }, [open, initialFocusRef]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (onEsc) {
          e.stopPropagation();
          onEsc();
        }
        return;
      }
      if (!trapFocus) return;
      if (e.key !== "Tab") return;
      const container = containerRef.current;
      if (!container) return;
      const focusable = getFocusable(container);
      if (focusable.length === 0) {
        e.preventDefault();
        container.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !container.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKey, true);
    return () => document.removeEventListener("keydown", handleKey, true);
  }, [open, onEsc, trapFocus]);

  useEffect(() => {
    if (!open || !lockScroll) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, lockScroll]);

  useEffect(() => {
    if (open) return;
    const prev = previouslyFocused.current;
    if (prev && typeof prev.focus === "function" && document.contains(prev)) {
      prev.focus({ preventScroll: true });
    }
  }, [open]);

  return containerRef;
}
