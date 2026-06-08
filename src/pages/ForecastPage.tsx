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
        subtitle="Predicted revenue based on the same weekday over the last 8 weeks"
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
        <Card className="!p-0 overflow-hidden divide-y divide-black/[0.06]">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-2.5 text-xs font-semibold uppercase text-[var(--color-muted)]">
            <span>Day</span>
            <span className="text-right w-24">Predicted</span>
            <span className="text-right w-32 hidden sm:block">Range</span>
            <span className="text-right w-12">Trend</span>
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
                  <div className="text-right w-24">
                    <p className="font-bold tabular-nums">
                      ~{fmt(Math.round(day.predictedSales / 50) * 50)}
                    </p>
                    <p className="text-xs text-[var(--color-muted)] tabular-nums">
                      {day.sampleSize}w avg
                    </p>
                  </div>
                  <div className="text-right w-32 hidden sm:block">
                    <p className="text-sm tabular-nums text-[var(--color-muted)]">
                      {fmt(day.low!)} – {fmt(day.high!)}
                    </p>
                    <p className="text-xs text-[var(--color-muted)]">
                      spread {fmt(day.high! - day.low!)}
                    </p>
                  </div>
                  <div className="text-right w-12">
                    <TrendBadge trend={day.trend} />
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
      )}

      {!loading && hasSomeData && (
        <p className="text-xs text-[var(--color-muted)] text-center">
          Predictions use locked shift reports only · Trend ↑/↓ compares the most recent half of weeks to the older half · Rounded to nearest 50 PLN
        </p>
      )}
    </div>
  );
}

function TrendBadge({ trend }: { trend?: "UP" | "DOWN" | "FLAT" }) {
  if (trend === "UP") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 rounded-full px-2 py-0.5">
        ↑ Up
      </span>
    );
  }
  if (trend === "DOWN") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 rounded-full px-2 py-0.5">
        ↓ Down
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-muted)] bg-black/5 rounded-full px-2 py-0.5">
      → Flat
    </span>
  );
}
