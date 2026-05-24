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

const INCLUDE_SALARY_KEY = "treasury.includeSalary";

function readIncludeSalary(): boolean {
  if (typeof window === "undefined") return true;
  const raw = window.localStorage.getItem(INCLUDE_SALARY_KEY);
  if (raw == null) return true;
  return raw !== "false";
}

export function TreasurySummaryCards({ className = "", compact = false, tourId }: Props) {
  const { user } = useAuth();
  const [treasury, setTreasury] = useState<TreasuryOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [includeSalary, setIncludeSalary] = useState<boolean>(readIncludeSalary);

  useEffect(() => {
    setLoading(true);
    api<TreasuryOverview>("/treasury")
      .then(setTreasury)
      .catch(() => setTreasury(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(INCLUDE_SALARY_KEY, includeSalary ? "true" : "false");
    }
  }, [includeSalary]);

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
  const cashRaw = treasury.cashBalanceBeforeSalary ?? treasury.cashBalance;
  const cardRaw = treasury.cardBalanceBeforeSalary ?? treasury.cardBalance + treasury.salaryPaidFromCard;
  const cashDisplay = includeSalary ? treasury.cashBalance : cashRaw;
  const cardDisplay = includeSalary ? treasury.cardBalance : cardRaw;
  const salaryCashPost = treasury.salaryPaidFromCashPostCount ?? 0;
  const hasAnySalary = treasury.salaryPaidFromCash > 0 || treasury.salaryPaidFromCard > 0;

  return (
    <div className={`space-y-2 ${className}`} data-tour={tourId}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className={`font-semibold text-[var(--color-ink)] ${compact ? "text-sm" : ""}`}>
          Treasury balances
        </h3>
        <div className="flex items-center gap-3">
          {hasAnySalary && (
            <label className="flex items-center gap-1.5 text-xs text-[var(--color-muted)] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeSalary}
                onChange={(e) => setIncludeSalary(e.target.checked)}
                className="w-3.5 h-3.5 accent-[var(--color-saffron)]"
              />
              <span>Include salary payouts</span>
            </label>
          )}
          {isAdmin(user?.role) && (
            <Link
              to="/admin/settings"
              className="text-xs font-medium text-[var(--color-saffron)] hover:underline"
            >
              Settings →
            </Link>
          )}
        </div>
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
              {fmt(cashDisplay)}
            </p>
            {!compact && (
              <CashOnHandMeta
                treasury={treasury}
                includeSalary={includeSalary}
                salaryPostCount={salaryCashPost}
              />
            )}
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
              {fmt(cardDisplay)}
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
                  ["Settlement adjustments", treasury.cardFromManualSettlement ?? 0],
                  ["Bank deposit adjustments", treasury.cardFromBankDeposits ?? 0],
                  ["Finance expenses (card)", -(treasury.standaloneCardExpenses ?? 0)],
                  ...(includeSalary
                    ? ([["Salary paid by card", -treasury.salaryPaidFromCard]] as [string, number][])
                    : []),
                ]}
              />
            )}
          </Card>
        </Link>
      </div>
      {!includeSalary && hasAnySalary && (
        <p className="text-xs text-amber-700/90">
          Showing balances <strong>before</strong> salary payouts ({fmt(treasury.salaryPaidFromCash)}{" "}
          cash, {fmt(treasury.salaryPaidFromCard)} card). Toggle on to include them.
        </p>
      )}
      {compact && includeSalary && (
        <p className="text-xs text-[var(--color-muted)]">
          Card includes settled delivery from reports + manual delivery income (Finance) − salary payouts.
        </p>
      )}
    </div>
  );
}

function CashOnHandMeta({
  treasury,
  includeSalary,
  salaryPostCount,
}: {
  treasury: TreasuryOverview;
  includeSalary: boolean;
  salaryPostCount: number;
}) {
  const fromLatest = treasury.cashSource === "LATEST_COUNT" && treasury.cashLatestCountDate;
  const computed = treasury.cashComputedBalance;
  const displayValue = includeSalary ? treasury.cashBalance : treasury.cashBalanceBeforeSalary ?? treasury.cashBalance;
  const showVariance =
    typeof computed === "number" && Math.abs(computed - displayValue) > 0.005;

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
      {includeSalary && salaryPostCount > 0.005 && (
        <p className="text-emerald-900/70">
          − salary paid since last count: <strong>{fmt(salaryPostCount)}</strong>
        </p>
      )}
      {showVariance && (
        <p className="text-emerald-900/60">
          Expected from movements: <strong>{fmt(computed!)}</strong>
          {" · "}variance{" "}
          <strong
            className={
              computed! - displayValue > 0 ? "text-amber-700" : "text-rose-700"
            }
          >
            {computed! - displayValue > 0 ? "+" : "−"}
            {fmt(Math.abs(computed! - displayValue))}
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
