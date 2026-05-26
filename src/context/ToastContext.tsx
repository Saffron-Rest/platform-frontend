import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ToastVariant = "success" | "error" | "info" | "warning";

export type ToastAction = {
  label: string;
  /** Called when the user clicks the action. The toast is dismissed
   *  automatically afterwards. */
  onClick: () => void;
};

export type Toast = {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  action?: ToastAction;
  /** Auto-dismiss after this many ms. Use 0 to make the toast sticky. */
  duration: number;
};

export type ToastInput = Omit<Toast, "id" | "duration" | "variant"> & {
  variant?: ToastVariant;
  duration?: number;
};

type ToastContextValue = {
  toasts: Toast[];
  /**
   * Show a toast. Returns the id so callers can dismiss it manually,
   * e.g. when an async operation completes.
   */
  show: (input: ToastInput) => string;
  success: (title: string, opts?: Omit<ToastInput, "title" | "variant">) => string;
  error: (title: string, opts?: Omit<ToastInput, "title" | "variant">) => string;
  info: (title: string, opts?: Omit<ToastInput, "title" | "variant">) => string;
  warning: (title: string, opts?: Omit<ToastInput, "title" | "variant">) => string;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION_MS: Record<ToastVariant, number> = {
  success: 4000,
  info: 4000,
  warning: 6000,
  // Errors stay longer because they usually carry actionable info.
  error: 7000,
};

/**
 * Global toast notification provider.
 *
 * <p>Toasts pop up in the bottom-right (or bottom-center on mobile) and
 * auto-dismiss after a few seconds. They support an optional one-click
 * action which is perfect for "Undo" patterns on destructive operations.
 *
 * <p>Usage:
 * <pre>
 * const toast = useToast();
 * toast.success("Saved", { description: "Schedule updated." });
 * toast.error("Failed to save");
 * </pre>
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Track timers so we can clear them on manual dismiss (otherwise the
  // same id could fire dismiss twice if the user clicks ✕ before timeout).
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const handle = timers.current.get(id);
    if (handle) {
      clearTimeout(handle);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (input: ToastInput): string => {
      const variant: ToastVariant = input.variant ?? "info";
      const id =
        // Prefer the platform's UUID when available (browsers + jsdom).
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const duration =
        input.duration === undefined ? DEFAULT_DURATION_MS[variant] : input.duration;
      const toast: Toast = {
        id,
        variant,
        title: input.title,
        description: input.description,
        action: input.action,
        duration,
      };
      setToasts((prev) => [...prev, toast]);
      if (duration > 0) {
        const handle = setTimeout(() => dismiss(id), duration);
        timers.current.set(id, handle);
      }
      return id;
    },
    [dismiss]
  );

  // Drop timers on unmount so we don't leak in fast-refresh / unmount paths.
  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((h) => clearTimeout(h));
      map.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      toasts,
      show,
      success: (title, opts) => show({ title, variant: "success", ...opts }),
      error: (title, opts) => show({ title, variant: "error", ...opts }),
      info: (title, opts) => show({ title, variant: "info", ...opts }),
      warning: (title, opts) => show({ title, variant: "warning", ...opts }),
      dismiss,
    }),
    [toasts, show, dismiss]
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

/**
 * Subscribe to the toast API. Throws a helpful error when called outside
 * of a {@link ToastProvider} so test failures point at the missing setup.
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return ctx;
}
