import type { ReportStep } from "../../lib/reportProgress";
import { scrollToReportSection } from "../../lib/reportScroll";

type Props = {
  steps: ReportStep[];
};

export function ReportStepper({ steps }: Props) {
  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;

  return (
    <div className="mb-4 rounded-2xl border border-black/[0.06] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between text-xs text-[var(--color-muted)] mb-3">
        <span className="font-semibold text-[var(--color-ink)]">Progress</span>
        <span className={`font-medium tabular-nums ${allDone ? "text-[var(--color-success)]" : ""}`}>
          {doneCount}/{steps.length}
        </span>
      </div>
      <ol className="flex gap-2 sm:gap-3">
        {steps.map((step) => (
          <li key={step.id} className="flex-1 min-w-0">
            <button
              type="button"
              onClick={() => scrollToReportSection(step.id)}
              className="w-full group text-left"
              title={step.hint ? `${step.label}: ${step.hint}` : `Go to ${step.label}`}
            >
              <div
                className={`h-2 rounded-full transition-colors ${
                  step.done ? "bg-[var(--color-success)]" : "bg-black/10 group-hover:bg-[var(--color-saffron)]/30"
                }`}
              />
              <p
                className={`mt-2 text-[11px] sm:text-xs font-semibold truncate ${
                  step.done ? "text-[var(--color-success)]" : "text-[var(--color-muted)] group-hover:text-[var(--color-ink)]"
                }`}
              >
                {step.done ? "✓ " : ""}
                {step.label}
              </p>
              {!step.done && step.hint && (
                <p className="text-[10px] text-[var(--color-danger)] truncate mt-0.5 hidden sm:block">
                  {step.hint}
                </p>
              )}
            </button>
          </li>
        ))}
      </ol>
      <p className="text-[11px] text-[var(--color-muted)] mt-3 sm:hidden">
        Tap a step to jump to that section
      </p>
    </div>
  );
}