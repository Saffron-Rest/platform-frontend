import { Outlet } from "react-router-dom";

/**
 * Admin route wrapper.
 *
 * <p>v3 (May 2026): the nested admin sub-sidebar was removed. The main
 * application sidebar now surfaces every admin destination directly, so
 * this component is a thin pass-through that exists only as a mount
 * point for the {@code <AdminGuard>} above it in the route tree.</p>
 *
 * <p>Kept as a named component (instead of inlining {@code <Outlet/>})
 * because the route configuration treats it as the layout element and
 * we want a stable place to add admin-wide concerns (analytics,
 * onboarding callouts, etc.) later.</p>
 */
export function AdminLayout() {
  return <Outlet />;
}
