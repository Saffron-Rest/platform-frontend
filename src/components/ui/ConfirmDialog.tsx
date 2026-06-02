import type { ReactNode } from "react";
import { Dialog, DialogBody, DialogFooter, DialogTitle } from "./Dialog";
import { Button } from "./Button";

export type ConfirmTone = "neutral" | "danger";

type ConfirmDialogProps = {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  /** Slot rendered between the description and the action row. Useful
   *  for a checkbox like "Also delete linked items" or a small textarea. */
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  /** Disable the confirm button (e.g. while a precondition isn't met). */
  confirmDisabled?: boolean;
  /** Render the confirm button in its loading state. */
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Branded replacement for {@code window.confirm()}. Prefer accessing it
 * through {@link useConfirm} so call sites stay one-liners; this
 * component is exported for cases where the host needs full control
 * (e.g. a non-modal embed in a stepper).
 */
export function ConfirmDialog({
  open,
  title,
  description,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "neutral",
  confirmDisabled,
  loading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      size="sm"
      dismissOnBackdrop
      bottomSheetOnMobile
      ariaLabel={typeof title === "string" ? title : "Confirm"}
    >
      <DialogTitle hideClose description={description}>
        {title}
      </DialogTitle>
      {children ? <DialogBody>{children}</DialogBody> : null}
      <DialogFooter>
        <Button variant="ghost" onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant={tone === "danger" ? "primary" : "primary"}
          onClick={onConfirm}
          disabled={confirmDisabled || loading}
          loading={loading}
          className={
            tone === "danger"
              ? "!bg-[var(--color-danger)] hover:!bg-[#7c1c1f] !shadow-[var(--color-danger)]/20"
              : ""
          }
          autoFocus
        >
          {confirmLabel}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
