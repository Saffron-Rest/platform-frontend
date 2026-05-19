import type { Role } from "../types";
import { isAdmin, isCashier } from "./roles";

const STORAGE_VERSION = "v1";

export type GuideStep = {
  title: string;
  body: string;
  to?: string;
  linkLabel?: string;
};

export type RoleGuide = {
  audience: string;
  title: string;
  intro: string;
  steps: GuideStep[];
};

function storageKey(role: string, userId: string) {
  return `saffron-quick-guide-${STORAGE_VERSION}-${role}-${userId}`;
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

export function quickGuideForRole(role: Role | string | undefined): RoleGuide {
  if (isCashier(role)) return cashierGuide();
  if (isAdmin(role)) return adminGuide();
  return managerGuide();
}

function cashierGuide(): RoleGuide {
  return {
    audience: "Cashier",
    title: "Your shift in 3 steps",
    intro:
      "Use this app at the start and end of each shift. Your manager sees your report after you submit — you can’t edit it until they unlock it.",
    steps: [
      {
        title: "1. Open your shift report",
        body:
          "Go to Shift report. Enter opening cash (prefilled when possible), then cash and card sales and any delivery platforms you use.",
        to: "/entry",
        linkLabel: "Open shift report",
      },
      {
        title: "2. Add expenses & count the drawer",
        body:
          "Record cash or card expenses with receipt photos (you can attach several). At closing, count physical cash and enter the actual amount — the app shows expected vs counted.",
        to: "/entry",
        linkLabel: "Go to report",
      },
      {
        title: "3. Submit when done",
        body:
          "Save a draft anytime. When the drawer balances (or you’ve noted the difference), tap Submit & lock. Check My schedule if you’re unsure you’re working today.",
        to: "/schedule",
        linkLabel: "My schedule",
      },
    ],
  };
}

function managerGuide(): RoleGuide {
  return {
    audience: "Manager",
    title: "Running the restaurant",
    intro:
      "You can view every cashier’s reports, fix mistakes, and record finance that isn’t on a shift report.",
    steps: [
      {
        title: "Shift reports",
        body:
          "Pick a cashier and date to view or edit any report — even after submit. Use Unlock only if the cashier must fix their own report in the app.",
        to: "/reports",
        linkLabel: "All shift reports",
      },
      {
        title: "Finance ledger",
        body:
          "Add post-close expenses (rent, supplies after hours) and manual delivery income. Attach multiple invoice photos per expense.",
        to: "/finance",
        linkLabel: "Finance",
      },
      {
        title: "Attendance & overview",
        body:
          "Set who works each day. Home shows today’s sales and drawer differences. Use Profit & loss and Analytics for month views and exports.",
        to: "/schedule",
        linkLabel: "Attendance",
      },
    ],
  };
}

function adminGuide(): RoleGuide {
  return {
    audience: "Admin",
    title: "Full control",
    intro:
      "Everything a manager can do, plus team setup, pay rates, treasury settings, and the audit log.",
    steps: [
      {
        title: "Operations (same as manager)",
        body:
          "Shift reports, Finance (+ expense / + delivery), attendance, P&L, and analytics. You can edit any submitted report without unlocking.",
        to: "/reports",
        linkLabel: "Shift reports",
      },
      {
        title: "Administration",
        body:
          "Manage cashiers and managers, salaries, restaurant hours, and platform settlement %. New users get a password from your team — they change it on first login.",
        to: "/admin",
        linkLabel: "Admin settings",
      },
      {
        title: "Audit & treasury",
        body:
          "Audit log shows who changed reports and settings. Treasury cards on Home summarize cash and card position for the period.",
        to: "/audit",
        linkLabel: "Audit log",
      },
    ],
  };
}
