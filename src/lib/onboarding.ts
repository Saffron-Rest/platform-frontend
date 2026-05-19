import type { Role } from "../types";
import { isAdmin, isCashier } from "./roles";
import { TOUR_CENTER } from "./tourTargets";

const STORAGE_VERSION = "v3";

export type TourStep = {
  target: string;
  title: string;
  body: string;
  /** Short actionable bullets shown under the main text */
  tips?: string[];
  /** Group label shown above the title (e.g. Navigation, Shift report) */
  category?: string;
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
      category: "Getting started",
      title: "Welcome to Saffron",
      body: "This guided tour highlights each part of the app on your screen. Take about 3 minutes — you can exit anytime and reopen it later.",
      tips: [
        "Use Next to jump to the next highlighted area",
        "On phone, the bottom menu works the same as the sidebar on desktop",
      ],
    },
    {
      target: "nav-home",
      route: "/",
      category: "Navigation",
      title: "Home",
      body: "Your dashboard for the day. Check sales and your drawer difference before and after each shift.",
      tips: ["Tap Home anytime to return here", "The date in the subtitle is always today"],
      placement: "right",
    },
    {
      target: "tour-quick-actions",
      route: "/",
      category: "Home",
      title: "Quick actions",
      body: "Shortcuts to the pages you use most. The orange tile is usually your shift report — that’s where you record the day’s cash flow.",
      tips: ["Start of shift: open Shift report and enter opening cash", "End of shift: finish sales, expenses, and closing count"],
      placement: "bottom",
    },
    {
      target: "tour-today-numbers",
      route: "/",
      category: "Home",
      title: "Today’s numbers",
      body: "Live totals for the restaurant today. Your drawer difference shows whether counted cash matches what the system expects.",
      tips: [
        "Negative difference = drawer is short (counted less than expected)",
        "Zero or near zero = balanced",
      ],
      placement: "top",
    },
    {
      target: "tour-your-report",
      route: "/",
      category: "Home",
      title: "Your report",
      body: "Opens today’s shift report in one tap. Draft means you can still edit; Submitted means it’s locked until a manager unlocks it.",
      tips: ["If you don’t see a row yet, open Shift report from quick actions to create one"],
      placement: "top",
    },
    {
      target: "nav-entry",
      route: "/entry",
      category: "Navigation",
      title: "Shift report in the menu",
      body: "Same report as above — use the side menu (desktop) or bottom bar (phone) to get back to your report during the shift.",
      placement: "right",
    },
    {
      target: "tour-entry-stepper",
      route: "/entry",
      category: "Shift report",
      title: "Progress steps",
      body: "Work through the report in order. Tap a step to scroll to that section. Green means that part is filled in correctly.",
      tips: [
        "Opening → Sales → Expenses → Payouts → Closing count",
        "Closing-only shifts may show fewer steps",
      ],
      placement: "bottom",
    },
    {
      target: "tour-entry-summary",
      route: "/entry",
      category: "Shift report",
      title: "Expected vs counted cash",
      body: "This bar updates as you type. Expected cash is what should be in the drawer; your closing count is what you physically counted.",
      tips: [
        "Difference should be 0.00 when balanced",
        "If it’s not zero, recheck sales, cash expenses, and payouts",
      ],
      placement: "bottom",
    },
    {
      target: "tour-entry-form",
      route: "/entry",
      category: "Shift report",
      title: "Report details",
      body: "Enter cash and card sales, delivery platforms, expenses, and any cash taken out as payouts. Add receipt photos for expenses — you can attach more than one.",
      tips: [
        "Save draft often so you don’t lose work",
        "Card expenses don’t reduce cash in the drawer",
      ],
      placement: "top",
    },
    {
      target: "tour-entry-actions",
      route: "/entry",
      category: "Shift report",
      title: "Save and submit",
      body: "Save draft keeps editing open. Submit & lock sends the report to your manager and prevents further edits on your account.",
      tips: [
        "Submit only after you’ve counted the drawer",
        "Need changes after submit? Ask your manager to unlock",
      ],
      placement: "top",
    },
    {
      target: "nav-schedule",
      route: "/schedule",
      category: "Navigation",
      title: "My schedule",
      body: "See when you’re scheduled to work and whether your shift is a full day or closing-only.",
      placement: "right",
    },
    {
      target: "tour-schedule-calendar",
      route: "/schedule",
      category: "Schedule",
      title: "Calendar",
      body: "Your working days are marked on the calendar. If you’re not scheduled today, confirm with your manager before filling a report.",
      tips: ["Closing-only days use a shorter report (opening + final count)"],
      placement: "top",
    },
    {
      target: "tour-help",
      route: "/",
      category: "Help",
      title: "Replay this guide",
      body: "Missed a step? Open Quick guide from Home, the sidebar (desktop), or Guide in the top bar (phone).",
      placement: "bottom",
    },
    {
      target: TOUR_CENTER,
      route: "/",
      category: "All set",
      title: "You’re ready to work",
      body: "Open Shift report at the start and end of each shift, save drafts as you go, and submit when the drawer is counted.",
      tips: ["Questions? Ask your manager — they can see and edit your report"],
    },
  ];
}

