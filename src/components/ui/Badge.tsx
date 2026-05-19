type Variant = "draft" | "locked" | "inactive" | "neutral";

const styles: Record<Variant, string> = {
  draft: "bg-amber-100 text-amber-900",
  locked: "bg-emerald-100 text-emerald-900",
  inactive: "bg-gray-100 text-gray-600",
  neutral: "bg-black/5 text-[var(--color-muted)]",
};

export function Badge({
  children,
  variant = "neutral",
  className = "",
}: {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full ${styles[variant]} ${className}`}>
      {children}
    </span>
  );
}

export function entryStatusBadge(status: string) {
  return status === "LOCKED" ? "locked" : "draft";
}
