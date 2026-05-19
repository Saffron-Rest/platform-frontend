import { useState, type ReactNode } from "react";

type Props = {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  accent?: boolean;
  children: ReactNode;
};

export function CollapsibleSection({
  title,
  summary,
  defaultOpen = true,
  accent,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section
      className={`rounded-2xl border mb-4 overflow-hidden ${
        accent
          ? "bg-[var(--color-ink)] text-white border-transparent"
          : "bg-white border-black/5 shadow-sm"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left ${
          accent ? "hover:bg-white/5" : "hover:bg-[var(--color-cream)]/80"
        }`}
        aria-expanded={open}
      >
        <div className="min-w-0">
          <h3
            className={`font-semibold text-base ${
              accent ? "text-white" : "text-[var(--color-saffron-dark)]"
            }`}
          >
            {title}
          </h3>
          {summary && !open && (
            <p className={`text-sm mt-0.5 truncate ${accent ? "text-white/70" : "text-[var(--color-muted)]"}`}>
              {summary}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-lg leading-none ${
            accent ? "bg-white/10 text-white" : "bg-[var(--color-cream)] text-[var(--color-muted)]"
          }`}
          aria-hidden
        >
          {open ? "−" : "+"}
        </span>
      </button>
      {open && (
        <div className={`px-4 pb-4 ${accent ? "" : "border-t border-black/5 pt-1"}`}>
          <div className="grid gap-3 sm:grid-cols-2 pt-2">{children}</div>
        </div>
      )}
    </section>
  );
}