function managerTour(): TourStep[] {
  return [
    {
      target: TOUR_CENTER,
      category: "Getting started",
      title: "Manager walkthrough",
      body: "We’ll visit each area of Saffron — home, reports, finance, team, and compliance. Follow the highlights and read the tips under each step.",
      tips: ["About 5 minutes · You can pause and resume with Back / Next"],
    },
    {
      target: "nav-home",
      route: "/",
      category: "Navigation",
      title: "Home",
      body: "Restaurant overview for today: sales, treasury, and shortcuts to record post-close expenses or delivery income.",
      placement: "right",
    },
    {
      target: "tour-quick-actions",
      route: "/",
      category: "Home",
      title: "Quick actions",
      body: "Jump to shift reports, finance, attendance, profit & loss, analytics, or audit without using the full menu.",
      tips: ["Pin mentally: Reports for cashiers, Finance for after-hours spend"],
      placement: "bottom",
    },
    {
      target: "tour-record-quickly",
      route: "/",
      category: "Home",
      title: "Record quickly",
      body: "Fast path for two common tasks: standalone expenses (rent, late purchases) and manual delivery income not on a shift report.",
      tips: [
        "Expenses here affect P&L and treasury",
        "Delivery income increases card pool when settled to card",
      ],
      placement: "bottom",
    },
    {
      target: "tour-treasury",
      route: "/",
      category: "Home",
      title: "Treasury balances",
      body: "Cash on hand and card/bank pool, updated from locked reports, finance entries, salaries, and settings.",
      tips: [
        "Compare to physical cash and bank statements regularly",
        "Adjust starting balances under Admin → Treasury if needed",
      ],
      placement: "top",
    },
    {
      target: "tour-today-numbers",
      route: "/",
      category: "Home",
      title: "Today’s totals",
      body: "Aggregated sales and drawer differences across all cashiers. Use this to spot issues before end of day.",
      placement: "top",
    },
    {
      target: "nav-reports",
      route: "/reports",
      category: "Navigation",
      title: "Shift reports",
      body: "List and editor for every cashier’s daily report — drafts and submitted.",
      placement: "right",
    },
    {
      target: "tour-reports-open",
      route: "/reports",
      category: "Shift reports",
      title: "Open a report",
      body: "Choose business date and cashier, then Open report. You always get the full form, even for submitted reports.",
      tips: ["You can fix mistakes directly — no need to unlock unless the cashier must edit in their app"],
      placement: "bottom",
    },
    {
      target: "tour-reports-filters",
      route: "/reports",
      category: "Shift reports",
      title: "Browse and filter",
      body: "Presets for today, week, or month; filter by cashier and status. Tap any row to open that report.",
      tips: ["Draft count in the chips helps chase cashiers who haven’t submitted"],
      placement: "top",
    },
    {
      target: "nav-finance",
      route: "/finance",
      category: "Navigation",
      title: "Finance ledger",
      body: "All standalone expenses and manual delivery income in one place, with invoices attached.",
      placement: "right",
    },
    {
      target: "tour-finance-add",
      route: "/finance",
      category: "Finance",
      title: "Add expense or delivery",
      body: "These buttons stay visible while you scroll. Open the form, fill details, attach invoices, then save.",
      tips: [
        "Several photos per expense are supported",
        "Shift report expenses are edited on that report, not here",
      ],
      placement: "bottom",
    },
    {
      target: "tour-finance-tabs",
      route: "/finance",
      category: "Finance",
      title: "Lists and date range",
      body: "Switch between expense and delivery lists. Set From / To dates at the top and tap Refresh.",
      placement: "top",
    },
    {
      target: "nav-schedule",
      route: "/schedule",
      category: "Navigation",
      title: "Attendance",
      body: "Team calendar — assign who works each day. Cashiers only see their own row highlighted.",
      placement: "right",
    },
    {
      target: "nav-profit-loss",
      route: "/profit-loss",
      category: "Navigation",
      title: "Profit & loss",
      body: "Automated P&L from submitted reports and finance data. Pick a statement format for your country.",
      placement: "right",
    },
    {
      target: "tour-pl-dates",
      route: "/profit-loss",
      category: "Profit & loss",
      title: "Period and generate",
      body: "Use presets or custom dates, choose template, then generate. Include labor if you pay through the system.",
      tips: ["Locked-only reports option gives a cleaner month if drafts are still open"],
      placement: "bottom",
    },
    {
      target: "nav-analytics",
      route: "/analytics",
      category: "Navigation",
      title: "Analytics",
      body: "Cash-flow summaries and CSV-style exports for accounting.",
      placement: "right",
    },
    {
      target: "nav-audit",
      route: "/audit",
      category: "Navigation",
      title: "Audit log",
      body: "Immutable-style log of who changed reports, expenses, users, and settings.",
      placement: "right",
    },
    {
      target: "tour-audit-filters",
      route: "/audit",
      category: "Audit",
      title: "Search the trail",
      body: "Filter by person, action type, or date. Select a row to see before/after values.",
      placement: "bottom",
    },
    {
      target: "tour-help",
      route: "/",
      category: "Help",
      title: "Quick guide",
      body: "Reopen this tour from Home, the sidebar, or the mobile Guide button.",
      placement: "bottom",
    },
    {
      target: TOUR_CENTER,
      category: "All set",
      title: "You’re set",
      body: "Edit submitted reports anytime. Use Unlock for cashier only when they need to fix their own submission in the app.",
      tips: ["Expected cash in drawer = opening + cash sales − cash refunds − cash expenses − payouts"],
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
      category: "Navigation",
      title: "Administration",
      body: "Team, schedules, payroll, payouts, opening hours, and treasury percentages.",
      placement: "right",
    },
    {
      target: "tour-admin-tabs",
      route: "/admin/team",
      category: "Administration",
      title: "Admin sections",
      body: "Switch tabs for Team, Schedule, Payroll, Payouts, Hours, and Treasury settings.",
      tips: ["Treasury % affects how delivery and card sales flow to the card pool"],
      placement: "bottom",
    },
    {
      target: "tour-admin-team",
      route: "/admin/team",
      category: "Administration",
      title: "Team & pay",
      body: "Create managers and cashiers, set hourly/daily/monthly pay, deactivate accounts. New users must change password on first login.",
      tips: ["Keep at least one active admin account", "Pay changes can be tracked in payroll tabs"],
      placement: "top",
    },
    {
      target: TOUR_CENTER,
      route: "/",
      category: "All set",
      title: "Full access",
      body: "As admin you can edit any locked report without unlocking. Use audit when numbers don’t match expectations.",
      tips: ["Redeploy or refresh if menus look outdated after an update"],
    },
  ];
}
