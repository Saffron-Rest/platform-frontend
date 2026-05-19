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

  return (
    <div className="action-bar md:static md:mt-6">
      <div className="bg-white/95 md:bg-transparent backdrop-blur-md md:backdrop-blur-none rounded-2xl md:rounded-none border border-black/5 md:border-0 p-3 md:p-0 shadow-lg md:shadow-none flex flex-col gap-2">
        <div
          className={`md:hidden flex items-center justify-between gap-3 px-1 pb-1 text-sm ${
            short ? "text-[var(--color-danger)]" : over ? "text-[var(--color-success)]" : "text-[var(--color-muted)]"
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
        <Button variant="secondary" fullWidth onClick={onSave} disabled={saving} className="py-3.5 text-base">
          {saving ? "Saving…" : isNew ? "Save draft" : "Save changes"}
        </Button>
        {showSubmit && (
          <>
            <Button fullWidth onClick={onSubmit} disabled={saving || !canSubmit} className="py-3.5 text-base">
              {saving ? "Submitting…" : "Submit & lock"}
            </Button>
            {!canSubmit && (
              <p className="text-center text-xs text-[var(--color-muted)] md:hidden">
                Complete required sections above to submit
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
