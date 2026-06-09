import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getMenuEngineering, type MenuAnalyticsItemRow } from "../api/menu";
import { api } from "../api/client";
import { fmt } from "../lib/calc";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";
import { Spinner } from "../components/ui/Spinner";
import { EmptyState } from "../components/ui/EmptyState";

// ─── P&L summary ─────────────────────────────────────────────────────────────

type PlSummary = {
  margins: { netMarginPct: number; grossMarginPct: number; operatingMarginPct: number };
  totals: { netRevenue: number; cogs: number; operatingExpenses: number; labor: number; netProfit: number };
};

async function fetchPlSummary(from: string, to: string): Promise<PlSummary | null> {
  try {
    const q = new URLSearchParams({ from, to, template: "EU", includeLabor: "true", status: "ALL" });
    return await api<PlSummary>(`/analytics/profit-loss?${q}`);
  } catch {
    return null;
  }
}

// ─── Price advice types & computation ────────────────────────────────────────

type PriceReason =
  | "RAISE_PRICE"
  | "FIX_FOOD_COST"
  | "REVIEW_FOOD_COST"
  | "KEEP_PRICE"
  | "PROMOTE"
  | "TEST_PRICE"
  | "REMOVE_OR_REWORK";

type PriceAdviceItem = {
  itemId: string | null;
  name: string;
  categoryName: string | null;
  class: string;
  currentPrice: number;
  suggestedPrice: number;
  changeAmt: number;
  changePct: number;
  currentMarginPct: number;
  projectedMarginPct: number;
  currentRevenue: number;
  revenueImpact: number;
  quantity: number;
  reason: PriceReason;
  rationale: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
};

function businessUrgency(pl: PlSummary | null): {
  factor: number;
  status: "critical" | "poor" | "ok" | "healthy";
} {
  if (!pl) return { factor: 1, status: "ok" };
  const m = pl.margins.netMarginPct;
  if (m < 0)  return { factor: 1.8, status: "critical" };
  if (m < 3)  return { factor: 1.5, status: "poor" };
  if (m < 5)  return { factor: 1.2, status: "poor" };
  if (m > 12) return { factor: 0.6, status: "healthy" };
  return { factor: 1, status: "ok" };
}

