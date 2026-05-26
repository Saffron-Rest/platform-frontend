/**
 * Loading placeholder primitives. Replace "Loading…" text with these to
 * give pages a sense of structure while data is in flight — feels much
 * snappier even when network latency is the same.
 *
 * <p>Backed by a single shimmer keyframe in {@code index.css} so every
 * skeleton across the app animates in sync (less visual chaos than
 * independent timers).
 */

type SkeletonProps = {
  className?: string;
  /** Set false to render a static (non-shimmering) block. */
  shimmer?: boolean;
};

export function Skeleton({ className = "", shimmer = true }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={`block rounded-md bg-black/[0.06] ${
        shimmer ? "skeleton-shimmer" : ""
      } ${className}`}
    />
  );
}

/**
 * Multi-line text placeholder. Convenient default for paragraphs and
 * lists where you don't want to hand-craft individual <Skeleton/> lines.
 */
export function SkeletonText({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          // The last line is intentionally shorter so it reads like a
          // real paragraph rather than a perfect rectangle of blocks.
          className={`h-3 ${i === lines - 1 ? "w-2/3" : "w-full"}`}
        />
      ))}
    </div>
  );
}

/**
 * Card-shaped placeholder — wraps a title bar and a few text lines.
 * Drop into pages that render a list of {@code <Card>} entries while
 * loading.
 */
export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="surface-card p-4 space-y-3">
      <Skeleton className="h-5 w-1/3" />
      <SkeletonText lines={rows} />
    </div>
  );
}

/**
 * Table-row placeholder. Renders a list of `count` rows with a couple
 * of skeleton columns each — close enough to the visual density of a
 * real list to avoid layout shift when the data lands.
 */
export function SkeletonRows({
  count = 5,
  height = "h-12",
}: {
  count?: number;
  height?: string;
}) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`surface-card flex items-center gap-3 px-4 ${height}`}
        >
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="h-2.5 w-1/4" />
          </div>
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}
