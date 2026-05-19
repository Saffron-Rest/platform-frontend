import { useEffect } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { api } from "../api/client";
import type { DailyEntry } from "../types";
import { useAuth } from "../context/AuthContext";
import { isCashier } from "../lib/roles";
import { Spinner } from "../components/ui/Spinner";

/** Legacy `/entry/:id` URLs redirect to the unified report editor with date + cashier context. */
export function EntryDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (!id || isCashier(user?.role)) return;
    api<DailyEntry>(`/entries/${id}`)
      .then((e) => {
        const date = e.date.slice(0, 10);
        navigate(`/entry?date=${encodeURIComponent(date)}&cashierId=${encodeURIComponent(e.cashierId)}`, {
          replace: true,
        });
      })
      .catch(() => navigate("/entry", { replace: true }));
  }, [id, user?.role, navigate]);

  if (isCashier(user?.role)) {
    return <Navigate to="/entry" replace />;
  }

  return <Spinner label="Opening report…" />;
}
