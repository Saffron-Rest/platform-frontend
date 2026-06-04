import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Optional override for the fallback UI. Receives the caught error and
   *  a {@code reset} callback that clears the boundary so the children
   *  re-render. Returning {@code null} keeps the default fallback. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** Stable identifier used in dev logs and (later) in error-tracking. */
  scope?: string;
  /** Re-mount the boundary when this prop changes — handy on route
   *  changes so the boundary clears automatically when the user navigates
   *  away from the failing screen. */
  resetKey?: unknown;
};

type State = {
  error: Error | null;
};

/**
 * React error boundary that prevents a single render bug from white-screening
 * the cashier tablet mid-shift. Two layers are mounted:
 * <ol>
 *   <li>One outside the router for catastrophic shell crashes.</li>
 *   <li>One inside the {@code <Layout>} (per-route) so a broken page can
 *       fall back to a friendly card while the sidebar/topbar stay alive.</li>
 * </ol>
 *
 * <p>Re-throw in dev so the React/Vite overlay still surfaces stack traces.</p>
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error(`[ErrorBoundary:${this.props.scope ?? "root"}]`, error, info);
    }
  }

  static isChunkError(error: Error): boolean {
    const m = error?.message ?? "";
    return (
      m.includes("Failed to fetch dynamically imported module") ||
      m.includes("Importing a module script failed") ||
      m.includes("error loading dynamically imported module") ||
      m.includes("Unable to preload CSS for") ||
      (error?.name === "TypeError" && m.includes("import("))
    );
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (ErrorBoundary.isChunkError(error)) {
      return <ChunkFallback />;
    }

    if (this.props.fallback) {
      return this.props.fallback(error, this.reset);
    }

    return <DefaultFallback error={error} onReset={this.reset} />;
  }
}

/**
 * Shown when a lazy chunk can't be fetched — typically means a new
 * deployment replaced the hashed file the browser was expecting.
 * A full reload picks up the new index.html and resolves the mismatch.
 */
function ChunkFallback() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center">
        <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-[var(--color-saffron-light)] text-[var(--color-saffron)] flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7" aria-hidden="true">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">
          New version available
        </h2>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          The app was updated. Reload to get the latest version.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition px-6 py-3 text-sm min-h-11 bg-[var(--color-saffron)] text-white hover:bg-[var(--color-saffron-dark)] shadow-sm shadow-[var(--color-saffron)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-saffron)] focus-visible:ring-offset-2"
        >
          Reload page
        </button>
      </div>
    </div>
  );
}

function DefaultFallback({
  error,
  onReset,
}: {
  error: Error;
  onReset: () => void;
}) {
  const message =
    error?.message && error.message.length < 200
      ? error.message
      : "Something went wrong while rendering this page.";
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-red-50 text-[var(--color-danger)] flex items-center justify-center">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-7 h-7"
            aria-hidden="true"
          >
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">
          Something went wrong
        </h2>
        <p className="text-sm text-[var(--color-muted)] mt-1">{message}</p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition px-5 py-3 text-sm md:text-base min-h-11 bg-[var(--color-saffron)] text-white hover:bg-[var(--color-saffron-dark)] shadow-sm shadow-[var(--color-saffron)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-saffron)] focus-visible:ring-offset-2"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.assign("/")}
            className="inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition px-5 py-3 text-sm md:text-base min-h-11 text-[var(--color-muted)] hover:bg-black/5 hover:text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-saffron)] focus-visible:ring-offset-2"
          >
            Go to dashboard
          </button>
        </div>
        {import.meta.env.DEV && error.stack ? (
          <details className="mt-6 text-left">
            <summary className="cursor-pointer text-xs text-[var(--color-muted)]">
              Stack (dev only)
            </summary>
            <pre className="mt-2 text-[11px] leading-tight bg-black/5 rounded p-3 overflow-auto max-h-64 whitespace-pre-wrap break-words">
              {error.stack}
            </pre>
          </details>
        ) : null}
      </div>
    </div>
  );
}
