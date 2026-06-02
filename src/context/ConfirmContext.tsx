import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ConfirmDialog, type ConfirmTone } from "../components/ui/ConfirmDialog";
import { Dialog, DialogBody, DialogFooter, DialogTitle } from "../components/ui/Dialog";
import { Button } from "../components/ui/Button";

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
};

export type PromptOptions = {
  title: string;
  description?: string;
  /** Initial value pre-filled in the input. */
  defaultValue?: string;
  placeholder?: string;
  /** Confirm button label. Defaults to "OK". */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Validation: return a non-empty string to surface as an inline error,
   *  or {@code null} when the value is valid. */
  validate?: (value: string) => string | null;
  /** Render a {@code <textarea>} instead of a single-line input. */
  multiline?: boolean;
  /** HTML input type. Defaults to {@code "text"}. */
  inputType?: "text" | "date" | "number";
  /** Required minimum length. Empty/whitespace strings are always rejected
   *  unless {@code minLength === 0}. */
  minLength?: number;
};

type ConfirmContextValue = {
  /**
   * Show a branded confirm dialog. Resolves to {@code true} when the user
   * confirms, {@code false} when they cancel (including via ESC or
   * backdrop click).
   */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /**
   * Show a branded prompt dialog. Resolves to the typed string on
   * confirmation, or {@code null} on cancel.
   */
  prompt: (options: PromptOptions) => Promise<string | null>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

type ConfirmState = {
  kind: "confirm";
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
};

type PromptState = {
  kind: "prompt";
  options: PromptOptions;
  value: string;
  error: string | null;
  resolve: (value: string | null) => void;
};

type DialogState = ConfirmState | PromptState | null;

/**
 * Mounts at the app root (above the routes, below the providers). Renders
 * a single confirm/prompt surface on demand so async UX flows can do:
 *
 * <pre>
 * if (!(await confirm({ title: "Cancel this expense?" }))) return;
 * </pre>
 *
 * Replaces the ~33 native {@code window.confirm/prompt/alert} call sites
 * with a branded, accessible, theme-aware dialog.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DialogState>(null);
  const stateRef = useRef<DialogState>(null);
  stateRef.current = state;

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setState({ kind: "confirm", options, resolve });
    });
  }, []);

  const prompt = useCallback((options: PromptOptions): Promise<string | null> => {
    return new Promise<string | null>((resolve) => {
      setState({
        kind: "prompt",
        options,
        value: options.defaultValue ?? "",
        error: null,
        resolve,
      });
    });
  }, []);

  const close = useCallback(() => setState(null), []);

  const handleConfirmYes = useCallback(() => {
    const cur = stateRef.current;
    if (cur?.kind === "confirm") {
      cur.resolve(true);
      close();
    }
  }, [close]);

  const handleConfirmNo = useCallback(() => {
    const cur = stateRef.current;
    if (cur?.kind === "confirm") {
      cur.resolve(false);
      close();
    }
  }, [close]);

  const validatePrompt = useCallback((s: PromptState): string | null => {
    const trimmed = s.value.trim();
    const minLen = s.options.minLength;
    if (minLen === undefined || minLen > 0) {
      const required = minLen ?? 1;
      if (trimmed.length < required) {
        return required === 1
          ? "Please enter a value."
          : `Please enter at least ${required} characters.`;
      }
    }
    if (s.options.validate) {
      const r = s.options.validate(s.value);
      if (r) return r;
    }
    return null;
  }, []);

  const handlePromptOk = useCallback(() => {
    const cur = stateRef.current;
    if (cur?.kind !== "prompt") return;
    const err = validatePrompt(cur);
    if (err) {
      setState({ ...cur, error: err });
      return;
    }
    cur.resolve(cur.value);
    close();
  }, [close, validatePrompt]);

  const handlePromptCancel = useCallback(() => {
    const cur = stateRef.current;
    if (cur?.kind === "prompt") {
      cur.resolve(null);
      close();
    }
  }, [close]);

  const value = useMemo<ConfirmContextValue>(
    () => ({ confirm, prompt }),
    [confirm, prompt]
  );

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {state?.kind === "confirm" ? (
        <ConfirmDialog
          open
          title={state.options.title}
          description={state.options.description}
          confirmLabel={state.options.confirmLabel}
          cancelLabel={state.options.cancelLabel}
          tone={state.options.tone}
          onConfirm={handleConfirmYes}
          onCancel={handleConfirmNo}
        />
      ) : null}
      {state?.kind === "prompt" ? (
        <PromptHost
          state={state}
          onCancel={handlePromptCancel}
          onConfirm={handlePromptOk}
          onChange={(v) =>
            setState((prev) =>
              prev?.kind === "prompt"
                ? { ...prev, value: v, error: null }
                : prev
            )
          }
        />
      ) : null}
    </ConfirmContext.Provider>
  );
}

function PromptHost({
  state,
  onChange,
  onConfirm,
  onCancel,
}: {
  state: PromptState;
  onChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const o = state.options;
  return (
    <Dialog
      open
      onClose={onCancel}
      size="sm"
      dismissOnBackdrop={false}
      bottomSheetOnMobile
      ariaLabel={o.title}
    >
      <DialogTitle description={o.description}>{o.title}</DialogTitle>
      <DialogBody>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onConfirm();
          }}
        >
          {o.multiline ? (
            <textarea
              autoFocus
              rows={4}
              className="field-input"
              value={state.value}
              placeholder={o.placeholder}
              onChange={(e) => onChange(e.target.value)}
              aria-invalid={state.error ? true : undefined}
              aria-describedby={state.error ? "prompt-error" : undefined}
            />
          ) : (
            <input
              autoFocus
              type={o.inputType ?? "text"}
              className="field-input"
              value={state.value}
              placeholder={o.placeholder}
              onChange={(e) => onChange(e.target.value)}
              aria-invalid={state.error ? true : undefined}
              aria-describedby={state.error ? "prompt-error" : undefined}
            />
          )}
          {state.error ? (
            <p id="prompt-error" className="text-xs text-[var(--color-danger)] mt-1.5">
              {state.error}
            </p>
          ) : null}
          {/* Hidden submit so Enter triggers the form. */}
          <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
            Submit
          </button>
        </form>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onCancel}>
          {o.cancelLabel ?? "Cancel"}
        </Button>
        <Button onClick={onConfirm}>{o.confirmLabel ?? "OK"}</Button>
      </DialogFooter>
    </Dialog>
  );
}

/** Use the {@link ConfirmContextValue#confirm} dialog. */
export function useConfirm(): ConfirmContextValue["confirm"] {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used inside <ConfirmProvider>");
  }
  return ctx.confirm;
}

/** Use the {@link ConfirmContextValue#prompt} dialog. */
export function usePrompt(): ConfirmContextValue["prompt"] {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("usePrompt must be used inside <ConfirmProvider>");
  }
  return ctx.prompt;
}
