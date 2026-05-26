import { useMemo, useState } from "react";
import {
  bulkAssignShifts,
  clearShiftRange,
  copyWeekShifts,
  WEEKDAY_LABELS,
  WEEKDAY_ORDER,
  type BulkResult,
  type Weekday,
} from "../api/shifts";
import type { User } from "../types";
import { Button } from "./ui/Button";
import { Alert } from "./ui/Alert";
import { closeForDate, openForDate } from "../lib/restaurantHours";
import type { WeeklyHours } from "../types";
import { useToast } from "../context/ToastContext";

type Tab = "PATTERN" | "COPY" | "CLEAR";

const todayIso = () => new Date().toISOString().slice(0, 10);
const daysAheadIso = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Most recent Monday on or before {@code date}. */
const mondayOf = (date: string) => {
  const d = new Date(date + "T12:00:00");
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift back to Monday
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
};

type Props = {
  cashiers: User[];
  /** Restaurant weekly hours (used to default till-close end time + show hints). */
  weeklyHours: WeeklyHours | null;
  /** Defaults derived from the month currently in view, so "Apply to this
   *  month" is a one-tap action. */
  defaultFrom?: string;
  defaultTo?: string;
  onClose: () => void;
  onApplied: (summary: string) => void;
};

export function ShiftBulkModal({
  cashiers, weeklyHours, defaultFrom, defaultTo, onClose, onApplied,
}: Props) {
  const [tab, setTab] = useState<Tab>("PATTERN");

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-t-2xl md:rounded-2xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-black/5 px-5 py-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Bulk schedule</h3>
            <p className="text-xs text-[var(--color-muted)]">
              Schedule, copy, or wipe multiple days in one go. Capped at 92 days per operation.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--color-muted)] hover:text-[var(--color-ink)] text-2xl leading-none px-2"
            aria-label="Close"
          >×</button>
        </div>

        <div className="px-5 pt-4 flex gap-1">
          {([
            ["PATTERN", "Schedule pattern"],
            ["COPY", "Copy week"],
            ["CLEAR", "Clear range"],
          ] as [Tab, string][]).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`px-3 py-1.5 rounded-full text-sm transition ${
                tab === k
                  ? "bg-[var(--color-ink)] text-white"
                  : "bg-white border border-black/10 hover:bg-[var(--color-cream)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === "PATTERN" && (
            <PatternTab
              cashiers={cashiers}
              weeklyHours={weeklyHours}
              defaultFrom={defaultFrom}
              defaultTo={defaultTo}
              onApplied={onApplied}
            />
          )}
          {tab === "COPY" && (
            <CopyWeekTab defaultFrom={defaultFrom} onApplied={onApplied} />
          )}
          {tab === "CLEAR" && (
            <ClearRangeTab
              cashiers={cashiers}
              defaultFrom={defaultFrom}
              defaultTo={defaultTo}
              onApplied={onApplied}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function PatternTab({
  cashiers, weeklyHours, defaultFrom, defaultTo, onApplied,
}: {
  cashiers: User[];
  weeklyHours: WeeklyHours | null;
  defaultFrom?: string;
  defaultTo?: string;
  onApplied: (msg: string) => void;
}) {
  const toast = useToast();
  const [from, setFrom] = useState(defaultFrom || todayIso());
  const [to, setTo] = useState(defaultTo || daysAheadIso(13));
  const [weekdays, setWeekdays] = useState<Weekday[]>([
    "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY",
  ]);
  const [userIds, setUserIds] = useState<string[]>([]);
  const dayOpen = useMemo(() => openForDate(from, weeklyHours), [from, weeklyHours]);
  const dayClose = useMemo(() => closeForDate(from, weeklyHours), [from, weeklyHours]);
  const [start, setStart] = useState(dayOpen || "10:00");
  const [end, setEnd] = useState(dayClose || "18:00");
  const [tillClose, setTillClose] = useState(false);
  const [skipExisting, setSkipExisting] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BulkResult | null>(null);

  const toggleDay = (d: Weekday) =>
    setWeekdays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  const toggleUser = (id: string) =>
    setUserIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const previewDays = useMemo(() => {
    if (!from || !to) return 0;
    const a = new Date(from + "T12:00:00");
    const b = new Date(to + "T12:00:00");
    if (b < a) return 0;
    let count = 0;
    const set = new Set(weekdays);
    for (let d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay(); // 0..6 Sun..Sat
      const name: Weekday = WEEKDAY_ORDER[(dow + 6) % 7];
      if (set.has(name)) count++;
    }
    return count;
  }, [from, to, weekdays]);

  const submit = async () => {
    setError("");
    setResult(null);
    if (!userIds.length) { setError("Pick at least one cashier"); return; }
    if (!weekdays.length) { setError("Pick at least one weekday"); return; }
    if (!start) { setError("Start time is required"); return; }
    if (!tillClose && !end) { setError("End time is required (or tick 'until close')"); return; }
    setSaving(true);
    try {
      const r = await bulkAssignShifts({
        from, to,
        weekdays,
        userIds,
        startTime: start,
        endTime: tillClose ? null : end,
        tillClose,
        skipExisting,
      });
      setResult(r);
      const summary = `Created ${r.created}, updated ${r.updated}, skipped ${r.skipped} across ${r.affectedDays} day${r.affectedDays === 1 ? "" : "s"}.`;
      onApplied(summary);
      toast.success("Schedule applied", { description: summary });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk assign failed");
      toast.error("Bulk schedule failed", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-muted)]">
        Schedule cashiers across a date range, restricted to specific weekdays — handy for repeating patterns like "Mon/Wed/Fri 10–18 for the next month".
      </p>

      {error && <Alert variant="error">{error}</Alert>}
      {result && result.skipped > 0 && result.skippedDates && result.skippedDates.length > 0 && (
        <Alert variant="info">
          <details className="text-xs">
            <summary className="cursor-pointer hover:underline">
              {result.skippedDates.length} day{result.skippedDates.length === 1 ? "" : "s"} skipped (already had a shift)
            </summary>
            <div className="mt-1 max-h-32 overflow-y-auto text-[var(--color-muted)]">
              {result.skippedDates.slice(0, 50).join(", ")}
              {result.skippedDates.length > 50 ? "…" : ""}
            </div>
          </details>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="field-label">
          <span className="text-xs">From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="field-input" />
        </label>
        <label className="field-label">
          <span className="text-xs">To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="field-input" />
        </label>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wider text-[var(--color-muted)] mb-1.5">Weekdays</div>
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAY_ORDER.map((d) => {
            const active = weekdays.includes(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(d)}
                className={`px-3 py-1.5 rounded-full text-sm transition ${
                  active
                    ? "bg-[var(--color-ink)] text-white"
                    : "bg-white border border-black/10 hover:bg-[var(--color-cream)]"
                }`}
              >
                {WEEKDAY_LABELS[d]}
              </button>
            );
          })}
        </div>
        <div className="flex gap-3 mt-2 text-xs">
          <button
            type="button"
            onClick={() => setWeekdays(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"])}
            className="text-[var(--color-saffron-dark)] hover:underline"
          >
            Mon-Fri
          </button>
          <button
            type="button"
            onClick={() => setWeekdays(["SATURDAY", "SUNDAY"])}
            className="text-[var(--color-saffron-dark)] hover:underline"
          >
            Weekend
          </button>
          <button
            type="button"
            onClick={() => setWeekdays([...WEEKDAY_ORDER])}
            className="text-[var(--color-saffron-dark)] hover:underline"
          >
            Every day
          </button>
        </div>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wider text-[var(--color-muted)] mb-1.5">
          Cashiers ({userIds.length} selected)
        </div>
        <div className="grid grid-cols-2 gap-1 max-h-44 overflow-y-auto border border-black/5 rounded-xl p-2 bg-[var(--color-cream)]/30">
          {cashiers.map((c) => {
            const active = userIds.includes(c.id);
            return (
              <label
                key={c.id}
                className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer ${
                  active ? "bg-[var(--color-saffron)]/20" : "hover:bg-white"
                }`}
              >
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => toggleUser(c.id)}
                  className="w-4 h-4"
                />
                <span className="truncate">{c.name}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="field-label">
          <span className="text-xs">Start time</span>
          <input
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="field-input"
          />
        </label>
        <label className="field-label">
          <span className="text-xs">End time</span>
          <input
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            disabled={tillClose}
            className="field-input"
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={tillClose}
          onChange={(e) => setTillClose(e.target.checked)}
          className="w-4 h-4"
        />
        <span>Work until close — system picks one closer per day, others get a fixed end time.</span>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={skipExisting}
          onChange={(e) => setSkipExisting(e.target.checked)}
          className="w-4 h-4"
        />
        <span>
          <strong>Don't overwrite</strong> — skip days where this cashier already has a shift (recommended).
        </span>
      </label>

      <div className="rounded-xl bg-[var(--color-cream)] p-3 text-sm">
        <div className="font-medium">
          Will touch {previewDays} day{previewDays === 1 ? "" : "s"} × {userIds.length} cashier{userIds.length === 1 ? "" : "s"} = up to {previewDays * userIds.length} shift{previewDays * userIds.length === 1 ? "" : "s"}.
        </div>
        <div className="text-xs text-[var(--color-muted)] mt-1">
          {skipExisting
            ? "Existing shifts won't be touched."
            : "Existing shifts will be overwritten with these times."}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button onClick={submit} disabled={saving || previewDays === 0 || userIds.length === 0}>
          {saving ? "Applying…" : `Apply to ${previewDays * userIds.length} shifts`}
        </Button>
      </div>
    </div>
  );
}

