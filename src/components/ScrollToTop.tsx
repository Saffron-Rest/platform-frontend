import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Reset window scroll to the top whenever the route pathname changes.
 *
 * <p>React Router doesn't do this by default — without it, jumping from a
 * long Reports list to the Dashboard leaves the user mid-page on the new
 * route, which is jarring. We deliberately ignore hash and query changes
 * (those usually represent in-page navigation like ?filter=foo where
 * scrolling away would be wrong).</p>
 */
export function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    // 'auto' (not 'smooth') so it feels instant — smooth scroll on every
    // nav becomes a small distraction loop on power-user clicks.
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);
  return null;
}
