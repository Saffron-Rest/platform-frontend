import type { Role } from "../types";
import { isAdmin, isCashier } from "./roles";
import { TOUR_CENTER } from "./tourTargets";

const STORAGE_VERSION = "v2";

export type TourStep = {
  /** `data-tour` value, or TOUR_CENTER for full-screen intro/outro */
  target: string;
  title: string;
  body: string;
  /** Navigate here before highlighting (optional) */
  route?: string;
  placement?: "top" | "bottom" | "left" | "right" | "auto";
};

function storageKey(role: string, userId: string) {
  return `saffron-tour-${STORAGE_VERSION}-${role}-${userId}`;
}

export function isQuickGuideDismissed(role: Role | string | undefined, userId: string | undefined) {
  if (!role || !userId) return true;
  try {
    return localStorage.getItem(storageKey(role, userId)) === "1";
  } catch {
    return true;
  }
}

export function dismissQuickGuide(role: Role | string, userId: string, remember: boolean) {
  if (!remember) return;
  try {
    localStorage.setItem(storageKey(role, userId), "1");
  } catch {
    /* ignore */
  }
}

export function clearQuickGuideDismissed(role: Role | string, userId: string) {
  try {
    localStorage.removeItem(storageKey(role, userId));
  } catch {
    /* ignore */
  }
}

export function tourStepsForRole(role: Role | string | undefined): TourStep[] {
  if (isCashier(role)) return cashierTour();
  if (isAdmin(role)) return adminTour();
  return managerTour();
}

function cashierTour(): TourStep[] {
  return [
    {
      target: TOUR_CENTER,
      title: "Welcome to Saffron",
      body: "This short tour walks through every main button on your screen. Use Next to highlight each area and read what it does.",
    },
    {
      target: "nav-home",
      route: "/",
      title: "Home",
      body: "Your starting point. See today’s sales, your drawer difference, and shortcuts to your report and schedule.",
      placement: "right",
    },
    {
      target: "tour-quick-actions",
      route: "/",
      title: "Quick actions",
      body: "One-tap shortcuts. The highlighted tile is usually your shift report — open it when you start or end a shift.",
      placement: "bottom",
    },
    {
      target: "tour-today-numbers",
      route: "/",
      title: "Today’s numbers",
      body: "Total sales, cash, card, and drawer difference for today. A negative difference means the counted cash is below what the system expected.",
      placement: "top",
    },
    {
      target: "tour-your-report",
      route: "/",
      title: "Your report",
      body: "Tap here to open today’s shift report. Status shows Draft or Submitted; difference shows over/short.",
      placement: "top",
    },
    {
      target: "nav-entry",
      route: "/entry",
      title: "Shift report (navigation)",
      body: "Same report from the menu. Use this anytime during your shift to save progress.",
      placement: "right",
    },
    {
      target: "tour-entry-stepper",
      route: "/entry",
      title: "Report sections",
      body: "Follow these steps: opening cash → sales → expenses → payouts → closing count. Sections turn green as you complete them.",
      placement: "bottom",
    },
    {
      target: "tour-entry-summary",
      route: "/entry",
      title: "Live summary bar",
      body: "Expected cash in the drawer vs what you counted. Fix sales, expenses, or the closing count until the difference is zero (or note why not).",
      placement: "bottom",
    },
    {
      target: "tour-entry-form",
      route: "/entry",
      title: "Report form",
      body: "Enter sales by channel, add expenses (cash or card) with receipt photos, and record payouts taken from the drawer.",
      placement: "top",
    },
    {
      target: "tour-entry-actions",
      route: "/entry",
      title: "Save & submit",
      body: "Save draft keeps the report editable. Submit & lock sends it to your manager — you’ll need them to unlock if you must change it later.",
      placement: "top",
    },
    {
      target: "nav-schedule",
      route: "/schedule",
      title: "My schedule",
      body: "See which days you work and whether you’re on a closing-only shift.",
      placement: "right",
    },
    {
      target: "tour-schedule-calendar",
      route: "/schedule",
      title: "Calendar",
      body: "Your assigned days are highlighted. If you’re not scheduled today, check with your manager before opening a report.",
      placement: "top",
    },
    {
      target: "tour-help",
      route: "/",
      title: "Replay this tour",
      body: "Open Quick guide or Guide anytime from Home or the menu to see this walkthrough again.",
      placement: "bottom",
    },
    {
      target: TOUR_CENTER,
      route: "/",
      title: "You’re ready",
      body: "Start each shift in Shift report, save often, and submit when the drawer is counted. Managers can unlock if you need fixes.",
    },
  ];
}

