import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
};

export function FinanceAddPanel({ title, subtitle, onClose, children }: Props) {
  return (
    <div
      id="finance-add-panel"
      className="rounded-2xl border-2 border-[var(--color-saffron)]/40 bg-[var(--color-saffron)]/8 p-4 sm:p-5 shadow-sm scroll-mt-24"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold text-lg text-[var(--color-ink)]">{title}</h3>
          {subtitle && <p className="text-sm text-[var(--color-muted)] mt-1 leading-relaxed">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-[var(--color-muted)] hover:bg-black/5"
          aria-label="Close"
        >
          Close
        </button>
      </div>
      {children}
    </div>
  );
}
