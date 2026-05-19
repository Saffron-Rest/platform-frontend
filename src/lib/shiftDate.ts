export function shiftIsoDate(iso: string, deltaDays: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}
