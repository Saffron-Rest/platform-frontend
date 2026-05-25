import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getMenuAnalytics,
  type MenuAnalytics as MenuAnalyticsData,
  type MenuAnalyticsItemRow,
} from "../api/menu";
import { fmt } from "../lib/calc";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";
import { Spinner } from "../components/ui/Spinner";
import { EmptyState } from "../components/ui/EmptyState";

function monthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

type SortKey = "revenue" | "quantity" | "margin" | "marginPct" | "share";

export function MenuAnalytics() {
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [data, setData] = useState<MenuAnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<SortKey>("revenue");
  const [limit, setLimit] = useState(20);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await getMenuAnalytics(from, to));
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const sortedItems = data
    ? [...data.items].sort((a, b) => {
        const av = Number((a as Record<string, unknown>)[sort] ?? 0);
        const bv = Number((b as Record<string, unknown>)[sort] ?? 0);
        return bv - av;
      })
    : [];

  const visibleItems = sortedItems.slice(0, limit);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Menu analytics"
        subtitle="What sold, how much it made, and where the margin is. Powered by your POS webhook."
        action={
          <Link to="/menu/engineering">
            <Button variant="secondary">Menu engineering →</Button>
          </Link>
        }
      />

      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] items-end">
          <label className="field-label">
            From
            <input
              type="date"
              className="field-input"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="field-label">
            To
            <input
              type="date"
              className="field-input"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <Button onClick={() => void load()} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </Button>
        </div>
        <p className="text-xs text-[var(--color-muted)] mt-3">
          Tip: dates align to the business day in Europe/Warsaw, so a sale at 02:00 still
          counts towards the previous trading day if it happened before close.
        </p>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner label="Crunching numbers…" />
        </div>
      ) : !data || data.totals.quantity === 0 ? (
        <EmptyState
          title="No POS sales in this window"
          description="Plug in your POS via the integrations page, or pick a date range that includes sales."
        />
      ) : (
        <>
          {/* KPIs */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Net revenue" value={fmt(data.totals.revenue)} hint={`from ${data.totals.receipts} receipts`} />
            <Kpi
              label="Avg ticket"
              value={fmt(data.totals.avgTicket)}
              hint={`${data.totals.quantity} items sold`}
            />
            <Kpi
              label="Margin"
              value={fmt(data.totals.margin)}
              hint={`${data.totals.marginPct.toFixed(1)}% of revenue`}
              tone={data.totals.marginPct >= 60 ? "good" : data.totals.marginPct >= 50 ? "neutral" : "warn"}
            />
            <Kpi
              label="Food cost"
              value={`${data.totals.foodCostPct.toFixed(1)}%`}
              hint={fmt(data.totals.foodCost)}
              tone={data.totals.foodCostPct <= 32 ? "good" : data.totals.foodCostPct <= 38 ? "neutral" : "warn"}
            />
          </div>

          {data.unmatched > 0 && (
            <Alert variant="info">
              {data.unmatched} POS line{data.unmatched === 1 ? " was" : "s were"} not matched to a
              menu item. Add their SKUs in <Link to="/admin/menu" className="underline">Menu admin</Link>{" "}
              so they appear in the breakdown.
            </Alert>
          )}

          {/* Category mix */}
          <Card>
            <h3 className="font-semibold mb-3">Category mix</h3>
            {data.categoryMix.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">
                No category breakdown — items might be missing categories.
              </p>
            ) : (
              <ul className="space-y-2">
                {data.categoryMix.map((c) => (
                  <li key={c.categoryId} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="font-medium truncate">{c.name}</span>
                        <span className="tabular-nums text-[var(--color-muted)]">
                          {fmt(c.revenue)} · {c.share.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-black/5 mt-1 overflow-hidden">
                        <div
                          className="h-full bg-[var(--color-saffron)]"
                          style={{ width: `${Math.min(100, c.share)}%` }}
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Items table */}
          <Card className="!p-0 overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-black/5">
              <h3 className="font-semibold">Items</h3>
              <div className="flex items-center gap-2 text-sm">
                <label className="text-[var(--color-muted)]">Sort by</label>
                <select
                  className="field-input !py-1.5 !text-sm"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                >
                  <option value="revenue">Revenue</option>
                  <option value="quantity">Quantity</option>
                  <option value="margin">Margin (PLN)</option>
                  <option value="marginPct">Margin %</option>
                  <option value="share">Share %</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-black/5 text-[var(--color-muted)] text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-2">Item</th>
                    <th className="text-left px-4 py-2">Category</th>
                    <th className="text-right px-4 py-2">Qty</th>
                    <th className="text-right px-4 py-2">Revenue</th>
                    <th className="text-right px-4 py-2">Share</th>
                    <th className="text-right px-4 py-2">Food cost</th>
                    <th className="text-right px-4 py-2">Margin</th>
                    <th className="text-right px-4 py-2">Margin %</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.map((i) => (
                    <ItemRow key={i.itemId ?? i.name} item={i} />
                  ))}
                </tbody>
              </table>
            </div>
            {sortedItems.length > limit && (
              <div className="px-4 py-3 border-t border-black/5 text-center">
                <button
                  type="button"
                  className="text-sm font-medium text-[var(--color-saffron-dark)] hover:underline"
                  onClick={() => setLimit((l) => l + 20)}
                >
                  Show {Math.min(20, sortedItems.length - limit)} more (of{" "}
                  {sortedItems.length})
                </button>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "good" | "neutral" | "warn";
}) {
  const toneColor =
    tone === "good"
      ? "text-emerald-700"
      : tone === "warn"
      ? "text-red-600"
      : "text-[var(--color-ink)]";
  return (
    <Card>
      <p className="text-xs uppercase tracking-wide text-[var(--color-muted)]">{label}</p>
      <p className={`text-2xl font-bold tabular-nums mt-1 ${toneColor}`}>{value}</p>
      {hint && <p className="text-xs text-[var(--color-muted)] mt-1">{hint}</p>}
    </Card>
  );
}

function ItemRow({ item }: { item: MenuAnalyticsItemRow }) {
  const marginPct = Number(item.marginPct ?? 0);
  const fcPct = Number(item.foodCostPct ?? 0);
  const marginColor =
    item.foodCost === 0 || item.unmatched
      ? "text-[var(--color-muted)]"
      : marginPct >= 60
      ? "text-emerald-700"
      : marginPct >= 45
      ? "text-amber-600"
      : "text-red-600";
  return (
    <tr className="border-t border-black/5">
      <td className="px-4 py-2">
        <div className="font-medium">{item.name}</div>
        {item.unmatched && (
          <div className="text-xs text-amber-600">
            Unmatched — add SKU "{item.sku ?? item.name}" to the menu
          </div>
        )}
      </td>
      <td className="px-4 py-2 text-[var(--color-muted)]">{item.categoryName ?? "—"}</td>
      <td className="px-4 py-2 text-right tabular-nums">{item.quantity}</td>
      <td className="px-4 py-2 text-right tabular-nums">{fmt(item.revenue)}</td>
      <td className="px-4 py-2 text-right tabular-nums">{item.share.toFixed(1)}%</td>
      <td className="px-4 py-2 text-right tabular-nums">
        {fcPct > 0 ? `${fcPct.toFixed(1)}%` : "—"}
      </td>
      <td className={`px-4 py-2 text-right tabular-nums ${marginColor}`}>
        {fmt(item.margin)}
      </td>
      <td className={`px-4 py-2 text-right tabular-nums ${marginColor}`}>
        {item.foodCost > 0 ? `${marginPct.toFixed(1)}%` : "—"}
      </td>
    </tr>
  );
}
