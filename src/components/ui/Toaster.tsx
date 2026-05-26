import { useEffect, useState } from "react";
import { useToast, type Toast } from "../../context/ToastContext";

const variantStyles: Record<Toast["variant"], { bar: string; iconBg: string; icon: string }> = {
  success: {
    bar: "bg-emerald-500",
    iconBg: "bg-emerald-50 text-emerald-600",
    icon: "M5 13l4 4L19 7",
  },
  error: {
    bar: "bg-red-500",
    iconBg: "bg-red-50 text-red-600",
    icon: "M6 18L18 6M6 6l12 12",
  },
  info: {
    bar: "bg-[var(--color-saffron)]",
    iconBg: "bg-[var(--color-saffron-light)] text-[var(--color-saffron-dark)]",
    icon: "M13 16h-1v-4h-1m1-4h.01",
  },
  warning: {
    bar: "bg-amber-500",
    iconBg: "bg-amber-50 text-amber-600",
    icon: "M12 9v3m0 4h.01",
  },
};

/**
 * Renders the active toast stack in the bottom-right (desktop) or bottom-
 * center (mobile). Mount once at the app root.
 */
export function Toaster() {
  const { toasts, dismiss } = useToast();
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex flex-col items-stretch md:items-end gap-2 p-4 md:p-6"
    >
      <div className="flex flex-col gap-2 w-full md:w-auto md:max-w-sm md:ml-auto">
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  // Slide+fade in on mount and out on dismiss. We track our own "leaving"
  // state to play the exit animation before the parent unmounts the row.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const v = variantStyles[toast.variant];

  return (
    <div
      role={toast.variant === "error" ? "alert" : "status"}
      className={`pointer-events-auto bg-white rounded-xl shadow-lg border border-black/[0.06] overflow-hidden flex items-stretch transition-all duration-200 ${
        entered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      }`}
    >
      <div className={`w-1 ${v.bar}`} aria-hidden />
      <div className="flex-1 flex items-start gap-3 px-3 py-3">
        <div
          className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${v.iconBg}`}
          aria-hidden
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            viewBox="0 0 24 24"
          >
            <path d={v.icon} />
          </svg>
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <p className="text-sm font-semibold text-[var(--color-ink)]">{toast.title}</p>
          {toast.description && (
            <p className="text-xs text-[var(--color-muted)] mt-0.5 leading-relaxed">
              {toast.description}
            </p>
          )}
          {toast.action && (
            <button
              type="button"
              onClick={() => {
                toast.action!.onClick();
                onDismiss();
              }}
              className="mt-2 text-xs font-semibold text-[var(--color-saffron-dark)] hover:underline"
            >
              {toast.action.label}
            </button>
          )}
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="shrink-0 text-[var(--color-muted)] hover:text-[var(--color-ink)] -mt-1 -mr-1 p-1 text-lg leading-none"
        >
          ×
        </button>
      </div>
    </div>
  );
}
