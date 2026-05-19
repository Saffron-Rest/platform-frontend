/** Build YYYY-MM-DD for a calendar cell (may be outside current month). */
export function toDateKey(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

export function parseMonth(isoMonth: string): { year: number; month: number } {
  const [y, m] = isoMonth.split("-").map(Number);
  return { year: y, month: m - 1 };
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function monthRange(year: number, month: number): { from: string; to: string } {
  const from = toDateKey(year, month, 1);
  const lastDay = new Date(year, month + 1, 0).getDate();
  const to = toDateKey(year, month, lastDay);
  return { from, to };
}

/** Monday-first grid: 42 cells (6 weeks). */
export function buildMonthGrid(year: number, month: number): { date: string; inMonth: boolean; day: number }[] {
  const first = new Date(year, month, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: { date: string; inMonth: boolean; day: number }[] = [];

  const prevMonth = shiftMonth(year, month, -1);
  const prevDays = new Date(prevMonth.year, prevMonth.month + 1, 0).getDate();
  for (let i = startPad - 1; i >= 0; i--) {
    const day = prevDays - i;
    cells.push({
      date: toDateKey(prevMonth.year, prevMonth.month, day),
      inMonth: false,
      day,
    });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ date: toDateKey(year, month, day), inMonth: true, day });
  }
  let nextDay = 1;
  const nextMonth = shiftMonth(year, month, 1);
  while (cells.length < 42) {
    cells.push({
      date: toDateKey(nextMonth.year, nextMonth.month, nextDay),
      inMonth: false,
      day: nextDay,
    });
    nextDay++;
  }
  return cells;
}

export function formatShortDay(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function formatDayTitle(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function firstName(fullName: string): string {
  return fullName.split(/\s+/)[0] || fullName;
}
