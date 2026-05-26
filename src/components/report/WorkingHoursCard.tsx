import { useMemo } from "react";
import type { WeeklyHours, WorkSchedule } from "../../types";
import { closeForDate, hoursBetween } from "../../lib/restaurantHours";

type Props = {
  /** Latest schedule for the cashier on this date (from {@code /shifts/today}). */
  schedule: WorkSchedule | null;
  /** Restaurant weekly hours so we can estimate the close time when the
   *  shift ends "until close". Optional — the card degrades gracefully. */
  weeklyHours?: WeeklyHours | null;
  /** Business date of the report (YYYY-MM-DD). Used to estimate close. */
  date: string;
  /** Manage-link rendered when the schedule is missing — admin/manager only.
   *  Pass undefined to hide it (e.g. cashier view). */
  manageHref?: string;
};

/** Money-style formatter for hours: "8.5 h", "10 h", "0 h". */
function formatHours(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 h";
  if (Number.isInteger(n)) return `${n} h`;
  return `${n.toFixed(2).replace(/\.?0+$/, "")} h`;
}

/**
 * Prominent "Working hours" tile shown above the report stepper. Surfaces
 * the schedule data we already load from {@code /shifts/today} — start
 * time, end time, total hours, shift type — in a way that's hard to miss,
 * so cashiers and managers know at a glance what shift this report
 * belongs to.
 *
 * <p>States:</p>
 * <ul>
 *   <li><b>Working shift with end time</b> — show start, end, total hours.</li>
 *   <li><b>"Until close" shift</b> — show start, estimated close from the
 *       restaurant weekly hours, and a "Closing" badge.</li>
 *   <li><b>All-day shift</b> (no times set) — show "All day" label.</li>
 *   <li><b>Not scheduled</b> — explicit "no shift on this date" callout
 *       with a link back to the calendar for admin/manager.</li>
 * </ul>
 */
export function WorkingHoursCard({
  schedule,
  weeklyHours,
  date,
  manageHref,
}: Props) {
  const computed = useMemo(() => {
    if (!schedule) {
      return {
        kind: "unknown" as const,
        primary: "—",
        secondary: "Schedule not loaded yet",
      };
    }
    if (!schedule.working) {
      return {
        kind: "off" as const,
        primary: "Not scheduled",
        secondary: "Nobody has been added to the calendar for this day yet.",
      };
    }
    if (!schedule.startTime && !schedule.endTime) {
      return {
        kind: "all-day" as const,
        primary: "All day",
        secondary: "No specific hours set on the calendar.",
      };
    }
    if (schedule.startTime && schedule.endTime) {
      const total = hoursBetween(schedule.startTime, schedule.endTime);
      return {
        kind: "ranged" as const,
        primary: `${schedule.startTime} – ${schedule.endTime}`,
        secondary: total > 0 ? `${formatHours(total)} on the clock` : undefined,
        hours: total,
      };
    }
    if (schedule.startTime && (schedule.tillClose || !schedule.endTime)) {
      const close = closeForDate(date, weeklyHours ?? null);
      const total = close ? hoursBetween(schedule.startTime, close) : 0;
      return {
        kind: "until-close" as const,
        primary: close
          ? `${schedule.startTime} – ${close}`
          : `${schedule.startTime} – close`,
        secondary: close
          ? total > 0
            ? `${formatHours(total)} until restaurant close`
            : "Until restaurant close"
          : "Until restaurant close (close time not configured)",
        hours: total,
      };
    }
    return {
      kind: "ranged" as const,
      primary: schedule.hoursLabel,
      secondary: undefined,
    };
  }, [schedule, weeklyHours, date]);

  const showCloserBadge =
    schedule?.working && (schedule.designatedCloser || schedule.closingOnly);
  const showOff = computed.kind === "off";
  const showUnknown = computed.kind === "unknown";

  return (
    <section
      aria-label="Working hours"
      data-testid="working-hours-card"
      className={`mb-4 rounded-2xl border p-4 shadow-sm ${
        showOff
          ? "border-amber-200/70 bg-gradient-to-br from-amber-50 via-white to-white"
          : showUnknown
            ? "border-black/10 bg-white"
            : "border-[var(--color-saffron)]/30 bg-gradient-to-br from-[var(--color-cream)]/60 via-white to-white"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-saffron-dark)] flex items-center gap-1.5">
            <span aria-hidden>⏱</span> Working hours
          </p>

          <div className="mt-1.5 flex items-baseline flex-wrap gap-x-3 gap-y-1">
            <h3
              className={`text-2xl md:text-[28px] font-bold tracking-tight tabular-nums ${
                showOff ? "text-amber-900" : "text-[var(--color-ink)]"
              }`}
            >
              {computed.primary}
            </h3>
            {showCloserBadge && (
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full bg-[var(--color-saffron)] text-white">
                Closing shift
              </span>
            )}
          </div>

          {computed.secondary && (
            <p
              className={`text-sm mt-1 ${
                showOff ? "text-amber-900" : "text-[var(--color-muted)]"
              }`}
            >
              {computed.secondary}
            </p>
          )}

          {showOff && manageHref && (
            <a
              href={manageHref}
              className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-[var(--color-saffron-dark)] hover:underline"
            >
              <span aria-hidden>→</span> Open calendar to assign this shift
            </a>
          )}
        </div>

        {schedule?.working && schedule.startTime && (
          <div className="text-right text-[11px] text-[var(--color-muted)] shrink-0">
            <div className="font-semibold uppercase tracking-wider text-[var(--color-saffron-dark)]">
              {schedule.shiftType === "CLOSING" || schedule.closingOnly
                ? "CLOSING"
                : "FULL"}
            </div>
            {schedule.name && (
              <div className="mt-0.5 text-[var(--color-ink)] font-medium">
                {schedule.name}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
