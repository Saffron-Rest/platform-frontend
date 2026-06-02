import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { canOperate } from "../../lib/roles";
import { Spinner } from "../ui/Spinner";

/** Routes for admin and manager (reports, history, audit). */
export function OperationsGuard() {
  const { user, loading } = useAuth();
  const loc = useLocation();

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner label="Loading…" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }
  if (!canOperate(user.role)) {
    return <Navigate to="/no-access" replace state={{ from: loc.pathname }} />;
  }

  return <Outlet />;
}