function computePriceAdvice(items: MenuAnalyticsItemRow[], pl: PlSummary | null): PriceAdviceItem[] {
  const { factor, status } = businessUrgency(pl);

  return items
    .filter((i) => i.class && ["STAR", "PLOWHORSE", "PUZZLE", "DOG"].includes(i.class) && i.sellPrice > 0)
    .map((item): PriceAdviceItem => {
      const cls = item.class!;
      const { sellPrice, unitFoodCost, quantity, marginPct, foodCostPct, revenue } = item;

      let bumpPct = 0;
      let reason: PriceReason = "KEEP_PRICE";
      let rationale = "";
      let confidence: PriceAdviceItem["confidence"] = "MEDIUM";

      if (cls === "PLOWHORSE") {
        if (foodCostPct <= 42) {
          const raw = Math.min(10, Math.max(3, Math.round(5 * factor)));
          bumpPct = raw;
          reason = "RAISE_PRICE";
          const note =
            status === "critical" ? ` Business is running at a loss — a ${raw}% increase is needed urgently.`
            : status === "poor"   ? ` Net margin is below 5% — this ${raw}% bump helps close the gap.`
            : status === "healthy"? " Business is healthy so a gentle increase protects demand."
            : "";
          rationale = `Bestseller with only ${marginPct.toFixed(0)}% margin — a ${raw}% bump across ${quantity} sales adds revenue with minimal demand risk.${note}`;
          confidence = "HIGH";
        } else {
          reason = "FIX_FOOD_COST";
          rationale = `Food cost is ${foodCostPct.toFixed(0)}% — fix ingredients or portion size before raising price.`;
          confidence = "LOW";
        }
      } else if (cls === "STAR") {
        if (foodCostPct > 38) {
          reason = "REVIEW_FOOD_COST";
          rationale = `Star item with food cost ${foodCostPct.toFixed(0)}% above target — price is fine; cut food cost to unlock margin.`;
          confidence = "HIGH";
        } else if (marginPct >= 70) {
          const raw = Math.min(5, Math.max(1, Math.round(3 * factor)));
          bumpPct = raw;
          reason = "RAISE_PRICE";
          rationale = `${marginPct.toFixed(0)}% margin star — loyal demand supports a ${raw}% increase${status === "critical" || status === "poor" ? " to help recover profitability" : " to widen margin"}.`;
          confidence = "MEDIUM";
        } else {
          reason = "KEEP_PRICE";
          rationale =
            status === "critical" || status === "poor"
              ? `Healthy star (${marginPct.toFixed(0)}% margin) — hold price to protect volume; address profitability through food cost or lower-performing items.`
              : "Healthy star — margin and volume are both strong. Protect demand by holding price.";
          confidence = "HIGH";
        }
      } else if (cls === "PUZZLE") {
        reason = "PROMOTE";
        rationale = `Margin is strong at ${marginPct.toFixed(0)}% but volume is low — push visibility, not price.`;
        confidence = "MEDIUM";
      } else if (cls === "DOG") {
        if (foodCostPct < 35 && sellPrice > 10) {
          const raw = Math.min(15, Math.max(5, Math.round(10 * factor)));
          bumpPct = raw;
          reason = "TEST_PRICE";
          rationale = `Food cost is manageable at ${foodCostPct.toFixed(0)}% — the item may be underpriced. Try a ${raw}% price test.`;
          confidence = "LOW";
        } else {
          reason = "REMOVE_OR_REWORK";
          rationale = `Both margin (${marginPct.toFixed(0)}%) and volume are low. Consider removing or redesigning this dish.`;
          confidence = "LOW";
        }
      }

      const suggestedPrice = parseFloat((sellPrice * (1 + bumpPct / 100)).toFixed(2));
      const changeAmt = parseFloat((suggestedPrice - sellPrice).toFixed(2));
      const projectedMarginPct =
        unitFoodCost > 0 && suggestedPrice > 0
          ? parseFloat(((suggestedPrice - unitFoodCost) / suggestedPrice * 100).toFixed(1))
          : marginPct;
      const revenueImpact = parseFloat((changeAmt * quantity).toFixed(2));

      return {
        itemId: item.itemId,
        name: item.name,
        categoryName: item.categoryName,
        class: cls,
        currentPrice: sellPrice,
        suggestedPrice,
        changeAmt,
        changePct: bumpPct,
        currentMarginPct: marginPct,
        projectedMarginPct,
        currentRevenue: revenue,
        revenueImpact,
        quantity,
        reason,
        rationale,
        confidence,
      };
    })
    .sort((a, b) => Math.abs(b.revenueImpact) - Math.abs(a.revenueImpact));
}

function monthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function MenuPriceAdvisor() {
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [items, setItems] = useState<MenuAnalyticsItemRow[] | null>(null);
  const [pl, setPl] = useState<PlSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [eng, plData] = await Promise.all([
        getMenuEngineering(from, to),
        fetchPlSummary(from, to),
      ]);
      setItems(eng.items);
      setPl(plData);
    } catch (e) {
      setItems(null);
      setPl(null);
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { void load(); }, [load]);

  const advice = useMemo(() => (items ? computePriceAdvice(items, pl) : []), [items, pl]);
  const actionable = advice.filter((a) => REASON_META[a.reason].action);
  const totalImpact = actionable.reduce((s, a) => s + a.revenueImpact, 0);

  const [filter, setFilter] = useState<"actionable" | "all">("actionable");
  const visible = filter === "all" ? advice : actionable;

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Menu"
        title="Price advisor"
        subtitle="Suggested prices per dish based on sales class, food cost, and overall business margins."
        action={
          <Link to="/menu/engineering">
            <Button variant="secondary">← Menu engineering</Button>
          </Link>
        }
      />

      {error && <Alert variant="error">{error}</Alert>}

      {/* Date filter */}
      <Card>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] items-end">
          <label className="field-label">
            From
            <input type="date" className="field-input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="field-label">
            To
            <input type="date" className="field-input" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <Button onClick={() => void load()} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </Button>
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner label="Analysing menu…" />
        </div>
      ) : !items || advice.length === 0 ? (
        <EmptyState
          title="No data to advise on"
          description="Make sure your menu items have food costs set and POS sales exist for the selected period."
        />
      ) : (
        <>
          {/* Summary row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryTile
              label="Potential uplift"
              value={`+${fmt(Math.round(totalImpact / 50) * 50)}`}
              sub={`${actionable.length} price change${actionable.length !== 1 ? "s" : ""}`}
              highlight
            />
            <SummaryTile
              label="Items analysed"
              value={String(advice.length)}
              sub="classified dishes"
            />
            {pl && (
              <>
                <SummaryTile
                  label="Net margin"
                  value={`${pl.margins.netMarginPct.toFixed(1)}%`}
                  sub={`target 8% · revenue ${fmt(pl.totals.netRevenue)}`}
                  status={
                    pl.margins.netMarginPct < 0 ? "bad"
                    : pl.margins.netMarginPct < 5 ? "warn"
                    : "good"
                  }
                />
                <SummaryTile
                  label="Food cost"
                  value={`${(pl.totals.netRevenue > 0 ? (pl.totals.cogs / pl.totals.netRevenue) * 100 : 0).toFixed(1)}%`}
                  sub="target ≤ 35%"
                  status={
                    pl.totals.netRevenue > 0 && (pl.totals.cogs / pl.totals.netRevenue) * 100 > 38 ? "bad"
                    : pl.totals.netRevenue > 0 && (pl.totals.cogs / pl.totals.netRevenue) * 100 > 35 ? "warn"
                    : "good"
                  }
                />
              </>
            )}
          </div>

          {/* Business health strip */}
          {pl && pl.totals.netRevenue > 0 && (
            <BusinessHealthStrip pl={pl} totalRevenueImpact={totalImpact} />
          )}

          {/* Filter tabs */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex gap-1 rounded-lg border border-black/10 p-0.5 bg-white w-fit">
              {(["actionable", "all"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 text-sm rounded-md font-medium transition ${
                    filter === f
                      ? "bg-[var(--color-saffron)] text-white"
                      : "text-[var(--color-ink)] hover:bg-black/5"
                  }`}
                >
                  {f === "actionable" ? `Price changes (${actionable.length})` : `All items (${advice.length})`}
                </button>
              ))}
            </div>
            <p className="text-xs text-[var(--color-muted)] hidden sm:block">
              Sorted by revenue impact · bump sizes scale with business health
            </p>
          </div>

          {/* Item list */}
          <Card className="!p-0 overflow-hidden">
            {/* Column headers */}
            <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-2.5 text-xs font-semibold uppercase text-[var(--color-muted)] border-b border-black/[0.06]">
              <span>Item</span>
              <span className="w-36 text-right">Price change</span>
              <span className="w-28 text-right">Margin impact</span>
              <span className="w-24 text-right">Revenue +/-</span>
            </div>

            <div className="divide-y divide-black/[0.06]">
              {visible.map((a) => (
                <AdviceRow key={a.itemId ?? a.name} a={a} />
              ))}
            </div>
          </Card>

          <p className="text-xs text-[var(--color-muted)] text-center">
            * Revenue impact assumes the same sales volume at the new price. Monitor demand for 2 weeks after any change.
          </p>
        </>
      )}
    </div>
  );
}

// ─── Summary tile ─────────────────────────────────────────────────────────────

function SummaryTile({
  label,
  value,
  sub,
  highlight,
  status,
}: {
  label: string;
  value: string;
  sub: string;
  highlight?: boolean;
  status?: "good" | "warn" | "bad";
}) {
  const statusColor =
    status === "bad"  ? "text-red-600"
    : status === "warn" ? "text-amber-600"
    : status === "good" ? "text-emerald-600"
    : "text-[var(--color-ink)]";

  return (
    <Card className={`!py-3 !px-4 ${highlight ? "border-[var(--color-saffron)]/30 bg-[var(--color-saffron)]/5" : ""}`}>
      <p className="text-xs text-[var(--color-muted)] font-medium mb-1">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${highlight ? "text-[var(--color-saffron)]" : statusColor}`}>
        {value}
      </p>
      <p className="text-xs text-[var(--color-muted)] mt-0.5">{sub}</p>
    </Card>
  );
}

// ─── Business health strip ────────────────────────────────────────────────────

const TARGET_NET_MARGIN = 8;

function BusinessHealthStrip({ pl, totalRevenueImpact }: { pl: PlSummary; totalRevenueImpact: number }) {
  const { netMarginPct, grossMarginPct } = pl.margins;
  const { netRevenue, netProfit, cogs, operatingExpenses, labor } = pl.totals;
  const { status } = businessUrgency(pl);

  const targetProfit = (netRevenue * TARGET_NET_MARGIN) / 100;
  const gap = Math.max(0, targetProfit - netProfit);
  const gapAfter = Math.max(0, gap - totalRevenueImpact);

  const statusMeta = {
    critical: { label: "Loss-making",  bg: "bg-red-50 border-red-200",       text: "text-red-700",     dot: "bg-red-500"     },
    poor:     { label: "Below target", bg: "bg-amber-50 border-amber-200",    text: "text-amber-700",   dot: "bg-amber-500"   },
    ok:       { label: "On track",     bg: "bg-blue-50 border-blue-200",      text: "text-blue-700",    dot: "bg-blue-500"    },
    healthy:  { label: "Healthy",      bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-500" },
  }[status];

  const expenses = [
    { label: "Food cost", value: cogs,               pct: netRevenue > 0 ? (cogs / netRevenue) * 100 : 0,               target: 35 },
    { label: "Labor",     value: labor,               pct: netRevenue > 0 ? (labor / netRevenue) * 100 : 0,               target: 30 },
    { label: "OpEx",      value: operatingExpenses,  pct: netRevenue > 0 ? (operatingExpenses / netRevenue) * 100 : 0,   target: 20 },
  ].filter((e) => e.value > 0);

  return (
    <div className={`rounded-xl border px-4 py-3 ${statusMeta.bg}`}>
      <div className="flex flex-wrap gap-4 items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2 h-2 rounded-full ${statusMeta.dot}`} />
            <span className={`text-xs font-semibold uppercase tracking-wide ${statusMeta.text}`}>
              {statusMeta.label} · Net margin {netMarginPct.toFixed(1)}% (target {TARGET_NET_MARGIN}%)
            </span>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-[var(--color-muted)]">
            <span>Revenue <strong className="text-[var(--color-ink)]">{fmt(netRevenue)}</strong></span>
            <span>Net profit <strong className={netProfit < 0 ? "text-red-600" : "text-[var(--color-ink)]"}>{netProfit < 0 ? `(${fmt(-netProfit)})` : fmt(netProfit)}</strong></span>
            <span>Gross margin <strong className="text-[var(--color-ink)]">{grossMarginPct.toFixed(1)}%</strong></span>
          </div>
          {expenses.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs mt-1.5">
              {expenses.map((e) => (
                <span key={e.label} className={e.pct > e.target ? "text-red-600 font-medium" : "text-[var(--color-muted)]"}>
                  {e.label}: {e.pct.toFixed(0)}%{e.pct > e.target ? ` ↑ over ${e.target}% target` : ""}
                </span>
              ))}
            </div>
          )}
        </div>
        {gap > 0 && (
          <div className="text-right shrink-0">
            <p className="text-xs text-[var(--color-muted)]">Gap to {TARGET_NET_MARGIN}% net margin</p>
            <p className="font-bold tabular-nums">{fmt(Math.round(gap / 10) * 10)}</p>
            {totalRevenueImpact > 0 && (
              <p className="text-xs text-emerald-600 font-medium mt-0.5">
                Price changes cover {fmt(Math.round(totalRevenueImpact / 10) * 10)}
                {gapAfter < 50 ? " — gap closed ✓" : `, ${fmt(Math.round(gapAfter / 10) * 10)} remains`}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Reason & class metadata ─────────────────────────────────────────────────

const REASON_META: Record<PriceReason, { label: string; action: boolean; color: string; bg: string }> = {
  RAISE_PRICE:      { label: "Raise price",     action: true,  color: "text-emerald-700", bg: "bg-emerald-50" },
  TEST_PRICE:       { label: "Test price",       action: true,  color: "text-amber-700",   bg: "bg-amber-50"   },
  FIX_FOOD_COST:    { label: "Fix food cost",    action: false, color: "text-red-700",     bg: "bg-red-50"     },
  REVIEW_FOOD_COST: { label: "Review food cost", action: false, color: "text-red-700",     bg: "bg-red-50"     },
  KEEP_PRICE:       { label: "Hold price",       action: false, color: "text-[var(--color-muted)]", bg: "bg-black/5" },
  PROMOTE:          { label: "Promote",          action: false, color: "text-blue-700",    bg: "bg-blue-50"    },
  REMOVE_OR_REWORK: { label: "Remove / rework",  action: false, color: "text-[var(--color-muted)]", bg: "bg-black/5" },
};

const CLASS_BADGE: Record<string, string> = {
  STAR:      "text-emerald-700 bg-emerald-50",
  PLOWHORSE: "text-amber-700   bg-amber-50",
  PUZZLE:    "text-blue-700    bg-blue-50",
  DOG:       "text-red-700     bg-red-50",
};

// ─── Advice row ───────────────────────────────────────────────────────────────

function AdviceRow({ a }: { a: PriceAdviceItem }) {
  const meta = REASON_META[a.reason];
  const classBadge = CLASS_BADGE[a.class] ?? "text-[var(--color-muted)] bg-black/5";

  return (
    <div className="grid sm:grid-cols-[1fr_auto_auto_auto] gap-3 sm:gap-4 items-start px-5 py-4">
      {/* Name + badges + rationale */}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 mb-1">
          <span className="font-semibold text-sm">{a.name}</span>
          <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${classBadge}`}>
            {a.class.charAt(0) + a.class.slice(1).toLowerCase()}
          </span>
          <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${meta.bg} ${meta.color}`}>
            {meta.label}
          </span>
          {a.confidence === "HIGH" && (
            <span className="text-xs text-green-700 bg-green-50 rounded-full px-2 py-0.5">● Reliable</span>
          )}
          {a.confidence === "LOW" && (
            <span className="text-xs text-[var(--color-muted)] bg-black/5 rounded-full px-2 py-0.5">● Low signal</span>
          )}
        </div>
        <p className="text-xs text-[var(--color-muted)] leading-snug">{a.rationale}</p>
        {a.categoryName && (
          <p className="text-xs text-[var(--color-muted)] mt-1 opacity-60">{a.categoryName}</p>
        )}
      </div>

      {/* Price */}
      <div className="w-36 text-right shrink-0">
        {a.changePct > 0 ? (
          <>
            <p className="font-bold text-sm tabular-nums">
              {fmt(a.currentPrice)} → {fmt(a.suggestedPrice)}
            </p>
            <p className="text-xs text-emerald-600 font-medium">+{fmt(a.changeAmt)} (+{a.changePct}%)</p>
          </>
        ) : (
          <p className="text-sm font-semibold tabular-nums text-[var(--color-muted)]">{fmt(a.currentPrice)}</p>
        )}
        <p className="text-xs text-[var(--color-muted)] mt-0.5">{a.quantity}× sold</p>
      </div>

      {/* Margin */}
      <div className="w-28 text-right shrink-0">
        {a.changePct > 0 && a.projectedMarginPct !== a.currentMarginPct ? (
          <>
            <p className="font-semibold text-sm tabular-nums">
              {a.currentMarginPct.toFixed(0)}% → {a.projectedMarginPct.toFixed(0)}%
            </p>
            <p className="text-xs text-emerald-600">
              +{(a.projectedMarginPct - a.currentMarginPct).toFixed(1)} pp
            </p>
          </>
        ) : (
          <p className="text-sm font-semibold tabular-nums text-[var(--color-muted)]">
            {a.currentMarginPct.toFixed(0)}%
          </p>
        )}
      </div>

      {/* Revenue impact */}
      <div className="w-24 text-right shrink-0">
        {a.revenueImpact !== 0 ? (
          <p className={`font-bold text-sm tabular-nums ${a.revenueImpact > 0 ? "text-emerald-600" : "text-red-600"}`}>
            {a.revenueImpact > 0 ? "+" : ""}
            {fmt(Math.round(a.revenueImpact / 10) * 10)}
          </p>
        ) : (
          <p className="text-sm text-[var(--color-muted)]">—</p>
        )}
      </div>
    </div>
  );
}
