import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchDataHealth, type DataHealth, type HealthItem } from "../../api/dataHealth";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Alert } from "../../components/ui/Alert";
import { Spinner } from "../../components/ui/Spinner";
import { EmptyState } from "../../components/ui/EmptyState";
import { Button } from "../../components/ui/Button";

const GROUP_META: Record<string, { title: string; description: string; icon: string }> = {
  staleDrafts: {
    title: "Stale draft reports",
    description: "Drafts that have been sitting open for more than two days.",
    icon: "📝",
  },
  missingPosFiles: {
    title: "Missing POS attachments",
    description: "Submitted reports without a card-sales receipt attached.",
    icon: "📎",
  },
  cashMismatches: {
    title: "Significant cash differences",
    description: "Reports where the actual count diverged sharply from the system expectation.",
    icon: "💸",
  },
  missingReports: {
    title: "Missing reports",
    description: "Cashiers who were scheduled but didn't submit a report.",
    icon: "🚫",
  },
  inactiveCashiers: {
    title: "Drafts on inactive cashiers",
    description: "Open drafts on cashiers that have been deactivated.",
    icon: "👤",
  },
};

const SEVERITY_BORDER: Record<string, string> = {
  high: "border-red-300 bg-red-50",
  medium: "border-amber-300 bg-amber-50",
  low: "border-black/10 bg-white",
};

const SEVERITY_DOT: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-[var(--color-saffron)]",
};

/** Admin "inbox-zero" dashboard. Shows everything in the system that
 *  needs attention, grouped by category. Each item links to the fix. */
export function AdminDataHealth() {
  const [data, setData] = useState<DataHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchDataHealth());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load data health");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inbox"
        subtitle="Open issues across reports, cash, schedules and people. Resolve them right from here."
      />

      {error && <Alert variant="error">{error}</Alert>}

      <div className="flex justify-end">
        <Button variant="ghost" onClick={() => void load()} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {loading && !data ? (
        <div className="flex justify-center py-12">
          <Spinner label="Scanning…" />
        </div>
      ) : data == null ? null : data.total === 0 ? (
        <EmptyState
          title="All clear"
          description="No drafts to chase, no big mismatches, no missing reports. You're caught up."
        />
      ) : (
        <>
          <Card className="bg-[var(--color-cream)]/40">
            <p className="text-sm">
              <strong>{data.total}</strong> open issue{data.total === 1 ? "" : "s"}
              {data.highSeverity > 0 && (
                <>
                  {" "}· <strong className="text-red-600">{data.highSeverity}</strong> high-severity
                </>
              )}
              <span className="text-[var(--color-muted)] ml-2">
                · scanned {new Date(data.generatedAt).toLocaleTimeString()}
              </span>
            </p>
          </Card>
          {Object.entries(data.groups).map(([key, items]) => {
            if (!items || items.length === 0) return null;
            const meta = GROUP_META[key] ?? {
              title: key,
              description: "",
              icon: "•",
            };
            return (
              <section key={key}>
                <h2 className="font-semibold flex items-baseline gap-2 mb-1">
                  <span aria-hidden>{meta.icon}</span>
                  {meta.title}
                  <span className="text-xs text-[var(--color-muted)] font-normal">
                    {items.length}
                  </span>
                </h2>
                {meta.description && (
                  <p className="text-sm text-[var(--color-muted)] mb-3">
                    {meta.description}
                  </p>
                )}
                <ul className="space-y-2">
                  {items.map((it) => (
                    <HealthRow key={it.id} item={it} />
                  ))}
                </ul>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}

function HealthRow({ item }: { item: HealthItem }) {
  return (
    <li>
      <Link
        to={item.url}
        className={`block rounded-xl border px-4 py-3 hover:shadow-sm transition ${
          SEVERITY_BORDER[item.severity] ?? SEVERITY_BORDER.low
        }`}
      >
        <div className="flex items-start gap-3">
          <span
            className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
              SEVERITY_DOT[item.severity] ?? SEVERITY_DOT.low
            }`}
            aria-hidden
          />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{item.title}</p>
            <p className="text-xs text-[var(--color-muted)] mt-0.5">
              {item.description}
            </p>
          </div>
          <span className="text-xs text-[var(--color-saffron-dark)] shrink-0">Fix →</span>
        </div>
      </Link>
    </li>
  );
}
