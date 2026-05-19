import type { DayHours, WeeklyHours } from "../types";
import { Button } from "./ui/Button";

const DAYS: { key: string; label: string }[] = [
  { key: "MONDAY", label: "Mon" },
  { key: "TUESDAY", label: "Tue" },
  { key: "WEDNESDAY", label: "Wed" },
  { key: "THURSDAY", label: "Thu" },
  { key: "FRIDAY", label: "Fri" },
  { key: "SATURDAY", label: "Sat" },
  { key: "SUNDAY", label: "Sun" },
];

export const DEFAULT_WEEKLY_HOURS: WeeklyHours = {
  MONDAY: { closed: false, open: "10:00", close: "22:00" },
  TUESDAY: { closed: false, open: "10:00", close: "22:00" },
  WEDNESDAY: { closed: false, open: "10:00", close: "22:00" },
  THURSDAY: { closed: false, open: "10:00", close: "22:00" },
  FRIDAY: { closed: false, open: "11:00", close: "23:00" },
  SATURDAY: { closed: false, open: "11:00", close: "23:00" },
  SUNDAY: { closed: false, open: "12:00", close: "21:00" },
};

type Props = {
  value: WeeklyHours;
  onChange: (v: WeeklyHours) => void;
  onSave: () => void;
  saving?: boolean;
};

export function WeeklyHoursEditor({ value, onChange, onSave, saving }: Props) {
  const setDay = (key: string, patch: Partial<DayHours>) => {
    const day = value[key] ?? DEFAULT_WEEKLY_HOURS[key];
    onChange({ ...value, [key]: { ...day, ...patch } });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--color-muted)]">
        Set open/close for each weekday. &quot;Till close&quot; shifts and missing end times use that
        day&apos;s close time (e.g. Friday until 23:00, Sunday until 21:00).
      </p>
      <div className="space-y-2">
        {DAYS.map(({ key, label }) => {
          const day = value[key] ?? DEFAULT_WEEKLY_HOURS[key];
          return (
            <div
              key={key}
              className={`grid grid-cols-[3rem_1fr_1fr_1fr] sm:grid-cols-[3.5rem_1fr_1fr_auto] gap-2 items-center text-sm ${
                day.closed ? "opacity-60" : ""
              }`}
            >
              <span className="font-medium">{label}</span>
              <label className="flex items-center gap-1.5 col-span-3 sm:col-span-1">
                <input
                  type="checkbox"
                  checked={day.closed}
                  onChange={(e) => setDay(key, { closed: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-xs text-[var(--color-muted)]">Closed</span>
              </label>
              <input
                type="time"
                value={day.open}
                disabled={day.closed}
                onChange={(e) => setDay(key, { open: e.target.value })}
                className="field-input py-1.5 text-sm disabled:opacity-50"
                title="Open"
              />
              <input
                type="time"
                value={day.close}
                disabled={day.closed}
                onChange={(e) => setDay(key, { close: e.target.value })}
                className="field-input py-1.5 text-sm disabled:opacity-50"
                title="Close"
              />
            </div>
          );
        })}
      </div>
      <Button variant="secondary" onClick={onSave} disabled={saving}>
        {saving ? "Saving…" : "Save restaurant hours"}
      </Button>
    </div>
  );
}
