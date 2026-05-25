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
