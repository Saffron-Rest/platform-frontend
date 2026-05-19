import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { fmt } from "../../lib/calc";
import { isAdmin } from "../../lib/roles";
import { useAuth } from "../../context/AuthContext";
import type { TreasuryOverview } from "../../types";
import { Card } from "../ui/Card";

type Props = {
  className?: string;
  /** Tighter layout for report list pages */
  compact?: boolean;
};

export function TreasurySummaryCards({ className = "", compact = false }: Props) {
  const { user } = useAuth();
  const [treasury, setTreasury] = useState<TreasuryOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api<TreasuryOverview>("/treasury")
      .then(setTreasury)
      .catch(() => setTreasury(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className={`grid gap-3 sm:grid-cols-2 ${className}`}>
        {[0, 1].map((i) => (
          <Card key={i} className="!p-4 animate-pulse">
            <div className="h-3 w-24 bg-black/10 rounded mb-3" />
            <div className="h-8 w-32 bg-black/10 rounded" />
          </Card>
        ))}
      </div>
    );
  }

  if (!treasury) return null;

  const cardClass = compact ? "!p-3" : "!p-4";

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className={`font-semibold text-[var(--color-ink)] ${compact ? "text-sm" : ""}`}>
          Treasury balances
        </h3>
        {isAdmin(user?.role) && (
          <Link
            to="/admin/settings"
            className="text-xs font-medium text-[var(--color-saffron)] hover:underline"
          >
            Settings →
          </Link>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className={`${cardClass} bg-emerald-50 border-emerald-200/60`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800/80">
            Cash on hand
          </p>
          <p
            className={`font-bold tabular-nums text-emerald-900 mt-1 ${
              compact ? "text-xl" : "text-2xl"
            }`}
          >
            {fmt(treasury.cashBalance)}
          </p>
          {!compact && (
            <p className="text-xs text-emerald-800/70 mt-1">
              Initial {fmt(treasury.settings.initialCashBalance)} · from locked reports{" "}
              {fmt(treasury.cashFromEntries)} · salaries {fmt(treasury.salaryPaidFromCash)}
            </p>
          )}
        </Card>
        <Card className={`${cardClass} bg-sky-50 border-sky-200/60`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-800/80">
            Card / bank
          </p>
          <p
            className={`font-bold tabular-nums text-sky-900 mt-1 ${
              compact ? "text-xl" : "text-2xl"
            }`}
          >
            {fmt(treasury.cardBalance)}
          </p>
          {!compact && (
            <p className="text-xs text-sky-800/70 mt-1">
              Initial {fmt(treasury.settings.initialCardBalance)} · from reports{" "}
              {fmt(treasury.cardFromShiftReports ?? treasury.cardFromEntries)}
              {(treasury.cardFromManualDelivery ?? 0) > 0 && (
                <> · manual delivery {fmt(treasury.cardFromManualDelivery!)}</>
              )}{" "}
              · salaries {fmt(treasury.salaryPaidFromCard)}
            </p>
          )}
        </Card>
      </div>
      {compact && (
        <p className="text-xs text-[var(--color-muted)]">
          Card includes settled delivery from reports + manual delivery income (Finance) − salary payouts.
        </p>
      )}
    </div>
  );
}
