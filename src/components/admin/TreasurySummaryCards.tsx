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
  tourId?: string;
};

export function TreasurySummaryCards({ className = "", compact = false, tourId }: Props) {
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
    <div className={`space-y-2 ${className}`} data-tour={tourId}>
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
        <Link
          to="/treasury/history?source=cash"
          aria-label="Open cash history"
          className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
        >
          <Card
            className={`${cardClass} bg-emerald-50 border-emerald-200/60 transition hover:bg-emerald-100/70 hover:border-emerald-300/70 group cursor-pointer`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800/80">
                Cash on hand
              </p>
              <span className="text-xs font-medium text-emerald-800/70 opacity-0 group-hover:opacity-100 transition">
                View history →
              </span>
            </div>
            <p
              className={`font-bold tabular-nums text-emerald-900 mt-1 ${
                compact ? "text-xl" : "text-2xl"
              }`}
            >
              {fmt(treasury.cashBalance)}
            </p>
            {!compact && <CashOnHandMeta treasury={treasury} />}
          </Card>
        </Link>
        <Link
          to="/treasury/history?source=card"
          aria-label="Open card and bank history"
          className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
        >
          <Card
            className={`${cardClass} bg-sky-50 border-sky-200/60 transition hover:bg-sky-100/70 hover:border-sky-300/70 group cursor-pointer`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-800/80">
                Card / bank
              </p>
              <span className="text-xs font-medium text-sky-800/70 opacity-0 group-hover:opacity-100 transition">
                View history →
              </span>
            </div>
            <p
              className={`font-bold tabular-nums text-sky-900 mt-1 ${
                compact ? "text-xl" : "text-2xl"
              }`}
            >
              {fmt(treasury.cardBalance)}
            </p>
            {!compact && (
              <BalanceBreakdown
                tone="sky"
                items={[
                  ["Initial balance", treasury.settings.initialCardBalance],
                  [
                    "Card net from reports",
                    treasury.cardFromShiftReports ?? treasury.cardFromEntries,
                  ],
                  ["Manual delivery (Finance)", treasury.cardFromManualDelivery ?? 0],
                  ["Finance expenses (card)", -(treasury.standaloneCardExpenses ?? 0)],
                  ["Salary paid by card", -treasury.salaryPaidFromCard],
                ]}
              />
            )}
          </Card>
        </Link>
      </div>
      {compact && (
        <p className="text-xs text-[var(--color-muted)]">
          Card includes settled delivery from reports + manual delivery income (Finance) − salary payouts.
        </p>
      )}
    </div>
  );
}

function CashOnHandMeta({ treasury }: { treasury: TreasuryOverview }) {
  const fromLatest = treasury.cashSource === "LATEST_COUNT" && treasury.cashLatestCountDate;
  const computed = treasury.cashComputedBalance;
  const showVariance =
    typeof computed === "number" && Math.abs(computed - treasury.cashBalance) > 0.005;

  if (!fromLatest) {
    return (
      <p className="text-xs text-emerald-800/70 mt-2">
        No locked shift report yet — showing initial balance from Treasury settings.
      </p>
    );
  }
  const dateLabel = formatLatestDate(treasury.cashLatestCountDate!);
  const who = treasury.cashLatestCountCashierName;
  return (
    <div className="mt-2 text-xs text-emerald-800/80 space-y-0.5">
      <p>
        Latest count: <strong>{dateLabel}</strong>
        {who && (
          <>
            {" · "}
            {who}
          </>
        )}
      </p>
      {showVariance && (
        <p className="text-emerald-900/60">
          Expected from movements: <strong>{fmt(computed!)}</strong>
          {" · "}variance{" "}
          <strong
            className={
              computed! - treasury.cashBalance > 0
                ? "text-amber-700"
                : "text-rose-700"
            }
          >
            {computed! - treasury.cashBalance > 0 ? "+" : "−"}
            {fmt(Math.abs(computed! - treasury.cashBalance))}
          </strong>
        </p>
      )}
    </div>
  );
}

function formatLatestDate(iso: string): string {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function BalanceBreakdown({
  tone,
  items,
}: {
  tone: "emerald" | "sky";
  items: [string, number][];
}) {
  const labelClass = tone === "emerald" ? "text-emerald-900/70" : "text-sky-900/70";
  const valueClass = tone === "emerald" ? "text-emerald-900" : "text-sky-900";
  const visible = items.filter(([, v]) => Math.abs(v) > 0.005);
  if (visible.length === 0) return null;
  return (
    <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-xs">
      {visible.map(([label, value]) => (
        <FragmentRow key={label} label={label} value={value} labelClass={labelClass} valueClass={valueClass} />
      ))}
    </dl>
  );
}

function FragmentRow({
  label,
  value,
  labelClass,
  valueClass,
}: {
  label: string;
  value: number;
  labelClass: string;
  valueClass: string;
}) {
  return (
    <>
      <dt className={labelClass}>{label}</dt>
      <dd className={`tabular-nums font-semibold ${valueClass}`}>
        {value < 0 ? "−" : ""}
        {fmt(Math.abs(value))}
      </dd>
    </>
  );
}