function managerTour(): TourStep[] {
  return [
    {
      target: TOUR_CENTER,
      title: "Manager tour",
      body: "We’ll highlight each part of the app — navigation, home, reports, finance, and more. Click Next to move through every area.",
    },
    {
      target: "nav-home",
      route: "/",
      title: "Home",
      body: "Restaurant overview: today’s sales, treasury snapshot, and quick links to record expenses or delivery income.",
      placement: "right",
    },
    {
      target: "tour-quick-actions",
      route: "/",
      title: "Quick actions",
      body: "Jump to shift reports, finance, attendance, P&L, analytics, or audit without digging through menus.",
      placement: "bottom",
    },
    {
      target: "tour-record-quickly",
      route: "/",
      title: "Record quickly",
      body: "Add a standalone expense (rent, supplies after close) or manual delivery income that wasn’t on a cashier report.",
      placement: "bottom",
    },
    {
      target: "tour-treasury",
      route: "/",
      title: "Treasury",
      body: "Cash in drawer vs card pool and settlement position. Use this to spot drift before month-end.",
      placement: "top",
    },
    {
      target: "tour-today-numbers",
      route: "/",
      title: "Today’s numbers",
      body: "Aggregate sales and drawer differences across all cashiers today.",
      placement: "top",
    },
    {
      target: "nav-reports",
      route: "/reports",
      title: "Shift reports",
      body: "All cashier daily reports — open, edit, or create by date and person.",
      placement: "right",
    },
    {
      target: "tour-reports-open",
      route: "/reports",
      title: "Open a report",
      body: "Pick date and cashier, then Open report. You get the full editor even on submitted reports.",
      placement: "bottom",
    },
    {
      target: "tour-reports-filters",
      route: "/reports",
      title: "Filter the list",
      body: "Narrow by date range, cashier, or draft/submitted. Tap any row to open that report.",
      placement: "top",
    },
    {
      target: "nav-finance",
      route: "/finance",
      title: "Finance",
      body: "Ledger of standalone expenses and manual delivery — separate from line items on shift reports.",
      placement: "right",
    },
    {
      target: "tour-finance-add",
      route: "/finance",
      title: "Add expense / delivery",
      body: "Sticky buttons open the form. Attach several invoice photos per expense.",
      placement: "bottom",
    },
    {
      target: "tour-finance-tabs",
      route: "/finance",
      title: "Expenses vs delivery tabs",
      body: "Switch lists, filter by date range, and refresh. Delete only standalone rows here.",
      placement: "top",
    },
    {
      target: "nav-schedule",
      route: "/schedule",
      title: "Attendance",
      body: "Set who works each day. Cashiers see their own schedule; you edit the team calendar.",
      placement: "right",
    },
    {
      target: "nav-profit-loss",
      route: "/profit-loss",
      title: "Profit & loss",
      body: "P&L by period with template options. Built from submitted reports and finance entries.",
      placement: "right",
    },
    {
      target: "tour-pl-dates",
      route: "/profit-loss",
      title: "P&L dates",
      body: "Choose from/to dates and generate. Export when you need a spreadsheet.",
      placement: "bottom",
    },
    {
      target: "nav-analytics",
      route: "/analytics",
      title: "Analytics",
      body: "Cash-flow summaries and exports for accountants or owners.",
      placement: "right",
    },
    {
      target: "nav-audit",
      route: "/audit",
      title: "Audit log",
      body: "Who changed reports, expenses, settings, and when. Filter by user or action.",
      placement: "right",
    },
    {
      target: "tour-audit-filters",
      route: "/audit",
      title: "Audit filters",
      body: "Search by person, entity, or date. Tap a row for before/after details.",
      placement: "bottom",
    },
    {
      target: "tour-help",
      route: "/",
      title: "Quick guide",
      body: "Reopen this tour from Home, the sidebar, or the mobile header Guide button.",
      placement: "bottom",
    },
    {
      target: TOUR_CENTER,
      route: "/",
      title: "Done",
      body: "Edit any submitted report directly. Use Unlock only when the cashier must fix their own copy in the app.",
    },
  ];
}

function adminTour(): TourStep[] {
  const base = managerTour();
  const withoutFinish = base.slice(0, -1);
  return [
    ...withoutFinish,
    {
      target: "nav-admin",
      route: "/admin/team",
      title: "Administration",
      body: "Team accounts, pay rates, payroll, payouts, opening hours, and treasury % settings.",
      placement: "right",
    },
    {
      target: "tour-admin-tabs",
      route: "/admin/team",
      title: "Admin sections",
      body: "Team — users and roles. Schedule — same attendance calendar. Payroll & payouts — pay staff. Treasury — card % and balances.",
      placement: "bottom",
    },
    {
      target: "tour-admin-team",
      route: "/admin/team",
      title: "Team",
      body: "Add cashiers and managers, set pay type/amount, deactivate users. New users change password on first login.",
      placement: "top",
    },
    {
      target: TOUR_CENTER,
      route: "/",
      title: "Admin complete",
      body: "You have full access including locked reports without unlock. Use audit when something looks wrong.",
    },
  ];
}
