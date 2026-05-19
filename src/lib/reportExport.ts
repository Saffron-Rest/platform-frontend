export type ReportExportParams = {
  from?: string;
  to?: string;
  period?: string;
  date?: string;
  cashierId?: string;
  status?: string;
};

export function buildReportExportPath(
  format: "pdf" | "csv" | "excel",
  params: ReportExportParams
): string {
  const q = new URLSearchParams();
  if (params.from && params.to) {
    q.set("from", params.from);
    q.set("to", params.to);
  } else {
    q.set("period", params.period ?? "daily");
    if (params.date) q.set("date", params.date);
  }
  if (params.cashierId) q.set("cashierId", params.cashierId);
  if (params.status) q.set("status", params.status);
  return `/reports/export/${format}?${q}`;
}

export function reportExportFilename(
  format: "pdf" | "csv" | "excel",
  from: string,
  to?: string
): string {
  const ext = format === "excel" ? "xlsx" : format;
  const end = to && to !== from ? `_to_${to}` : "";
  return `saffron-cashflow-${from}${end}.${ext}`;
}
