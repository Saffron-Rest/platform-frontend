import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { canOperate } from "../../lib/roles";
import { Spinner } from "../ui/Spinner";

/** Routes for admin and manager (reports, history, audit). */
export function OperationsGuard() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner label="Loading…" />
      </div>
    );
  }

  if (!user || !canOperate(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
