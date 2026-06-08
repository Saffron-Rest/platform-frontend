import { useEffect, useState } from "react";
import { getWeekForecast, type ForecastDay } from "../api/forecast";
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
  const [forecast, setForecast] = useState<ForecastDay[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getWeekForecast(days)
      .then((d) => { if (!cancelled) setForecast(d); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load forecast"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [days]);

  const hasSomeData = forecast?.some((d) => d.predictedSales != null);

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Analytics"
        title="Sales forecast"
        subtitle="Predicted revenue per weekday based on the last 8 weeks of locked reports"
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

      {!loading && !error && hasSomeData && forecast && (
        <>
          <BarChart days={forecast} />

          <Card className="!p-0 overflow-hidden divide-y divide-black/[0.06]">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-2.5 text-xs font-semibold uppercase text-[var(--color-muted)]">
              <span>Day</span>
              <span className="text-right w-28">Predicted</span>
              <span className="text-right w-36 hidden sm:block">Channels</span>
              <span className="text-right w-20">Signal</span>
            </div>

            {forecast.map((day) => (
              <div
                key={day.date}
                className={`grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-5 py-4${day.isToday ? " bg-amber-50/60" : ""}`}
              >
                <div>
                  <p className={`font-semibold${day.isToday ? " text-[var(--color-saffron)]" : ""}`}>
                    {day.dayName}
                    {day.isToday && (
                      <span className="ml-2 text-xs font-normal text-[var(--color-muted)]">today</span>
                    )}
                  </p>
                  <p className="text-xs text-[var(--color-muted)]">{day.date}</p>
                </div>

                {day.predictedSales != null ? (
                  <>
                    <div className="text-right w-28">
                      <p className="font-bold tabular-nums">
                        ~{fmt(Math.round(day.predictedSales / 50) * 50)}
                      </p>
                      <p className="text-xs text-[var(--color-muted)] tabular-nums">
                        {fmt(day.low!)} – {fmt(day.high!)}
                      </p>
                    </div>

                    <div className="w-36 hidden sm:block">
                      {day.cashPct != null && (
                        <ChannelBar cashPct={day.cashPct} cardPct={day.cardPct!} deliveryPct={day.deliveryPct!} />
                      )}
                    </div>

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

          <div className="flex flex-wrap gap-x-6 gap-y-1 justify-center">
            <ChannelLegend />
            <p className="text-xs text-[var(--color-muted)] text-center">
              Weighted average (recent weeks count more) · Confidence based on data consistency · Trend compares newest vs older weeks
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function BarChart({ days }: { days: ForecastDay[] }) {
  const maxVal = Math.max(...days.filter((d) => d.predictedSales != null).map((d) => d.predictedSales!), 1);
  return (
    <Card className="!p-5">
      <p className="text-xs font-semibold uppercase text-[var(--color-muted)] mb-4">Revenue outlook</p>
      <div className="space-y-2.5">
        {days.map((day) => (
          <div key={day.date} className="flex items-center gap-3">
            <span className="text-xs w-7 text-right text-[var(--color-muted)] shrink-0 font-medium">
              {day.dayName.slice(0, 3)}
            </span>
            <div className="flex-1 bg-black/5 rounded-full h-5 overflow-hidden">
              {day.predictedSales != null && (
                <div
                  className={`h-full rounded-full ${day.isToday ? "bg-[var(--color-saffron)]" : "bg-[var(--color-ink)]/25"}`}
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
    </Card>
  );
}

function ChannelBar({ cashPct, cardPct, deliveryPct }: { cashPct: number; cardPct: number; deliveryPct: number }) {
  return (
    <div>
      <div className="flex h-2 rounded-full overflow-hidden gap-px">
        {cashPct > 0 && (
          <div className="bg-emerald-400" style={{ width: `${cashPct}%` }} />
        )}
        {cardPct > 0 && (
          <div className="bg-blue-400" style={{ width: `${cardPct}%` }} />
        )}
        {deliveryPct > 0 && (
          <div className="bg-amber-400" style={{ width: `${deliveryPct}%` }} />
        )}
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
      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" /> Cash</span>
      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-400 inline-block" /> Card</span>
      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" /> Delivery</span>
    </div>
  );
}

function TrendBadge({ trend }: { trend?: "UP" | "DOWN" | "FLAT" }) {
  if (trend === "UP") return (
    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-green-700 bg-green-50 rounded-full px-2 py-0.5">↑ Up</span>
  );
  if (trend === "DOWN") return (
    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-red-700 bg-red-50 rounded-full px-2 py-0.5">↓ Down</span>
  );
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-[var(--color-muted)] bg-black/5 rounded-full px-2 py-0.5">→ Flat</span>
  );
}

function ConfidenceBadge({ confidence }: { confidence?: "HIGH" | "MEDIUM" | "LOW" }) {
  if (confidence === "HIGH") return (
    <span className="text-xs text-green-700 bg-green-50 rounded-full px-2 py-0.5 font-medium">● Reliable</span>
  );
  if (confidence === "LOW") return (
    <span className="text-xs text-amber-700 bg-amber-50 rounded-full px-2 py-0.5 font-medium">● Variable</span>
  );
  return (
    <span className="text-xs text-[var(--color-muted)] bg-black/5 rounded-full px-2 py-0.5 font-medium">● Moderate</span>
  );
}
