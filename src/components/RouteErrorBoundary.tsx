import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { ErrorBoundary } from "./ErrorBoundary";

/**
 * Per-route error boundary. Resets automatically when the user navigates
 * away from the failing page, so a broken /admin/recipes page doesn't
 * keep showing the fallback card on /entry.
 */
export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const loc = useLocation();
  return (
    <ErrorBoundary scope="route" resetKey={loc.pathname}>
      {children}
    </ErrorBoundary>
  );
}
