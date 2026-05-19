/** Scroll to a report form section (opening, sales, closing, etc.). */
export function scrollToReportSection(sectionId: string) {
  const el = document.getElementById(`report-section-${sectionId}`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  const btn = el.querySelector<HTMLButtonElement>("button[aria-expanded]");
  if (btn?.getAttribute("aria-expanded") === "false") btn.click();
}
