import { useEffect, useState } from "react";
import { getWeekForecast, type ForecastDay, type ForecastResponse } from "../api/forecast";
import { fmt } from "../lib/calc";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Spinner } from "../components/ui/Spinner";
import { EmptyState } from "../components/ui/EmptyState";
import { Alert } from "../components/ui/Alert";

const DAY_OPTIONS = [
  { label: "7 days", value: 7 },
  { label: "14 days", value: 14 },
];

export function ForecastPage() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getWeekForecast(days)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load forecast"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [days]);

  const forecast = data?.days ?? null;
  const weekSummary = data?.weekSummary ?? null;
  const hasSomeData = forecast?.some((d) => d.predictedSales != null);

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Analytics"
        title="Sales forecast"
        subtitle="Predicted revenue per weekday · exponential weighted average of last 8 weeks"
        action={
          <div className="flex gap-1 rounded-lg border border-black/10 p-0.5 bg-white">
            {DAY_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => setDays(o.value)}
                className={`px-3 py-1 text-sm rounded-md font-medium transition ${
                  days === o.value
                    ? "bg-[var(--color-saffron)] text-white"
                    : "text-[var(--color-ink)] hover:bg-black/5"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        }
      />

      {loading && (
        <div className="flex justify-center py-16">
          <Spinner label="Loading forecast…" />
        </div>
      )}

      {!loading && error && <Alert variant="error">{error}</Alert>}

      {!loading && !error && !hasSomeData && (
        <EmptyState
          title="Not enough history yet"
          description="Forecast appears once you have at least 3 weeks of locked shift reports for any weekday."
        />
      )}

      {!loading && !error && hasSomeData && forecast && weekSummary && (
        <>
          {/* Weekly total */}
          <WeeklySummaryCard summary={weekSummary} days={days} />

          {/* Bar chart */}
          <BarChart days={forecast} />

          {/* Day-by-day table */}
          <Card className="!p-0 overflow-hidden divide-y divide-black/[0.06]">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-2.5 text-xs font-semibold uppercase text-[var(--color-muted)]">
              <span>Day</span>
              <span className="text-right w-32">Predicted</span>
              <span className="text-right w-36 hidden sm:block">Channels</span>
              <span className="text-right w-20">Signal</span>
            </div>

            {forecast.map((day) => (
              <div
                key={day.date}
                className={`grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-5 py-4${day.isToday ? " bg-amber-50/60" : ""}`}
              >
                {/* Day + sparkline */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <p className={`font-semibold${day.isToday ? " text-[var(--color-saffron)]" : ""}`}>
                      {day.dayName}
                      {day.isToday && (
                        <span className="ml-2 text-xs font-normal text-[var(--color-muted)]">today</span>
                      )}
                    </p>
                    <p className="text-xs text-[var(--color-muted)]">{day.date}</p>
                  </div>
                  {day.history.length >= 2 && (
                    <Sparkline values={day.history} isToday={day.isToday} />
                  )}
                </div>

                {day.predictedSales != null ? (
                  <>
                    {/* Predicted + range */}
                    <div className="text-right w-32">
                      <p className="font-bold tabular-nums">
                        ~{fmt(Math.round(day.predictedSales / 50) * 50)}
                        {day.errorPct != null && day.errorPct > 0 && (
                          <span className="text-xs font-normal text-[var(--color-muted)] ml-1">
                            ±{Math.round(day.errorPct)}%
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-[var(--color-muted)] tabular-nums">
                        {fmt(day.p25!)} – {fmt(day.p75!)}
                        <span className="ml-1 opacity-60">typical</span>
                      </p>
                      {day.median != null && Math.abs(day.median - day.predictedSales) / day.predictedSales > 0.08 && (
                        <p className="text-xs text-amber-600 tabular-nums">
                          median {fmt(Math.round(day.median / 50) * 50)}
                        </p>
                      )}
                    </div>

                    {/* Channel split */}
                    <div className="w-36 hidden sm:block">
                      {day.cashPct != null && (
                        <ChannelBar cashPct={day.cashPct} cardPct={day.cardPct!} deliveryPct={day.deliveryPct!} />
                      )}
                    </div>

                    {/* Trend + confidence */}
                    <div className="flex flex-col items-end gap-1 w-20">
                      <TrendBadge trend={day.trend} />
                      <ConfidenceBadge confidence={day.confidence} />
                    </div>
                  </>
                ) : (
                  <span className="col-span-3 text-sm text-[var(--color-muted)]">
                    Not enough data ({day.sampleSize}/3 weeks)
                  </span>
                )}
              </div>
            ))}
          </Card>

          {/* Legend */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 justify-center items-center">
            <ChannelLegend />
            <p className="text-xs text-[var(--color-muted)] text-center">
              Weighted avg · recent weeks count more · p25–p75 = typical range · median shown when skewed &gt;8%
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Weekly summary ──────────────────────────────────────────────────────────

function WeeklySummaryCard({
  summary,
  days,
}: {
  summary: ForecastResponse["weekSummary"];
  days: number;
}) {
  const totalRounded = Math.round(summary.total / 100) * 100;
  const cashAmt = Math.round(summary.cash / 100) * 100;
  const cardAmt = Math.round(summary.card / 100) * 100;
  const delivAmt = Math.round(summary.delivery / 100) * 100;
  const avg = Math.round(summary.avgPerDay / 50) * 50;

  return (
    <Card className="!p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-[var(--color-muted)] mb-1">
            {days}-day total forecast
          </p>
          <p className="text-3xl font-bold tabular-nums">~{fmt(totalRounded)}</p>
          <p className="text-sm text-[var(--color-muted)] mt-0.5 tabular-nums">
            ~{fmt(avg)} avg/day · {summary.daysWithData} day{summary.daysWithData !== 1 ? "s" : ""} with data
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-[var(--color-muted)] font-medium mb-0.5">Cash</p>
            <div className="w-3 h-3 rounded-sm bg-emerald-400 mx-auto mb-1" />
            <p className="font-bold tabular-nums text-sm">~{fmt(cashAmt)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--color-muted)] font-medium mb-0.5">Card</p>
            <div className="w-3 h-3 rounded-sm bg-blue-400 mx-auto mb-1" />
            <p className="font-bold tabular-nums text-sm">~{fmt(cardAmt)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--color-muted)] font-medium mb-0.5">Delivery</p>
            <div className="w-3 h-3 rounded-sm bg-amber-400 mx-auto mb-1" />
            <p className="font-bold tabular-nums text-sm">~{fmt(delivAmt)}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Bar chart ───────────────────────────────────────────────────────────────

function BarChart({ days }: { days: ForecastDay[] }) {
  const maxVal = Math.max(...days.filter((d) => d.predictedSales != null).map((d) => d.predictedSales!), 1);
  return (
    <Card className="!p-5">
      <p className="text-xs font-semibold uppercase text-[var(--color-muted)] mb-4">Revenue outlook</p>
      <div className="space-y-2">
        {days.map((day) => (
          <div key={day.date} className="flex items-center gap-3">
            <span className="text-xs w-7 text-right shrink-0 font-medium text-[var(--color-muted)]">
              {day.dayName.slice(0, 3)}
            </span>
            <div className="flex-1 bg-black/5 rounded-full h-5 overflow-hidden relative">
              {/* p25–p75 band */}
              {day.p25 != null && day.p75 != null && (
                <div
                  className="absolute top-0 h-full bg-black/5 rounded-full"
                  style={{
                    left: `${(day.p25 / maxVal) * 100}%`,
                    width: `${((day.p75 - day.p25) / maxVal) * 100}%`,
                  }}
                />
              )}
              {/* Predicted bar */}
              {day.predictedSales != null && (
                <div
                  className={`h-full rounded-full ${day.isToday ? "bg-[var(--color-saffron)]" : "bg-[var(--color-ink)]/30"}`}
                  style={{ width: `${(day.predictedSales / maxVal) * 100}%` }}
                />
              )}
            </div>
            <span className="text-xs font-semibold tabular-nums w-20 text-right shrink-0">
              {day.predictedSales != null
                ? `~${fmt(Math.round(day.predictedSales / 50) * 50)}`
                : "—"}
            </span>
          </div>
        ))}
      </div>
      <p className="text-xs text-[var(--color-muted)] mt-3">
        Shaded band = typical range (p25–p75) · bar = weighted prediction
      </p>
    </Card>
  );
}

// ─── Sparkline ───────────────────────────────────────────────────────────────

function Sparkline({ values, isToday }: { values: number[]; isToday: boolean }) {
  const max = Math.max(...values, 1);
  const W = 48;
  const H = 18;
  const barW = Math.max(1, W / values.length - 1);
  return (
    <svg width={W} height={H} className="shrink-0 overflow-visible">
      {values.map((v, idx) => {
        const barH = Math.max(2, (v / max) * H);
        const x = idx * (barW + 1);
        const isLast = idx === values.length - 1;
        return (
          <rect
            key={idx}
            x={x}
            y={H - barH}
            width={barW}
            height={barH}
            rx={1}
            className={
              isLast && isToday
                ? "fill-[var(--color-saffron)]/70"
                : "fill-[var(--color-ink)]/15"
            }
          />
        );
      })}
    </svg>
  );
}

// ─── Channel bar ─────────────────────────────────────────────────────────────

function ChannelBar({ cashPct, cardPct, deliveryPct }: { cashPct: number; cardPct: number; deliveryPct: number }) {
  return (
    <div>
      <div className="flex h-2 rounded-full overflow-hidden gap-px">
        {cashPct > 0 && <div className="bg-emerald-400" style={{ width: `${cashPct}%` }} />}
        {cardPct > 0 && <div className="bg-blue-400"    style={{ width: `${cardPct}%` }} />}
        {deliveryPct > 0 && <div className="bg-amber-400" style={{ width: `${deliveryPct}%` }} />}
      </div>
      <p className="text-xs text-[var(--color-muted)] mt-0.5 tabular-nums">
        {cashPct}% · {cardPct}% · {deliveryPct}%
      </p>
    </div>
  );
}

function ChannelLegend() {
  return (
    <div className="flex items-center gap-4 text-xs text-[var(--color-muted)]">
      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" />Cash</span>
      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-400 inline-block" />Card</span>
      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" />Delivery</span>
    </div>
  );
}

// ─── Badges ──────────────────────────────────────────────────────────────────

function TrendBadge({ trend }: { trend?: "UP" | "DOWN" | "FLAT" }) {
  if (trend === "UP")   return <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-green-700 bg-green-50 rounded-full px-2 py-0.5">↑ Up</span>;
  if (trend === "DOWN") return <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-red-700 bg-red-50 rounded-full px-2 py-0.5">↓ Down</span>;
  return <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-[var(--color-muted)] bg-black/5 rounded-full px-2 py-0.5">→ Flat</span>;
}

function ConfidenceBadge({ confidence }: { confidence?: "HIGH" | "MEDIUM" | "LOW" }) {
  if (confidence === "HIGH") return <span className="text-xs text-green-700 bg-green-50 rounded-full px-2 py-0.5 font-medium">● Reliable</span>;
  if (confidence === "LOW")  return <span className="text-xs text-amber-700 bg-amber-50 rounded-full px-2 py-0.5 font-medium">● Variable</span>;
  return <span className="text-xs text-[var(--color-muted)] bg-black/5 rounded-full px-2 py-0.5 font-medium">● Moderate</span>;
}
