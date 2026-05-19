import type { User } from "../../types";
import { formatReportDateLong, reportDateRelativeLabel } from "../../lib/reportDates";
import { shiftIsoDate } from "../../lib/shiftDate";
import { Badge, entryStatusBadge } from "../ui/Badge";

type Props = {
  date: string;
  maxDate?: string;
  onDateChange?: (date: string) => void;
  cashierId?: string;
  cashierName?: string;
  cashiers?: User[];
  onCashierChange?: (id: string) => void;
  status?: string;
  shiftLabel?: string | null;
  adminPicker?: boolean;
};

export function ReportContextBanner({
  date,
  maxDate,
  onDateChange,
  cashierId,
  cashierName,
  cashiers,
  onCashierChange,
  status,
  shiftLabel,
  adminPicker,
}: Props) {
  const relative = reportDateRelativeLabel(date);
  const statusUpper = status?.toUpperCase();
  const showStatus = statusUpper && statusUpper !== "NEW";
  const canGoNext = !maxDate || date < maxDate;
  const canGoPrev = true;

  return (
    <div
      className="mb-4 rounded-2xl border border-[var(--color-saffron)]/30 bg-gradient-to-br from-[var(--color-saffron)]/12 via-white to-white p-4 shadow-sm"
      role="region"
      aria-label="Report context"
    >
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-saffron-dark)] mb-1">
        {adminPicker ? "Create or edit report for" : "You are editing"}
      </p>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xl md:text-2xl font-bold text-[var(--color-ink)] leading-tight">
            {formatReportDateLong(date)}
          </h3>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--color-saffron)]/20 text-[var(--color-saffron-dark)]">
              {relative}
            </span>
            {cashierName && (
              <span className="text-sm font-medium text-[var(--color-ink)]">{cashierName}</span>
            )}
            {showStatus && (
              <Badge variant={entryStatusBadge(status!)}>{statusUpper}</Badge>
            )}
            {!showStatus && statusUpper === "NEW" && (
              <Badge variant="draft">New report</Badge>
            )}
          </div>
          {shiftLabel && (
            <p className="text-sm text-[var(--color-muted)] mt-2">
              Schedule: <strong className="text-[var(--color-ink)]">{shiftLabel}</strong>
            </p>
          )}
        </div>
      </div>

      {adminPicker && onDateChange && onCashierChange && cashiers && (
        <div className="grid gap-3 sm:grid-cols-2 mt-4 pt-4 border-t border-[var(--color-saffron)]/20">
          <label className="field-label">
            Cashier
            <select
              value={cashierId ?? ""}
              onChange={(e) => onCashierChange(e.target.value)}
              className="field-input bg-white"
            >
              <option value="">Select cashier…</option>
              {cashiers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Business date
            <div className="flex gap-2 mt-1.5">
              <button
                type="button"
                disabled={!canGoPrev}
                onClick={() => onDateChange(shiftIsoDate(date, -1))}
                className="shrink-0 px-3 py-3 rounded-xl border border-black/10 bg-white text-lg font-medium hover:bg-[var(--color-cream)] disabled:opacity-40"
                aria-label="Previous day"
              >
                ←
              </button>
              <input
                type="date"
                value={date}
                max={maxDate}
                onChange={(e) => onDateChange(e.target.value)}
                className="field-input bg-white flex-1 !mt-0 min-w-0"
              />
              <button
                type="button"
                disabled={!canGoNext}
                onClick={() => onDateChange(shiftIsoDate(date, 1))}
                className="shrink-0 px-3 py-3 rounded-xl border border-black/10 bg-white text-lg font-medium hover:bg-[var(--color-cream)] disabled:opacity-40"
                aria-label="Next day"
              >
                →
              </button>
            </div>
          </label>
        </div>
      )}

      {!cashierId && adminPicker && (
        <p className="text-sm text-[var(--color-muted)] mt-3">
          Select a cashier and date above. The form below applies only to that person and day.
        </p>
      )}
    </div>
  );
}
