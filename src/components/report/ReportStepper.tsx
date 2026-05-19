import type { ReportStep } from "../../lib/reportProgress";

export function ReportStepper({ steps }: { steps: ReportStep[] }) {
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between text-xs text-[var(--color-muted)] mb-2">
        <span>Report progress</span>
        <span className="font-medium tabular-nums">
          {doneCount}/{steps.length}
        </span>
      </div>
      <ol className="flex gap-1">
        {steps.map((step) => (
          <li key={step.id} className="flex-1 min-w-0">
            <div
              className={`h-1.5 rounded-full transition-colors ${
                step.done ? "bg-[var(--color-success)]" : "bg-black/10"
              }`}
              title={step.label}
            />
            <p
              className={`mt-1.5 text-[10px] font-medium truncate text-center ${
                step.done ? "text-[var(--color-success)]" : "text-[var(--color-muted)]"
              }`}
              title={step.hint}
            >
              {step.label}
            </p>
            {!step.done && step.hint && (
              <p className="text-[9px] text-[var(--color-danger)] truncate text-center mt-0.5 px-0.5">
                {step.hint}
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
