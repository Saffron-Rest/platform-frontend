import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { ScheduleRow, User, WeeklyHours } from "../types";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";
import { Badge } from "../components/ui/Badge";
import {
  buildMonthGrid,
  firstName,
  formatDayTitle,
  formatShortDay,
  monthLabel,
  monthRange,
  shiftMonth,
} from "../lib/calendar";
import { closeForDate, hoursBetween } from "../lib/restaurantHours";

const DEFAULT_START = "09:00";
const DEFAULT_END = "17:00";
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type ViewMode = "day" | "cashier";
type ShiftOnDate = ScheduleRow & { date: string };

function rosterFromShifts(byDate: Record<string, ScheduleRow[]>): User[] {
  const seen = new Map<string, User>();
  for (const rows of Object.values(byDate)) {
    for (const row of rows) {
      if (!seen.has(row.userId)) {
        seen.set(row.userId, {
          id: row.userId,
          name: row.name,
          username: row.email?.split("@")[0] ?? row.userId,
          email: row.email,
          role: "CASHIER",
          active: true,
        });
      }
    }
  }
  return [...seen.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
}

function buildByCashier(
  byDate: Record<string, ScheduleRow[]>,
  roster: User[]
): { cashier: User; shifts: ShiftOnDate[] }[] {
  const map = new Map<string, ShiftOnDate[]>();
  for (const [date, rows] of Object.entries(byDate)) {
    for (const row of rows) {
      const list = map.get(row.userId) ?? [];
      list.push({ ...row, date });
      map.set(row.userId, list);
    }
  }
  return roster
    .map((cashier) => ({
      cashier,
      shifts: (map.get(cashier.id) ?? []).sort((a, b) => a.date.localeCompare(b.date)),
    }))
    .sort((a, b) => a.cashier.name.localeCompare(b.cashier.name, undefined, { sensitivity: "base" }));
}

type AttendanceCalendarProps = {
  /** Cashiers: view-only. Admin/manager: full edit. */
  readOnly?: boolean;
};

export function AttendanceCalendar({ readOnly = false }: AttendanceCalendarProps) {
  const { user: currentUser } = useAuth();
  const today = new Date();
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [filterCashierId, setFilterCashierId] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [byDate, setByDate] = useState<Record<string, ScheduleRow[]>>({});
  const [allCashiers, setAllCashiers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayShifts, setDayShifts] = useState<ScheduleRow[]>([]);
  const [addUserId, setAddUserId] = useState("");
  const [addStart, setAddStart] = useState(DEFAULT_START);
  const [addEnd, setAddEnd] = useState(DEFAULT_END);
  const [addTillClose, setAddTillClose] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [weeklyHours, setWeeklyHours] = useState<WeeklyHours | null>(null);

  const activeCashiers = useMemo(
    () => allCashiers.filter((u) => u.active !== false),
    [allCashiers]
  );

  const roster = useMemo(
    () => (showInactive ? allCashiers : activeCashiers),
    [showInactive, allCashiers, activeCashiers]
  );

  const byCashier = useMemo(() => buildByCashier(byDate, roster), [byDate, roster]);

  const grid = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const todayKey = useMemo(() => {
    const d = today;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const loadMonth = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { from, to } = monthRange(viewYear, viewMonth);
      const data = await api<Record<string, ScheduleRow[]>>(`/shifts/range?from=${from}&to=${to}`);
      setByDate(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load calendar");
    } finally {
      setLoading(false);
    }
  }, [viewYear, viewMonth]);

  useEffect(() => {
    if (!readOnly) {
      api<User[]>("/users")
        .then((list) => setAllCashiers(list.filter((u) => u.role === "CASHIER")))
        .catch(() => {});
    }
    api<{ weeklyHours?: WeeklyHours }>("/settings/payroll")
      .then((data) => {
        if (data.weeklyHours) setWeeklyHours(data.weeklyHours);
      })
      .catch(() => {});
    loadMonth();
  }, [loadMonth, readOnly]);

  useEffect(() => {
    if (readOnly) {
      setAllCashiers(rosterFromShifts(byDate));
    }
  }, [readOnly, byDate]);

  const filterShifts = (rows: ScheduleRow[]) =>
    filterCashierId ? rows.filter((s) => s.userId === filterCashierId) : rows;

  const openDay = async (dateKey: string, prefillCashierId?: string) => {
    setSelectedDate(dateKey);
    setMessage("");
    setAddUserId(prefillCashierId ?? "");
    setAddStart(DEFAULT_START);
    setAddEnd(DEFAULT_END);
    setAddTillClose(false);
    try {
      const list = await api<ScheduleRow[]>(`/shifts?date=${dateKey}`);
      setDayShifts(list);
    } catch {
      setDayShifts(byDate[dateKey] ?? []);
    }
  };

  const closeDay = () => {
    setSelectedDate(null);
    loadMonth();
  };

  const addEmployee = async () => {
    if (!selectedDate || !addUserId) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const res = await api<ScheduleRow & { autoAdjustedClosing?: boolean; designatedCloserName?: string }>(
        "/shifts/assign",
        {
          method: "POST",
          body: JSON.stringify({
            date: selectedDate,
            userId: addUserId,
            startTime: addStart,
            endTime: addTillClose ? null : addEnd,
            tillClose: addTillClose,
          }),
        }
      );
      const list = await api<ScheduleRow[]>(`/shifts?date=${selectedDate}`);
      setDayShifts(list);
      setAddUserId("");
      if (res.autoAdjustedClosing && res.designatedCloserName) {
        setMessage(
          `Added. Closing (final cash count) assigned to ${res.designatedCloserName}; other shifts were given an end time automatically.`
        );
      } else {
        setMessage("Employee added to this day");
      }
      await loadMonth();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setSaving(false);
    }
  };

  const removeShift = async (id: string) => {
    if (!selectedDate || !confirm("Remove this shift from the day?")) return;
    setSaving(true);
    try {
      await api(`/shifts/${id}`, { method: "DELETE" });
      const list = await api<ScheduleRow[]>(`/shifts?date=${selectedDate}`);
      setDayShifts(list);
      await loadMonth();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove");
    } finally {
      setSaving(false);
    }
  };

  const availableToAdd = activeCashiers.filter((c) => !dayShifts.some((s) => s.userId === c.id));

  const closeForSelectedDate = selectedDate ? closeForDate(selectedDate, weeklyHours) : null;
  const previewHours =
    closeForSelectedDate && addStart
      ? hoursBetween(addStart, addTillClose ? closeForSelectedDate : addEnd)
      : addStart && addEnd
        ? hoursBetween(addStart, addEnd)
        : 0;

  const shiftHoursLabel = (s: ScheduleRow): string => {
    if (!s.startTime) return s.hoursLabel;
    if (s.endTime) {
      const h = hoursBetween(s.startTime, s.endTime);
      return `${s.startTime} – ${s.endTime}${h ? ` · ${h.toFixed(2).replace(/\.?0+$/, "")} h` : ""}`;
    }
    if (selectedDate) {
      const close = closeForDate(selectedDate, weeklyHours);
      if (close) {
        const h = hoursBetween(s.startTime, close);
        return `${s.startTime} – close (${close})${h ? ` · ${h.toFixed(2).replace(/\.?0+$/, "")} h` : ""}`;
      }
    }
    return s.hoursLabel;
  };

  const goMonth = (delta: number) => {
    const next = shiftMonth(viewYear, viewMonth, delta);
    setViewYear(next.year);
    setViewMonth(next.month);
  };

  const monthNav = (
    <div className="flex items-center justify-between gap-2">
      <Button variant="secondary" onClick={() => goMonth(-1)} className="!px-3">
        ←
      </Button>
      <h3 className="font-semibold text-lg capitalize">{monthLabel(viewYear, viewMonth)}</h3>
      <Button variant="secondary" onClick={() => goMonth(1)} className="!px-3">
        →
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: "day" as const, label: "By day" },
              { id: "cashier" as const, label: "By cashier" },
            ] as const
          ).map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setViewMode(v.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                viewMode === v.id ? "bg-[var(--color-ink)] text-white" : "bg-white border border-black/10"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        <p className="text-sm text-[var(--color-muted)]">
          {readOnly
            ? viewMode === "day"
              ? "Tap a day to see who is working. Filter to your shifts only if you like."
              : "Each person’s shifts this month. Tap a day for details."
            : viewMode === "day"
              ? "Click a day to schedule staff. Use the filter to focus on one cashier."
              : "Each cashier’s shifts for this month. Tap a day to edit the schedule."}
        </p>

        <div className="flex flex-wrap items-end gap-3">
          {monthNav}
          {viewMode === "day" && roster.length > 0 && (
            <label className="field-label flex-1 min-w-[10rem]">
              <span className="text-xs">Show cashier</span>
              <select
                value={filterCashierId}
                onChange={(e) => setFilterCashierId(e.target.value)}
                className="field-input !py-2"
              >
                <option value="">Everyone</option>
                {roster.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {currentUser?.id === c.id ? " (you)" : ""}
                    {c.active === false ? " (inactive)" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          {readOnly && currentUser && viewMode === "day" && (
            <Button
              variant="secondary"
              className="!py-2 !text-sm"
              onClick={() =>
                setFilterCashierId((id) => (id === currentUser.id ? "" : currentUser.id))
              }
            >
              {filterCashierId === currentUser.id ? "Show everyone" : "My shifts only"}
            </Button>
          )}
        </div>

        {viewMode === "cashier" && !readOnly && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="w-4 h-4"
            />
            Include inactive cashiers
          </label>
        )}
      </Card>

      {error && <Alert variant="error">{error}</Alert>}

      {loading ? (
        <p className="text-center text-[var(--color-muted)] py-8">Loading schedule…</p>
      ) : viewMode === "day" ? (
        <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm overflow-hidden">
          <div className="grid grid-cols-7 border-b border-black/5 bg-[var(--color-cream)]">
            {WEEKDAYS.map((w) => (
              <div key={w} className="text-center text-xs font-semibold py-2 text-[var(--color-muted)]">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {grid.map((cell) => {
              const shifts = filterShifts(byDate[cell.date] ?? []);
              const isToday = cell.date === todayKey;
              return (
                <button
                  key={cell.date}
                  type="button"
                  onClick={() => openDay(cell.date)}
                  className={`min-h-[88px] md:min-h-[100px] p-1.5 border-b border-r border-black/5 text-left transition hover:bg-[var(--color-saffron)]/5 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--color-saffron)] ${
                    !cell.inMonth ? "bg-gray-50/80 text-gray-400" : "bg-white"
                  } ${isToday ? "ring-2 ring-inset ring-[var(--color-saffron)]/40" : ""}`}
                >
                  <span
                    className={`text-xs font-semibold inline-flex w-6 h-6 items-center justify-center rounded-full ${
                      isToday ? "bg-[var(--color-saffron)] text-white" : ""
                    }`}
                  >
                    {cell.day}
                  </span>
                  <div className="mt-1 space-y-0.5 overflow-hidden">
                    {shifts.slice(0, 3).map((s) => (
                      <div
                        key={s.id ?? `${s.userId}-${cell.date}`}
                        className={`text-[10px] md:text-xs leading-tight px-1 py-0.5 rounded truncate ${
                          currentUser?.id === s.userId
                            ? "bg-[var(--color-saffron)]/30 text-[var(--color-ink)] font-medium"
                            : "bg-[var(--color-saffron)]/15 text-[var(--color-saffron-dark)]"
                        }`}
                        title={`${s.name} ${s.hoursLabel}`}
                      >
                        {firstName(s.name!)} {s.startTime}
                        {s.designatedCloser ? " ★" : s.endTime ? `–${s.endTime}` : ""}
                      </div>
                    ))}
                    {shifts.length > 3 && (
                      <span className="text-[10px] text-[var(--color-muted)]">+{shifts.length - 3} more</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <ul className="space-y-3">
          {byCashier.length === 0 ? (
            <Card className="text-center py-10 text-[var(--color-muted)]">No cashiers to show.</Card>
          ) : (
            byCashier.map(({ cashier, shifts }) => (
              <li key={cashier.id}>
                <Card
                  className={`!p-4 space-y-3 ${
                    currentUser?.id === cashier.id ? "ring-2 ring-[var(--color-saffron)]/50" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="font-semibold truncate">
                        {cashier.name}
                        {currentUser?.id === cashier.id && (
                          <span className="ml-1.5 text-xs font-normal text-[var(--color-saffron-dark)]">
                            (you)
                          </span>
                        )}
                      </h4>
                      <p className="text-sm text-[var(--color-muted)] truncate">{cashier.email}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {cashier.active === false && <Badge variant="inactive">Inactive</Badge>}
                      <span className="text-sm font-medium tabular-nums">
                        {shifts.length} day{shifts.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>

                  {shifts.length === 0 ? (
                    <p className="text-sm text-[var(--color-muted)] py-2">No shifts scheduled this month.</p>
                  ) : (
                    <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                      {shifts.map((s) => (
                        <li key={`${s.date}-${s.id ?? s.userId}`}>
                          <button
                            type="button"
                            onClick={() => openDay(s.date, cashier.id)}
                            className="w-full flex justify-between gap-3 text-left text-sm py-2 px-3 rounded-xl bg-[var(--color-cream)] hover:bg-[var(--color-saffron)]/10 transition"
                          >
                            <span className="font-medium">{formatShortDay(s.date)}</span>
                            <span className="text-[var(--color-muted)] text-right shrink-0">
                              {s.hoursLabel}
                              {s.designatedCloser && (
                                <span className="block text-[10px] text-[var(--color-saffron-dark)] font-semibold">
                                  ★ Closes
                                </span>
                              )}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {!readOnly && (
                    <Button
                      variant="secondary"
                      className="!py-2 !text-sm w-full"
                      onClick={() => {
                        const first = shifts[0]?.date ?? monthRange(viewYear, viewMonth).from;
                        openDay(first, cashier.id);
                      }}
                    >
                      Add shift
                    </Button>
                  )}
                </Card>
              </li>
            ))
          )}
        </ul>
      )}

      {selectedDate && (
        <div
          className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/40"
          onClick={closeDay}
        >
          <div
            className="bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl md:rounded-2xl shadow-xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold">{formatDayTitle(selectedDate)}</h3>
                <p className="text-sm text-[var(--color-muted)]">{dayShifts.length} scheduled</p>
              </div>
              <button
                type="button"
                onClick={closeDay}
                className="text-[var(--color-muted)] hover:text-[var(--color-ink)] text-2xl leading-none px-2"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {message && (
              <Alert variant="success" className="mb-3">
                {message}
              </Alert>
            )}

            <p className="text-xs text-[var(--color-muted)] mb-3 leading-relaxed">
              ★ = final cash count for the day.
              {!readOnly &&
                " If more than one person is marked until close, the system picks one closer automatically."}
              {closeForSelectedDate && (
                <>
                  {" "}
                  Restaurant closes <span className="font-medium">≈ {closeForSelectedDate}</span> on this
                  day — that&apos;s the time used for &quot;until close&quot; shifts in payroll.
                </>
              )}
            </p>

            <ul className={`space-y-2 ${readOnly ? "" : "mb-4"}`}>
              {dayShifts.length === 0 && (
                <li className="text-sm text-[var(--color-muted)] py-4 text-center border border-dashed rounded-xl">
                  {readOnly ? "No one scheduled this day." : "No employees yet — add someone below."}
                </li>
              )}
              {dayShifts.map((s) => (
                <li
                  key={s.id ?? s.userId}
                  className={`flex items-center justify-between gap-2 p-3 rounded-xl border border-black/5 ${
                    currentUser?.id === s.userId
                      ? "bg-[var(--color-saffron)]/15"
                      : "bg-[var(--color-cream)]"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {s.name}
                      {currentUser?.id === s.userId && (
                        <span className="ml-1 text-xs text-[var(--color-muted)]">(you)</span>
                      )}
                      {s.designatedCloser && (
                        <span className="ml-1.5 text-xs font-semibold text-[var(--color-saffron-dark)]">
                          ★ Closes
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-[var(--color-muted)]">{shiftHoursLabel(s)}</p>
                  </div>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => s.id && removeShift(s.id)}
                      disabled={saving}
                      className="text-sm text-[var(--color-danger)] shrink-0 px-2 py-1"
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>

            {!readOnly && (
              <div className="border-t pt-4 space-y-3">
                <h4 className="font-semibold text-sm">Add employee</h4>
                {availableToAdd.length === 0 ? (
                  <p className="text-sm text-[var(--color-muted)]">All active cashiers are already on this day.</p>
                ) : (
                  <>
                    <label className="field-label block">
                      Employee
                      <select
                        value={addUserId}
                        onChange={(e) => setAddUserId(e.target.value)}
                        className="field-input"
                      >
                        <option value="">Choose…</option>
                        {availableToAdd.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="field-label">
                        From
                        <input
                          type="time"
                          value={addStart}
                          onChange={(e) => setAddStart(e.target.value)}
                          className="field-input"
                        />
                      </label>
                      <label className="field-label">
                        Until
                        <input
                          type="time"
                          value={addEnd}
                          onChange={(e) => {
                            setAddEnd(e.target.value);
                            setAddTillClose(false);
                          }}
                          disabled={addTillClose}
                          className="field-input disabled:opacity-50"
                        />
                      </label>
                    </div>
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={addTillClose}
                        onChange={(e) => setAddTillClose(e.target.checked)}
                        className="w-4 h-4 mt-0.5"
                      />
                      <span>
                        Until close
                        {closeForSelectedDate && (
                          <span className="text-[var(--color-muted)]"> (≈ {closeForSelectedDate})</span>
                        )}
                        <span className="block text-xs text-[var(--color-muted)]">
                          Final cash count for the day. Uses restaurant closing time —{" "}
                          <Link
                            to="/admin/hours"
                            className="underline hover:text-[var(--color-saffron-dark)]"
                          >
                            change in Hours
                          </Link>
                          .
                        </span>
                      </span>
                    </label>
                    {previewHours > 0 && (
                      <p className="text-xs text-[var(--color-muted)] -mt-1">
                        ≈ {previewHours.toFixed(2).replace(/\.?0+$/, "")} h
                        {addTillClose && closeForSelectedDate ? ` (${addStart} – ${closeForSelectedDate})` : ""}
                      </p>
                    )}
                    <Button fullWidth onClick={addEmployee} disabled={saving || !addUserId}>
                      {saving ? "Adding…" : "Add to this day"}
                    </Button>
                  </>
                )}
              </div>
            )}

            <Button variant="secondary" fullWidth onClick={closeDay} className={readOnly ? "mt-2" : "mt-4"}>
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
