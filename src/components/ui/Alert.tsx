type Variant = "success" | "error" | "info" | "warning";

const styles: Record<Variant, string> = {
  success: "bg-emerald-50 text-emerald-900 border-emerald-200",
  error: "bg-red-50 text-[var(--color-danger)] border-red-200",
  info: "bg-blue-50 text-blue-900 border-blue-200",
  warning: "bg-amber-50 text-amber-900 border-amber-200",
};

export function Alert({
  children,
  variant = "info",
  className = "",
}: {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}) {
  return (
    <p
      role="alert"
      className={`text-sm py-2.5 px-3 rounded-xl border ${styles[variant]} ${className}`}
    >
      {children}
    </p>
  );
}
