import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import type { WeeklyHours } from "../../types";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { DEFAULT_WEEKLY_HOURS, WeeklyHoursEditor } from "../../components/WeeklyHoursEditor";
import {
  createRestaurantClosure,
  deleteRestaurantClosure,
  listRestaurantClosures,
  updateRestaurantClosure,
  type RestaurantClosure,
} from "../../api/closures";

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

          <ClosuresSection />
        </>
      )}
    </div>
  );
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatLongDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Calendar of one-off closure days. The shift-create flow consults this
 * list: when a cashier's previous-day report is still in draft, marking
 * that day as a closure unblocks them so today's shift can proceed.
 */
function ClosuresSection() {
  const [items, setItems] = useState<RestaurantClosure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [draftDate, setDraftDate] = useState(todayIso());
  const [draftReason, setDraftReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editingReason, setEditingReason] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const list = await listRestaurantClosures();
      setItems(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load closures");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addClosure = async () => {
    if (!draftDate) {
      setError("Pick a date first");
      return;
    }
    const reason = draftReason.trim();
    if (!reason) {
      setError("Reason is required");
      return;
    }
    setError("");
    setMsg("");
    setSaving(true);
    try {
      await createRestaurantClosure(draftDate, reason);
      setDraftReason("");
      await refresh();
      setMsg(`Added closure for ${formatLongDate(draftDate)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add closure");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (c: RestaurantClosure) => {
    setEditingDate(c.date);
    setEditingReason(c.reason);
  };

  const cancelEdit = () => {
    setEditingDate(null);
    setEditingReason("");
  };

  const saveEdit = async () => {
    if (!editingDate) return;
    const reason = editingReason.trim();
    if (!reason) {
      setError("Reason is required");
      return;
    }
    setError("");
    setMsg("");
    setSaving(true);
    try {
      await updateRestaurantClosure(editingDate, reason);
      cancelEdit();
      await refresh();
      setMsg("Closure updated");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update closure");
    } finally {
      setSaving(false);
    }
  };

  const removeClosure = async (date: string) => {
    if (!confirm(`Remove the closure for ${formatLongDate(date)}? Cashiers will be required to fill a shift report for that day again.`)) {
      return;
    }
    setError("");
    setMsg("");
    setSaving(true);
    try {
      await deleteRestaurantClosure(date);
      await refresh();
      setMsg("Closure removed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove closure");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Closure days</h2>
        <p className="text-sm text-[var(--color-muted)]">
          Mark public holidays, planned breaks, or any other day the restaurant was closed.
          Closure days don't need a shift report — and they let cashiers proceed past a missing
          day without admin intervention.
        </p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {msg && <Alert variant="success">{msg}</Alert>}

      <div className="grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-end">
        <div>
          <label className="block text-xs font-medium text-[var(--color-muted)] mb-1">Date</label>
          <input
            type="date"
            value={draftDate}
            onChange={(e) => setDraftDate(e.target.value)}
            className="w-full rounded-md border border-black/15 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-muted)] mb-1">Reason</label>
          <input
            type="text"
            value={draftReason}
            onChange={(e) => setDraftReason(e.target.value)}
            placeholder="e.g. Easter Monday, planned renovation"
            maxLength={200}
            className="w-full rounded-md border border-black/15 px-3 py-2 text-sm"
          />
        </div>
        <Button
          onClick={addClosure}
          disabled={saving || !draftDate || !draftReason.trim()}
        >
          {saving && !editingDate ? "Saving…" : "Add closure"}
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--color-muted)] py-4">Loading closures…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)] py-2">
          No closure days recorded yet.
        </p>
      ) : (
        <ul className="divide-y divide-black/10 border border-black/10 rounded-md overflow-hidden">
          {items.map((c) => {
            const isEditing = editingDate === c.date;
            return (
              <li key={c.date} className="px-3 py-2 flex flex-wrap items-center gap-2">
                <span className="font-medium tabular-nums min-w-[10rem]">
                  {formatLongDate(c.date)}
                </span>
                {isEditing ? (
                  <input
                    type="text"
                    value={editingReason}
                    onChange={(e) => setEditingReason(e.target.value)}
                    maxLength={200}
                    className="flex-1 min-w-[12rem] rounded-md border border-black/15 px-2 py-1.5 text-sm"
                  />
                ) : (
                  <span className="flex-1 text-sm text-[var(--color-muted)]">{c.reason}</span>
                )}
                <div className="flex items-center gap-1.5">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={saveEdit}
                        disabled={saving}
                        className="text-sm font-medium px-3 py-1.5 rounded-md bg-[var(--color-saffron)] text-white hover:opacity-90 disabled:opacity-60"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        disabled={saving}
                        className="text-sm px-3 py-1.5 rounded-md border border-black/15 hover:bg-black/5"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => startEdit(c)}
                        className="text-sm px-3 py-1.5 rounded-md border border-black/15 hover:bg-black/5"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => removeClosure(c.date)}
                        disabled={saving}
                        className="text-sm px-3 py-1.5 rounded-md text-[var(--color-danger)] border border-red-200 hover:bg-red-50 disabled:opacity-60"
                      >
                        Remove
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
