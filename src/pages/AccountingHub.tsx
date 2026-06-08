import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAccountingHub, type AccountingHub } from "../api/accountingHub";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Spinner } from "../components/ui/Spinner";
import { Alert } from "../components/ui/Alert";

const fmtMoney = (n: number | null | undefined) => {
  if (n == null) return "—";
  return `${n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;
};

const fmtPct = (n: number | null | undefined) => {
  if (n == null) return "—";
  return `${n.toFixed(1)}%`;
};

const monthLabel = (period: string) => {
  const d = new Date(period + "-01");
  return d.toLocaleString(undefined, { month: "long", year: "numeric" });
};

export function AccountingHub() {
  const [data, setData] = useState<AccountingHub | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getAccountingHub()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  const totalActions = data
    ? data.overduePayables.count
      + data.dueSoonPayables.count
      + data.oldDraftEntries.count
      + data.pendingOwnerExpenses.count
      + data.unmatchedPosItems.count
      + data.stockAlerts.outOfStock
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Finance"
        title="Accounting Hub"
        subtitle="Everything that needs your attention — in one place."
      />

      {error && <Alert variant="error">{error}</Alert>}

      {loading ? (
        <div className="py-16"><Spinner /></div>
      ) : !data ? null : (
        <>
          {/* ── All clear banner ─────────────────────────────────────────── */}
          {totalActions === 0 && (
            <Card>
              <div className="flex items-center gap-3 py-2">
                <span className="text-2xl">✓</span>
                <div>
                  <p className="font-semibold text-emerald-700">All clear</p>
                  <p className="text-sm text-[var(--color-muted)]">No overdue invoices, no pending items, no unclosed shifts.</p>
                </div>
              </div>
            </Card>
          )}

          {/* ── Action items ─────────────────────────────────────────────── */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-3">
              Action required
            </h2>
            <div className="space-y-2">

              {/* Overdue invoices */}
              <ActionRow
                tone="red"
                icon="⚠"
                title={`${data.overduePayables.count} overdue invoice${data.overduePayables.count === 1 ? "" : "s"}`}
                detail={`${fmtMoney(data.overduePayables.totalOutstanding)} past due — pay these now to avoid supplier friction`}
                href="/reports?tab=payables"
                hidden={data.overduePayables.count === 0}
              />

              {/* Invoices due soon */}
              <ActionRow
                tone="amber"
                icon="⏰"
                title={`${data.dueSoonPayables.count} invoice${data.dueSoonPayables.count === 1 ? "" : "s"} due within 7 days`}
                detail={`${fmtMoney(data.dueSoonPayables.totalOutstanding)} coming up — schedule the payments`}
                href="/reports?tab=payables"
                hidden={data.dueSoonPayables.count === 0}
              />

              {/* Unclosed shifts */}
              <ActionRow
                tone="amber"
                icon="📋"
                title={`${data.oldDraftEntries.count} unclosed cashier shift${data.oldDraftEntries.count === 1 ? "" : "s"}`}
                detail="These daily reports were never locked — open and close them to include revenue in your P&L"
                href="/reports?tab=shift-reports"
                hidden={data.oldDraftEntries.count === 0}
              />

              {/* Owner expenses */}
              <ActionRow
                tone="amber"
                icon="💳"
                title={`${data.pendingOwnerExpenses.count} owner expense${data.pendingOwnerExpenses.count === 1 ? "" : "s"} pending reimbursement`}
                detail={`${fmtMoney(data.pendingOwnerExpenses.totalOutstanding)} to pay back to owner(s)`}
                href="/reports?tab=owner-expenses"
                hidden={data.pendingOwnerExpenses.count === 0}
              />

              {/* Unmatched POS items */}
              <ActionRow
                tone="blue"
                icon="🔗"
                title={`${data.unmatchedPosItems.count} unmatched POS item${data.unmatchedPosItems.count === 1 ? "" : "s"} (last 60 days)`}
                detail="POS sales with no menu match — link them so revenue and stock track correctly"
                href="/admin/stock"
                hidden={data.unmatchedPosItems.count === 0}
              />

              {/* Out of stock */}
              <ActionRow
                tone="red"
                icon="📦"
                title={`${data.stockAlerts.outOfStock} item${data.stockAlerts.outOfStock === 1 ? "" : "s"} out of stock`}
                detail="Zero on-hand — order or adjust the physical count"
                href="/admin/stock"
                hidden={data.stockAlerts.outOfStock === 0}
              />

              {/* Low stock */}
              <ActionRow
                tone="amber"
                icon="📉"
                title={`${data.stockAlerts.lowStock} item${data.stockAlerts.lowStock === 1 ? "" : "s"} running low`}
                detail="At or below the low-stock threshold — consider ordering"
                href="/admin/stock"
                hidden={data.stockAlerts.lowStock === 0}
              />

              {totalActions === 0 && (
                <p className="text-sm text-[var(--color-muted)] text-center py-2">Nothing urgent right now.</p>
              )}
            </div>
          </div>

          {/* ── This month P&L snapshot ───────────────────────────────────── */}
          {data.thisMonth && (
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-3">
                {monthLabel(data.thisMonth.period)} — P&L snapshot
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MoneyTile
                  label="Revenue"
                  value={data.thisMonth.netRevenue}
                  hint="Net (after returns)"
                  tone="neutral"
                />
                <MoneyTile
                  label="Gross profit"
                  value={data.thisMonth.grossProfit}
                  hint={`Margin ${fmtPct(data.thisMonth.grossMarginPct)}`}
                  tone={data.thisMonth.grossProfit >= 0 ? "ok" : "bad"}
                />
                <MoneyTile
                  label="Operating profit"
                  value={data.thisMonth.operatingProfit}
                  hint="After operating costs"
                  tone={data.thisMonth.operatingProfit >= 0 ? "ok" : "bad"}
                />
                <MoneyTile
                  label="Net profit"
                  value={data.thisMonth.netProfit}
                  hint={`Margin ${fmtPct(data.thisMonth.netMarginPct)}`}
                  tone={data.thisMonth.netProfit >= 0 ? "ok" : "bad"}
                />
              </div>
              <p className="text-xs text-[var(--color-muted)] mt-2">
                Includes all entries (open + closed) for {monthLabel(data.thisMonth.period)}.{" "}
                <Link to="/reports?tab=pl" className="text-[var(--color-saffron-dark)] hover:underline">
                  Full P&L →
                </Link>
              </p>
            </div>
          )}

          {/* ── Quick links ───────────────────────────────────────────────── */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-3">
              Quick links
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {[
                { label: "Payables", href: "/reports?tab=payables", icon: "🧾" },
                { label: "Owner expenses", href: "/reports?tab=owner-expenses", icon: "💳" },
                { label: "Profit & Loss", href: "/reports?tab=pl", icon: "📊" },
                { label: "Shift reports", href: "/reports?tab=shift-reports", icon: "📋" },
                { label: "Treasury", href: "/reports?tab=treasury", icon: "🏦" },
                { label: "Stock", href: "/admin/stock", icon: "📦" },
                { label: "POS integrations", href: "/admin/settings?tab=pos", icon: "🔗" },
                { label: "Salaries", href: "/admin/settings?tab=payroll", icon: "💰" },
              ].map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className="flex items-center gap-2 rounded-lg border border-black/10 px-3 py-2.5 text-sm hover:bg-[var(--color-cream)] transition-colors"
                >
                  <span>{link.icon}</span>
                  <span className="text-[var(--color-ink)]">{link.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ActionRow({
  tone, icon, title, detail, href, hidden,
}: {
  tone: "red" | "amber" | "blue";
  icon: string;
  title: string;
  detail: string;
  href: string;
  hidden: boolean;
}) {
  if (hidden) return null;

  const border = { red: "border-red-200", amber: "border-amber-200", blue: "border-blue-200" }[tone];
  const bg = { red: "bg-red-50/60", amber: "bg-amber-50/60", blue: "bg-blue-50/40" }[tone];
  const iconBg = { red: "bg-red-100 text-red-700", amber: "bg-amber-100 text-amber-800", blue: "bg-blue-100 text-blue-700" }[tone];

  return (
    <Link
      to={href}
      className={`flex items-center gap-4 rounded-xl border ${border} ${bg} px-4 py-3 hover:brightness-95 transition-all`}
    >
      <span className={`shrink-0 w-8 h-8 rounded-full ${iconBg} flex items-center justify-center text-sm`}>
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--color-ink)]">{title}</p>
        <p className="text-xs text-[var(--color-muted)] mt-0.5">{detail}</p>
      </div>
      <span className="text-[var(--color-muted)] text-sm shrink-0">→</span>
    </Link>
  );
}

function MoneyTile({
  label, value, hint, tone,
}: {
  label: string;
  value: number;
  hint: string;
  tone: "ok" | "bad" | "neutral";
}) {
  const bg = { ok: "bg-emerald-50/50 border-emerald-200/60", bad: "bg-red-50/50 border-red-200/60", neutral: "bg-[var(--color-cream)]/60 border-black/5" }[tone];
  const valueColor = { ok: "text-emerald-700", bad: "text-red-700", neutral: "text-[var(--color-ink)]" }[tone];

  return (
    <div className={`rounded-xl border ${bg} p-3`}>
      <div className="text-xs uppercase tracking-wider text-[var(--color-muted)]">{label}</div>
      <div className={`text-xl font-semibold mt-1 ${valueColor}`}>{fmtMoney(value)}</div>
      <div className="text-xs text-[var(--color-muted)] mt-1">{hint}</div>
    </div>
  );
}
