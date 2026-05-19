import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import type { WeeklyHours } from "../../types";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Alert } from "../../components/ui/Alert";
import { DEFAULT_WEEKLY_HOURS, WeeklyHoursEditor } from "../../components/WeeklyHoursEditor";

function openDuration(open: string, close: string): string {
  const [oh, om] = open.split(":").map(Number);
  const [ch, cm] = close.split(":").map(Number);
  const mins = ch * 60 + cm - (oh * 60 + om);
  if (mins <= 0) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function AdminRestaurantHours() {
  const [weeklyHours, setWeeklyHours] = useState<WeeklyHours>(DEFAULT_WEEKLY_HOURS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api<{ weeklyHours: WeeklyHours }>("/settings/payroll");
      if (data.weeklyHours) setWeeklyHours(data.weeklyHours);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setError("");
    setMsg("");
    try {
      await api("/settings/payroll", {
        method: "PUT",
        body: JSON.stringify({ weeklyHours }),
      });
      setMsg("Restaurant hours saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const days = [
    { key: "MONDAY", label: "Monday" },
    { key: "TUESDAY", label: "Tuesday" },
    { key: "WEDNESDAY", label: "Wednesday" },
    { key: "THURSDAY", label: "Thursday" },
    { key: "FRIDAY", label: "Friday" },
    { key: "SATURDAY", label: "Saturday" },
    { key: "SUNDAY", label: "Sunday" },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Restaurant hours"
        subtitle="Open and close times per weekday — used for till-close shifts and daily pay"
      />

      {error && <Alert variant="error">{error}</Alert>}
      {msg && <Alert variant="success">{msg}</Alert>}

      {loading ? (
        <p className="text-center text-[var(--color-muted)] py-12">Loading…</p>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {days.map(({ key, label }) => {
              const d = weeklyHours[key] ?? DEFAULT_WEEKLY_HOURS[key];
              return (
                <Card
                  key={key}
                  className={`!p-3 ${d.closed ? "opacity-60 bg-gray-50" : ""}`}
                >
                  <p className="font-semibold text-sm">{label}</p>
                  {d.closed ? (
                    <p className="text-sm text-[var(--color-muted)] mt-1">Closed</p>
                  ) : (
                    <p className="text-sm mt-1 tabular-nums">
                      {d.open} – {d.close}
                      <span className="block text-xs text-[var(--color-muted)]">
                        {openDuration(d.open, d.close)} open
                      </span>
                    </p>
                  )}
                </Card>
              );
            })}
          </div>

          <Card>
            <WeeklyHoursEditor
              value={weeklyHours}
              onChange={setWeeklyHours}
              onSave={save}
              saving={saving}
            />
          </Card>

          <p className="text-xs text-[var(--color-muted)] text-center">
            After saving, check payroll in{" "}
            <Link to="/admin/salaries" className="text-[var(--color-saffron)] font-medium">
              Salaries
            </Link>
            .
          </p>
        </>
      )}
    </div>
  );
}
