import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Shown when a route guard denies entry. Replaces the previous silent
 * Navigate-to-"/" redirect, which left managers wondering why a sidebar
 * link teleported them to the dashboard.
 *
 * <p>The screen surfaces (a) which page was attempted, (b) why access
 * is gated, and (c) a one-click way out — back to the dashboard or
 * sign in as a different user.</p>
 */
export function NoAccess() {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const attempted =
    typeof loc.state === "object" && loc.state && "from" in loc.state
      ? String((loc.state as { from?: string }).from ?? "")
      : "";

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center">
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
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h1 className="text-lg font-semibold text-[var(--color-ink)]">
          You don't have access to this page
        </h1>
        <p className="text-sm text-[var(--color-muted)] mt-1.5 max-w-sm mx-auto">
          {user
            ? <>Your account doesn't have the permission this section requires. Ask an admin to grant access in <span className="font-medium text-[var(--color-ink)]">Manage permissions</span>.</>
            : "Sign in to continue."}
        </p>
        {attempted ? (
          <p className="mt-3 text-xs text-[var(--color-muted)]">
            Tried to open: <code className="font-mono px-1.5 py-0.5 rounded bg-black/[0.04]">{attempted}</code>
          </p>
        ) : null}
        <div className="mt-5 flex items-center justify-center gap-2">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition px-5 py-3 text-sm md:text-base min-h-11 bg-[var(--color-saffron)] text-white hover:bg-[var(--color-saffron-dark)] shadow-sm shadow-[var(--color-saffron)]/20"
          >
            Back to dashboard
          </Link>
          {user ? (
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition px-5 py-3 text-sm md:text-base min-h-11 text-[var(--color-muted)] hover:bg-black/5 hover:text-[var(--color-ink)]"
            >
              Sign out
            </button>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition px-5 py-3 text-sm md:text-base min-h-11 text-[var(--color-muted)] hover:bg-black/5 hover:text-[var(--color-ink)]"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
