import { useAuth } from "../context/AuthContext";
import { canOperate } from "../lib/roles";
import { AdminHistory } from "./AdminHistory";
import { CashierHistory } from "./CashierHistory";

export function History() {
  const { user } = useAuth();
  if (canOperate(user?.role)) {
    return <AdminHistory />;
  }
  return <CashierHistory />;
}