function CopyWeekTab({
  defaultFrom, onApplied,
}: {
  defaultFrom?: string;
  onApplied: (msg: string) => void;
}) {
  const toast = useToast();
  const [source, setSource] = useState(mondayOf(defaultFrom || todayIso()));
  const [target, setTarget] = useState(
    mondayOf(defaultFrom ? daysAheadIso(7) : daysAheadIso(7))
  );
  const [overwrite, setOverwrite] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BulkResult | null>(null);

  const submit = async () => {
    setError("");
    setResult(null);
    if (source === target) { setError("Source and target weeks must differ"); return; }
    setSaving(true);
    try {
      const r = await copyWeekShifts({
        sourceWeekStart: source,
        targetWeekStart: target,
        overwrite,
      });
      setResult(r);
      const summary = `${r.created} created, ${r.updated} updated, ${r.skipped} skipped.`;
      onApplied(`Copied: ${summary}`);
      toast.success("Week copied", { description: summary });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Copy failed");
      toast.error("Copy failed", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const weekEnd = (start: string) => {
    const d = new Date(start + "T12:00:00");
    d.setDate(d.getDate() + 6);
    return d.toISOString().slice(0, 10);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-muted)]">
        Take a 7-day window of shifts and replicate it onto another 7-day window. Useful for "next week looks like this week" plus the odd manual adjustment after.
      </p>

      {error && <Alert variant="error">{error}</Alert>}
      {result && (
        <Alert variant="success">
          {result.created} created · {result.updated} updated · {result.skipped} skipped across {result.affectedDays} day{result.affectedDays === 1 ? "" : "s"}.
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="field-label">
          <span className="text-xs">Source week starts</span>
          <input
            type="date"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="field-input"
          />
          <span className="text-xs text-[var(--color-muted)] mt-1 block">through {weekEnd(source)}</span>
        </label>
        <label className="field-label">
          <span className="text-xs">Target week starts</span>
          <input
            type="date"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="field-input"
          />
          <span className="text-xs text-[var(--color-muted)] mt-1 block">through {weekEnd(target)}</span>
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={overwrite}
          onChange={(e) => setOverwrite(e.target.checked)}
          className="w-4 h-4"
        />
        <span>
          <strong>Overwrite</strong> target days that already have shifts. Leave off to keep manual edits safe.
        </span>
      </label>

      <div className="flex justify-end gap-2 pt-2">
        <Button onClick={submit} disabled={saving || source === target}>
          {saving ? "Copying…" : "Copy week"}
        </Button>
      </div>
    </div>
  );
}

function ClearRangeTab({
  cashiers, defaultFrom, defaultTo, onApplied,
}: {
  cashiers: User[];
  defaultFrom?: string;
  defaultTo?: string;
  onApplied: (msg: string) => void;
}) {
  const toast = useToast();
  const [from, setFrom] = useState(defaultFrom || todayIso());
  const [to, setTo] = useState(defaultTo || daysAheadIso(6));
  const [userId, setUserId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [result, setResult] = useState<{ deleted: number; affectedDays: number } | null>(null);

  const submit = async () => {
    setError("");
    setResult(null);
    if (confirmText.trim().toLowerCase() !== "clear") {
      setError(`Type "clear" to confirm — this can't be undone in one click.`);
      return;
    }
    setSaving(true);
    try {
      const r = await clearShiftRange(from, to, userId || undefined);
      setResult(r);
      const summary = `${r.deleted} shift${r.deleted === 1 ? "" : "s"} removed across ${r.affectedDays} day${r.affectedDays === 1 ? "" : "s"}.`;
      onApplied(`Cleared ${summary}`);
      toast.warning("Shifts cleared", { description: summary });
      setConfirmText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Clear failed");
      toast.error("Clear failed", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-muted)]">
        Wipe shifts in a date range. Use sparingly — there's no one-click undo (audit log records the deletion).
      </p>

      {error && <Alert variant="error">{error}</Alert>}
      {result && (
        <Alert variant="success">
          Removed {result.deleted} shift{result.deleted === 1 ? "" : "s"} across {result.affectedDays} day{result.affectedDays === 1 ? "" : "s"}.
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="field-label">
          <span className="text-xs">From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="field-input" />
        </label>
        <label className="field-label">
          <span className="text-xs">To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="field-input" />
        </label>
      </div>

      <label className="field-label">
        <span className="text-xs">Cashier (optional)</span>
        <select value={userId} onChange={(e) => setUserId(e.target.value)} className="field-input">
          <option value="">Everyone in this range</option>
          {cashiers.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <span className="text-xs text-[var(--color-muted)] mt-1 block">
          Leave on "Everyone" to wipe the whole range, or pick one cashier to remove just theirs.
        </span>
      </label>

      <label className="field-label">
        <span className="text-xs">
          Type <code className="font-mono bg-[var(--color-cream)] px-1.5 py-0.5 rounded">clear</code> to confirm
        </span>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="clear"
          className="field-input"
        />
      </label>

      <div className="flex justify-end gap-2 pt-2">
        <Button
          variant="danger"
          onClick={submit}
          disabled={saving || confirmText.trim().toLowerCase() !== "clear"}
        >
          {saving ? "Clearing…" : "Clear range"}
        </Button>
      </div>
    </div>
  );
}
