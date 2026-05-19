import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { fmt } from "../lib/calc";
import type { DailyEntry } from "../types";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge, entryStatusBadge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";

const todayIso = () => new Date().toISOString().slice(0, 10);

export function CashierHistory() {
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [from, setFrom] = useState(todayIso);
  const [to, setTo] = useState(todayIso);

  const load = () => {
    const params = new URLSearchParams({ from, to });
    api<DailyEntry[]>(`/entries?${params}`).then(setEntries);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <PageHeader title="History" subtitle="Your reports for the selected day" />

      <Card className="mb-6 grid gap-3 sm:grid-cols-2">
        <label className="field-label">
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="field-input" />
        </label>
        <label className="field-label">
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="field-input" />
        </label>
        <Button variant="dark" fullWidth onClick={load} className="sm:col-span-2">
          Apply
        </Button>
      </Card>

      {entries.length === 0 ? (
        <EmptyState title="No entries found" description="Try another date." />
      ) : (
        <ul className="space-y-3 pb-4">
          {entries.map((e) => (
            <li key={e.id}>
              <Link
                to="/entry"
                className="block bg-white rounded-2xl p-4 border border-black/[0.06] shadow-sm hover:border-[var(--color-saffron)]/40 transition"
              >
                <div className="flex justify-between items-start gap-3">
                  <p className="font-semibold">
                    {new Date(e.date).toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                  <Badge variant={entryStatusBadge(e.status)}>{e.status}</Badge>
                </div>
                <p className="mt-2 text-sm">
                  Difference <strong className="tabular-nums">{fmt(e.difference)}</strong>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
