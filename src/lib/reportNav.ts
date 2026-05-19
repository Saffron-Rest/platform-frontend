/** Build URL for the shift report editor (admin/manager or cashier). */
export function entryEditorUrl(date: string, cashierId?: string) {
  const params = new URLSearchParams({ date });
  if (cashierId) params.set("cashierId", cashierId);
  return `/entry?${params}`;
}
