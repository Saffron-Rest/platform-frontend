import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  getMenuEngineering,
  type MenuEngineering as MenuEngineeringData,
  type MenuAnalyticsItemRow,
  type MenuSuggestion,
} from "../api/menu";
import { fmt } from "../lib/calc";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";
import { Spinner } from "../components/ui/Spinner";
import { EmptyState } from "../components/ui/EmptyState";

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

function computePriceAdvice(items: MenuAnalyticsItemRow[]): PriceAdviceItem[] {
  const classified = items.filter(
    (i) =>
      i.class &&
      ["STAR", "PLOWHORSE", "PUZZLE", "DOG"].includes(i.class) &&
      i.sellPrice > 0
  );

  return classified
    .map((item): PriceAdviceItem => {
      const cls = item.class!;
      const { sellPrice, unitFoodCost, quantity, marginPct, foodCostPct, revenue } = item;

      let bumpPct = 0;
      let reason: PriceReason = "KEEP_PRICE";
      let rationale = "";
      let confidence: PriceAdviceItem["confidence"] = "MEDIUM";

      if (cls === "PLOWHORSE") {
        if (foodCostPct <= 42) {
          bumpPct = 5;
          reason = "RAISE_PRICE";
          rationale = `Bestseller with only ${marginPct.toFixed(0)}% margin — a 5% bump across ${quantity} sales adds revenue with minimal demand risk.`;
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
          bumpPct = 3;
          reason = "RAISE_PRICE";
          rationale = `${marginPct.toFixed(0)}% margin star — loyal demand supports a cautious 3% increase to widen margin further.`;
          confidence = "MEDIUM";
        } else {
          reason = "KEEP_PRICE";
          rationale = "Healthy star — margin and volume are both strong. Protect demand by holding price.";
          confidence = "HIGH";
        }
      } else if (cls === "PUZZLE") {
        reason = "PROMOTE";
        rationale = `Margin is strong at ${marginPct.toFixed(0)}% but volume is low — push visibility, not price.`;
        confidence = "MEDIUM";
      } else if (cls === "DOG") {
        if (foodCostPct < 35 && sellPrice > 10) {
          bumpPct = 10;
          reason = "TEST_PRICE";
          rationale = `Food cost is manageable at ${foodCostPct.toFixed(0)}% — the item may be underpriced. Try a 10% price test.`;
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

const QUADRANT_META = {
  star: {
    title: "Stars",
    subtitle: "High margin · high volume",
    description: "Your winners. Protect them — keep recipes consistent, train staff on them, and consider featuring them on the menu cover.",
    color: "bg-emerald-50 border-emerald-200",
    titleColor: "text-emerald-700",
    dot: "fill-emerald-600",
  },
  plowhorse: {
    title: "Plowhorses",
    subtitle: "Low margin · high volume",
    description: "Popular but underpriced. Small price bumps or portion reviews here move serious money — the volume amplifies every cent.",
    color: "bg-amber-50 border-amber-200",
    titleColor: "text-amber-700",
    dot: "fill-amber-500",
  },
  puzzle: {
    title: "Puzzles",
    subtitle: "High margin · low volume",
    description: "Profitable but not selling. Try menu placement, server recommendations, paired deals, or photos to push them.",
    color: "bg-blue-50 border-blue-200",
    titleColor: "text-blue-700",
    dot: "fill-blue-600",
  },
  dog: {
    title: "Dogs",
    subtitle: "Low margin · low volume",
    description: "Underperformers on both axes. Either drop them, reprice aggressively, or rework them into something with appeal.",
    color: "bg-red-50 border-red-200",
    titleColor: "text-red-700",
    dot: "fill-red-500",
  },
} as const;

type Quadrant = keyof typeof QUADRANT_META;

export function MenuEngineering() {
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [data, setData] = useState<MenuEngineeringData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await getMenuEngineering(from, to));
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Menu engineering"
        subtitle="Classifies every dish on margin × popularity and surfaces actions worth taking this week."
        action={
          <Link to="/menu">
            <Button variant="secondary">← Menu analytics</Button>
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
      </Card>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner label="Classifying dishes…" />
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title="Not enough data yet"
          description="The classifier needs sales with food cost set on each item. Make sure your menu has food costs filled in and the POS webhook is sending sales."
        />
      ) : (
        <>
          <PriceAdvisorPanel items={data.items} />
          <SuggestionsPanel suggestions={data.suggestions} />
          <MatrixView data={data} />
          <QuadrantLists data={data} />
          <UnclassifiedList items={data.classified.unclassified} />
        </>
      )}
    </div>
  );
}

function SuggestionsPanel({ suggestions }: { suggestions: MenuSuggestion[] }) {
  if (suggestions.length === 0) {
    return (
      <Alert variant="success">
        No urgent actions — your menu is balanced. Re-check in a week as patterns shift.
      </Alert>
    );
  }
  return (
    <Card>
      <h3 className="font-semibold mb-3">Suggested actions</h3>
      <ul className="space-y-3">
        {suggestions.slice(0, 8).map((s, idx) => (
          <li
            key={idx}
            className={`flex gap-3 rounded-xl p-3 border ${
              s.severity === "high"
                ? "border-red-200 bg-red-50"
                : s.severity === "medium"
                ? "border-amber-200 bg-amber-50"
                : "border-black/10 bg-white"
            }`}
          >
            <div className="shrink-0 mt-0.5">
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  s.severity === "high"
                    ? "bg-red-500"
                    : s.severity === "medium"
                    ? "bg-amber-500"
                    : "bg-gray-400"
                }`}
              />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm">{s.title}</p>
              <p className="text-sm text-[var(--color-muted)] mt-0.5">{s.detail}</p>
              {s.categoryName && (
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  {s.categoryName}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
      {suggestions.length > 8 && (
        <p className="text-xs text-[var(--color-muted)] mt-2">
          Showing top 8 of {suggestions.length}.
        </p>
      )}
    </Card>
  );
}

function MatrixView({ data }: { data: MenuEngineeringData }) {
  // Classifiable items only (skip unclassified — they have no food cost).
  const items = useMemo(
    () =>
      data.items.filter(
        (i) =>
          !i.unmatched &&
          i.foodCost > 0 &&
          (i.class === "STAR" ||
            i.class === "PLOWHORSE" ||
            i.class === "PUZZLE" ||
            i.class === "DOG")
      ),
    [data.items]
  );
  const maxQty = items.reduce((m, i) => Math.max(m, i.quantity), 0) || 1;
  const maxMarginPct = items.reduce(
    (m, i) => Math.max(m, Number(i.marginPct ?? 0)),
    100
  );

  return (
    <Card>
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <h3 className="font-semibold">Margin × volume matrix</h3>
        <p className="text-xs text-[var(--color-muted)]">
          Median qty: <strong>{Math.round(data.medianQty)}</strong> · Median margin:{" "}
          <strong>{Number(data.medianMarginPct ?? 0).toFixed(1)}%</strong>
        </p>
      </div>
      <div className="relative aspect-[4/3] rounded-xl border border-black/10 bg-white overflow-hidden">
        {/* Quadrant backgrounds */}
        <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
          <div className="bg-blue-50/60 border-r border-b border-black/10" />
          <div className="bg-emerald-50/60 border-b border-black/10" />
          <div className="bg-red-50/60 border-r border-black/10" />
          <div className="bg-amber-50/60" />
        </div>
        {/* Quadrant labels */}
        <span className="absolute top-2 left-3 text-xs font-semibold text-blue-700">
          Puzzles
        </span>
        <span className="absolute top-2 right-3 text-xs font-semibold text-emerald-700">
          Stars
        </span>
        <span className="absolute bottom-2 left-3 text-xs font-semibold text-red-700">
          Dogs
        </span>
        <span className="absolute bottom-2 right-3 text-xs font-semibold text-amber-700">
          Plowhorses
        </span>
        {/* Items as dots */}
        {items.map((i) => {
          const x = (i.quantity / maxQty) * 100;
          const y = 100 - (Number(i.marginPct ?? 0) / maxMarginPct) * 100;
          const dotColor =
            i.class === "STAR"
              ? "bg-emerald-600"
              : i.class === "PLOWHORSE"
              ? "bg-amber-500"
              : i.class === "PUZZLE"
              ? "bg-blue-600"
              : "bg-red-500";
          return (
            <div
              key={i.itemId ?? i.name}
              className="absolute group"
              style={{ left: `calc(${x}% - 6px)`, top: `calc(${y}% - 6px)` }}
            >
              <div className={`w-3 h-3 rounded-full ${dotColor} shadow-sm`} />
              <div className="hidden group-hover:block absolute z-10 bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs bg-black text-white rounded-md px-2 py-1 shadow-lg pointer-events-none">
                {i.name} · {i.quantity} sold · {Number(i.marginPct).toFixed(0)}% margin
              </div>
            </div>
          );
        })}
        {/* Axis labels */}
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-[var(--color-muted)]">
          ← low volume · high volume →
        </span>
        <span className="absolute top-1/2 -translate-y-1/2 -left-1 rotate-[-90deg] origin-left text-[10px] text-[var(--color-muted)]">
          ← low margin · high margin →
        </span>
      </div>
    </Card>
  );
}

function QuadrantLists({ data }: { data: MenuEngineeringData }) {
  const quadrants: Quadrant[] = ["star", "plowhorse", "puzzle", "dog"];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {quadrants.map((q) => {
        const meta = QUADRANT_META[q];
        const items = data.classified[q];
        return (
          <Card key={q} className={`border ${meta.color}`}>
            <h3 className={`font-semibold ${meta.titleColor}`}>{meta.title}</h3>
            <p className="text-xs text-[var(--color-muted)]">{meta.subtitle}</p>
            <p className="text-sm text-[var(--color-muted)] mt-2 mb-3">
              {meta.description}
            </p>
            {items.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">No items here.</p>
            ) : (
              <ul className="space-y-1.5">
                {items.slice(0, 6).map((i) => (
                  <li
                    key={i.itemId ?? i.name}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="truncate">{i.name}</span>
                    <span className="text-xs text-[var(--color-muted)] tabular-nums shrink-0">
                      {fmt(i.revenue)} · {Number(i.marginPct).toFixed(0)}%
                    </span>
                  </li>
                ))}
                {items.length > 6 && (
                  <li className="text-xs text-[var(--color-muted)]">
                    +{items.length - 6} more
                  </li>
                )}
              </ul>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ─── Price advisor panel ─────────────────────────────────────────────────────

const REASON_META: Record<
  PriceReason,
  { label: string; action: boolean; color: string; bg: string }
> = {
  RAISE_PRICE:       { label: "Raise price",      action: true,  color: "text-emerald-700", bg: "bg-emerald-50" },
  TEST_PRICE:        { label: "Test price +10%",   action: true,  color: "text-amber-700",   bg: "bg-amber-50"   },
  FIX_FOOD_COST:     { label: "Fix food cost",     action: false, color: "text-red-700",     bg: "bg-red-50"     },
  REVIEW_FOOD_COST:  { label: "Review food cost",  action: false, color: "text-red-700",     bg: "bg-red-50"     },
  KEEP_PRICE:        { label: "Hold price",         action: false, color: "text-[var(--color-muted)]", bg: "bg-black/5" },
  PROMOTE:           { label: "Promote",            action: false, color: "text-blue-700",    bg: "bg-blue-50"    },
  REMOVE_OR_REWORK:  { label: "Remove / rework",   action: false, color: "text-[var(--color-muted)]", bg: "bg-black/5" },
};

const CLASS_BADGE: Record<string, string> = {
  STAR:       "text-emerald-700 bg-emerald-50",
  PLOWHORSE:  "text-amber-700   bg-amber-50",
  PUZZLE:     "text-blue-700    bg-blue-50",
  DOG:        "text-red-700     bg-red-50",
};

function PriceAdvisorPanel({ items }: { items: MenuAnalyticsItemRow[] }) {
  const advice = useMemo(() => computePriceAdvice(items), [items]);
  const [showAll, setShowAll] = useState(false);

  const actionable = advice.filter((a) => REASON_META[a.reason].action);
  const totalImpact = actionable.reduce((s, a) => s + a.revenueImpact, 0);

  if (advice.length === 0) return null;

  const visible = showAll ? advice : advice.filter((a) => REASON_META[a.reason].action);

  return (
    <Card>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h3 className="font-semibold text-base">Retail price advisor</h3>
          <p className="text-sm text-[var(--color-muted)] mt-0.5">
            Per-item recommendations based on class, margin, and sales volume.
          </p>
        </div>
        {actionable.length > 0 && (
          <div className="rounded-xl bg-[var(--color-saffron)]/10 border border-[var(--color-saffron)]/20 px-4 py-2.5 text-right">
            <p className="text-xs font-semibold text-[var(--color-saffron)] uppercase tracking-wide">
              Potential uplift
            </p>
            <p className="text-2xl font-bold tabular-nums text-[var(--color-saffron)]">
              +{fmt(Math.round(totalImpact / 50) * 50)}
            </p>
            <p className="text-xs text-[var(--color-muted)]">
              {actionable.length} price change{actionable.length !== 1 ? "s" : ""} · same volume assumed
            </p>
          </div>
        )}
      </div>

      {/* Items */}
      {visible.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">
          No price increases recommended for this period.
        </p>
      ) : (
        <div className="space-y-3">
          {/* Column headers */}
          <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 text-xs font-semibold uppercase text-[var(--color-muted)]">
            <span>Item</span>
            <span className="w-36 text-right">Price change</span>
            <span className="w-28 text-right">Margin impact</span>
            <span className="w-24 text-right">Revenue +/-</span>
          </div>

          {visible.map((a) => {
            const meta = REASON_META[a.reason];
            const classBadge = CLASS_BADGE[a.class] ?? "text-[var(--color-muted)] bg-black/5";
            return (
              <div
                key={a.itemId ?? a.name}
                className="rounded-xl border border-black/[0.07] bg-white px-4 py-3 grid sm:grid-cols-[1fr_auto_auto_auto] gap-3 sm:gap-4 items-start"
              >
                {/* Name + badges + rationale */}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    <span className="font-semibold text-sm truncate">{a.name}</span>
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

                {/* Price change */}
                <div className="w-36 text-right shrink-0">
                  {a.changePct > 0 ? (
                    <>
                      <p className="font-bold text-sm tabular-nums">
                        {fmt(a.currentPrice)} → {fmt(a.suggestedPrice)}
                      </p>
                      <p className="text-xs text-emerald-600 font-medium">
                        +{fmt(a.changeAmt)} (+{a.changePct}%)
                      </p>
                    </>
                  ) : (
                    <p className="text-sm font-semibold tabular-nums text-[var(--color-muted)]">
                      {fmt(a.currentPrice)}
                    </p>
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
                    <p
                      className={`font-bold text-sm tabular-nums ${
                        a.revenueImpact > 0 ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {a.revenueImpact > 0 ? "+" : ""}
                      {fmt(Math.round(a.revenueImpact / 10) * 10)}
                    </p>
                  ) : (
                    <p className="text-sm text-[var(--color-muted)]">—</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Toggle */}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-[var(--color-muted)]">
          * Revenue impact assumes the same sales volume continues at the new price.
          Always monitor demand for 2 weeks after any price change.
        </p>
        {advice.length > actionable.length && (
          <button
            onClick={() => setShowAll((v) => !v)}
            className="text-xs text-[var(--color-saffron)] font-medium hover:underline shrink-0 ml-4"
          >
            {showAll
              ? "Show price changes only"
              : `Show all ${advice.length} items`}
          </button>
        )}
      </div>
    </Card>
  );
}

function UnclassifiedList({ items }: { items: MenuAnalyticsItemRow[] }) {
  if (items.length === 0) return null;
  return (
    <Alert variant="info">
      <strong>{items.length} item{items.length === 1 ? "" : "s"} can't be classified</strong>{" "}
      because they don't have a food cost set yet. Add the food cost in{" "}
      <Link to="/admin/menu" className="underline">
        Menu admin
      </Link>{" "}
      to include them in the matrix.
      <details className="mt-2">
        <summary className="text-sm cursor-pointer">Show items</summary>
        <ul className="mt-2 text-sm space-y-1">
          {items.map((i) => (
            <li key={i.itemId ?? i.name}>
              {i.name} — {fmt(i.revenue)} ({i.quantity} sold)
            </li>
          ))}
        </ul>
      </details>
    </Alert>
  );
}
