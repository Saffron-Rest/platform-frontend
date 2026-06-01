import type { ReactNode } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Spinner } from "../ui/Spinner";

type Props = {
  /**
   * Permission keys to check. Access is granted when the current user
   * holds <em>any</em> of them. Admins always pass. An empty array
   * means "authenticated only" — useful when the gate just needs to
   * defend against logged-out access.
   */
  anyOf?: string[];
  /** When provided, renders inline. When omitted, renders an Outlet so
   *  the guard can wrap a nested route subtree. */
  children?: ReactNode;
  /** Where to bounce on denial. Defaults to the home page. */
  redirectTo?: string;
};

/**
 * Permission-aware route guard. Replaces the older role-only
 * {@code <AdminGuard>} for routes that admins can delegate to managers
 * (or even cashiers) by granting the corresponding permission. Reads
 * the live {@code effectivePermissions} from {@link useAuth}, which the
 * backend rebuilds from the database on every request — so a grant
 * issued by an admin takes effect on the next page navigation without
 * a forced re-login.
 */
export function RequirePermission({
  anyOf = [],
  children,
  redirectTo = "/",
}: Props) {
  const { user, loading, hasPermission } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner label="Loading…" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const allowed = anyOf.length === 0 || anyOf.some((key) => hasPermission(key));
  if (!allowed) {
    return <Navigate to={redirectTo} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
