import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "dark";

const styles: Record<Variant, string> = {
  primary:
    "bg-[var(--color-saffron)] text-white hover:bg-[var(--color-saffron-dark)] shadow-sm shadow-[var(--color-saffron)]/20",
  secondary:
    "border-2 border-[var(--color-saffron)] text-[var(--color-saffron)] bg-white hover:bg-[var(--color-saffron)]/5",
  ghost: "text-[var(--color-muted)] hover:bg-black/5 hover:text-[var(--color-ink)]",
  danger: "bg-red-50 text-[var(--color-danger)] border border-red-200 hover:bg-red-100",
  dark: "bg-[var(--color-ink)] text-white hover:bg-black",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  fullWidth?: boolean;
  children: ReactNode;
};

export function Button({
  variant = "primary",
  fullWidth,
  className = "",
  children,
  disabled,
  ...props
}: Props) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition",
        "px-5 py-3 text-sm md:text-base",
        "disabled:opacity-50 disabled:pointer-events-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-saffron)] focus-visible:ring-offset-2",
        fullWidth ? "w-full" : "",
        styles[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}
