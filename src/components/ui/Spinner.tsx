export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3" role="status">
      <div
        className="w-8 h-8 rounded-full border-2 border-[var(--color-saffron)]/30 border-t-[var(--color-saffron)] animate-spin"
        aria-hidden
      />
      <p className="text-sm text-[var(--color-muted)]">{label}</p>
    </div>
  );
}
