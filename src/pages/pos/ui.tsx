import { fmt } from "../../lib/calc";
import { IconBack } from "./icons";

export function PosRoot({ children }: { children: React.ReactNode }) {
  return <div className="pos-root">{children}</div>;
}

export function PosShell({ children }: { children: React.ReactNode }) {
  return <div className="pos-shell">{children}</div>;
}

export function PosTopBar({
  title,
  backLabel,
  onBack,
  right,
}: {
  title: string;
  backLabel?: string;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <header className="pos-topbar">
      {onBack && (
        <button type="button" className="pos-back" onClick={onBack}>
          <IconBack className="w-4 h-4" />
          {backLabel ?? "Back"}
        </button>
      )}
      <h1 className="pos-title">{title}</h1>
      {right ?? (
        <span className="pos-clock">
          {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      )}
    </header>
  );
}

export function PosSteps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="pos-steps">
      {steps.map((label, i) => (
        <div key={label} className="pos-step">
          <div
            className={`pos-step-dot ${i < current ? "pos-step-dot--done" : ""} ${i === current ? "pos-step-dot--active" : ""}`}
          >
            {i + 1}
          </div>
          <span className={`pos-step-label ${i === current ? "pos-step-label--active" : ""}`}>{label}</span>
          {i < steps.length - 1 && <div className="pos-step-line" />}
        </div>
      ))}
    </div>
  );
}

export function PosAlert({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="pos-alert" style={{ marginTop: "0.75rem" }}>
      <span className="flex-1">{message}</span>
      <button type="button" onClick={onDismiss} className="font-bold opacity-70">
        ✕
      </button>
    </div>
  );
}

export function PosInput({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`pos-input ${className}`.trim()} {...props} />;
}

export function PosTextarea({ className = "", ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`pos-input resize-none ${className}`.trim()} {...props} />;
}

export function PosLabel({ children }: { children: React.ReactNode }) {
  return <span className="pos-label">{children}</span>;
}

export function PosBtn({
  children,
  onClick,
  disabled,
  variant = "default",
  className = "",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "default" | "primary" | "cash" | "ghost" | "pill" | "pill-active" | "danger";
  className?: string;
  type?: "button" | "submit";
}) {
  const v =
    variant === "primary"
      ? "pos-btn pos-btn--primary"
      : variant === "cash"
        ? "pos-btn pos-btn--cash"
        : variant === "ghost"
          ? "pos-btn pos-btn--ghost"
          : variant === "pill"
            ? "pos-btn pos-btn--pill"
            : variant === "pill-active"
              ? "pos-btn pos-btn--pill pos-btn--pill-active"
              : variant === "danger"
                ? "pos-btn"
                : "pos-btn";
  const style = variant === "danger" ? { color: "var(--color-danger)", borderColor: "rgb(155 34 38 / 0.25)" } : undefined;
  return (
    <button type={type} className={`${v} w-full ${className}`} onClick={onClick} disabled={disabled} style={style}>
      {children}
    </button>
  );
}

export function PosMoney({ amount, hero }: { amount: number; hero?: boolean }) {
  if (hero) return <span className="pos-total-hero__amount">{fmt(amount)}</span>;
  return (
    <span style={{ fontWeight: 800, color: "var(--color-saffron)", fontVariantNumeric: "tabular-nums" }}>{fmt(amount)}</span>
  );
}

export function PosActionCard({
  title,
  subtitle,
  icon,
  iconBg,
  onClick,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  iconBg: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="pos-action-card" onClick={onClick}>
      <div className="pos-action-card__icon" style={{ background: iconBg, color: "var(--pos-ink)" }}>
        {icon}
      </div>
      <span className="pos-action-card__title">{title}</span>
      <span className="pos-action-card__sub">{subtitle}</span>
    </button>
  );
}

export function PosModal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="pos-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className={`pos-modal ${wide ? "pos-modal--wide" : ""}`} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700 }}>{title}</h2>
          <button type="button" className="pos-btn pos-btn--ghost" style={{ width: "2.5rem", minHeight: "2.5rem", padding: 0 }} onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PosNumpad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const press = (key: string) => {
    if (key === "C") onChange("");
    else if (key === "⌫") onChange(value.slice(0, -1));
    else if (key === ".") {
      if (!value.includes(".")) onChange(value + ".");
    } else onChange(value + key);
  };
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"];
  return (
    <div className="pos-numpad">
      {keys.map(k => (
        <button key={k} type="button" onClick={() => press(k)}>
          {k}
        </button>
      ))}
      <button type="button" onClick={() => press("C")} style={{ gridColumn: "span 3", color: "var(--color-danger)" }}>
        Clear
      </button>
    </div>
  );
}

export function PosQtyControl({
  qty,
  onMinus,
  onPlus,
}: {
  qty: number;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <div className="pos-qty">
      <button type="button" onClick={onMinus} aria-label="Decrease">
        −
      </button>
      <span>{qty}</span>
      <button type="button" onClick={onPlus} aria-label="Increase">
        +
      </button>
    </div>
  );
}

export function PosPageChrome({
  title,
  backLabel,
  onBack,
  stepIndex,
  error,
  onDismissError,
  children,
  footer,
}: {
  title: string;
  backLabel?: string;
  onBack?: () => void;
  stepIndex: number;
  error?: string;
  onDismissError?: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const showSteps = stepIndex >= 0;
  return (
    <PosShell>
      <PosTopBar title={title} backLabel={backLabel} onBack={onBack} />
      {showSteps && <PosSteps steps={["Where", "Order", "Pay"]} current={stepIndex} />}
      {error && onDismissError && <PosAlert message={error} onDismiss={onDismissError} />}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>{children}</div>
      {footer}
    </PosShell>
  );
}
