import type { ValidationIssue } from "../../lib/reportProgress";

type Props = {
  issues: ValidationIssue[];
  ready: boolean;
};

export function ReportValidationPanel({ issues, ready }: Props) {
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");

  if (ready && warnings.length === 0) {
    return (
      <div
        className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        role="status"
      >
        <p className="font-semibold">Ready to submit</p>
        <p className="text-emerald-800/90 mt-0.5 text-xs">
          All required sections are complete. Review totals, then submit and lock.
        </p>
      </div>
    );
  }

  if (errors.length === 0 && warnings.length === 0 && !ready) {
    return null;
  }

  return (
    <div className="mb-4 space-y-3" role="status" aria-live="polite">
      {errors.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-semibold text-[var(--color-danger)] mb-2">
            Complete before submitting ({errors.length})
          </p>
          <ul className="space-y-1.5 text-sm text-red-900/90 list-disc list-inside">
            {errors.map((e) => (
              <li key={e.id}>{e.message}</li>
            ))}
          </ul>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900 mb-2">Review ({warnings.length})</p>
          <ul className="space-y-1.5 text-sm text-amber-900/90 list-disc list-inside">
            {warnings.map((w) => (
              <li key={w.id}>{w.message}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
