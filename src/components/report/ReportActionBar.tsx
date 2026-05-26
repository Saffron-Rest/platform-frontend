import { fmt } from "../../lib/calc";
import { Button } from "../ui/Button";

type Props = {
  saving: boolean;
  isNew: boolean;
  canSubmit: boolean;
  difference: number;
  onSave: () => void;
  onSubmit: () => void;
  showSubmit?: boolean;
  secondaryAction?: { label: string; onClick: () => void };
  onUnlock?: () => void;
  unlockLabel?: string;
};

/**
 * Sticky bottom action bar for the report editor.
 *
 * <p>Designed so the cashier's <em>primary</em> action is one big button
 * that morphs between <strong>Save draft</strong> and
 * <strong>Submit &amp; lock</strong> based on readiness:</p>
 * <ul>
 *   <li>While the report is incomplete, the only big button is "Save
 *       draft" — a tired cashier can hit it with a thumb without
 *       accidentally locking anything.</li>
 *   <li>Once the validation gate is green, the primary morphs to
 *       "Submit &amp; lock" and "Save draft instead" appears as a
 *       subtle underlined link below. Submit becomes deliberate.</li>
 *   <li>Admin-only actions (Unlock, save photos on a locked report)
 *       sit as secondary buttons above the primary.</li>
 * </ul>
 *
 * <p>On tablet/desktop the bar is inline (not sticky) at the end of the
 * page, keeping the affordance close to the form context.</p>
 */
export function ReportActionBar({
  saving,
  isNew,
  canSubmit,
  difference,
  onSave,
  onSubmit,
  showSubmit = true,
  secondaryAction,
  onUnlock,
  unlockLabel = "Unlock for cashier",
}: Props) {
  const short = difference < -0.01;
  const over = difference > 0.01;
  const balanced = !short && !over;
  const submitMode = showSubmit && canSubmit;

  return (
    <div className="action-bar md:static md:mt-6" data-tour="tour-entry-actions">
      <div className="bg-white/95 md:bg-transparent backdrop-blur-md md:backdrop-blur-none rounded-2xl md:rounded-none border border-black/5 md:border-0 p-3 md:p-0 shadow-lg md:shadow-none flex flex-col gap-2">
        {/* Drawer difference badge (mobile only — desktop sees the summary bar above). */}
        <div
          className={`md:hidden flex items-center justify-between gap-3 px-1 pb-1 text-sm ${
            short
              ? "text-[var(--color-danger)]"
              : over
                ? "text-[var(--color-success)]"
                : "text-[var(--color-muted)]"
          }`}
        >
          <span className="font-medium text-[var(--color-ink)]">Drawer difference</span>
          <span className="font-bold tabular-nums text-base">
            {fmt(difference)}
            {balanced && Math.abs(difference) <= 0.01 && (
              <span className="ml-1.5 text-xs font-semibold text-[var(--color-success)]">OK</span>
            )}
          </span>
        </div>

        {/* Admin-only escape hatches sit above the primary action so they
            never get confused with the cashier's main button. */}
        {onUnlock && (
          <Button
            variant="secondary"
            fullWidth
            onClick={onUnlock}
            disabled={saving}
            className="py-3.5 text-base"
          >
            {saving ? "Unlocking…" : unlockLabel}
          </Button>
        )}
        {secondaryAction && (
          <Button
            variant="secondary"
            fullWidth
            onClick={secondaryAction.onClick}
            disabled={saving}
            className="py-3.5 text-base"
          >
            {saving ? "Saving…" : secondaryAction.label}
          </Button>
        )}

        {/* Primary action — single button that morphs Save↔Submit. */}
        <Button
          fullWidth
          onClick={submitMode ? onSubmit : onSave}
          disabled={saving}
          className="py-4 text-base"
        >
          {saving
            ? submitMode
              ? "Submitting…"
              : "Saving…"
            : submitMode
              ? "Submit & lock"
              : isNew
                ? "Save draft"
                : "Save changes"}
        </Button>

        {/* Once submit is the primary, expose Save as a subtle link only,
            so a tired thumb doesn't lock the report by accident. */}
        {submitMode && showSubmit && !saving && (
          <button
            type="button"
            onClick={onSave}
            className="self-center text-[13px] font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)] underline-offset-4 hover:underline px-3 py-1.5"
          >
            Save draft instead
          </button>
        )}

        {/* Helpful hint when submit is blocked. */}
        {showSubmit && !canSubmit && !saving && (
          <p className="text-center text-xs text-[var(--color-muted)] md:hidden">
            Complete required sections above to submit
          </p>
        )}
      </div>
    </div>
  );
}
