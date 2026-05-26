import type { ComponentType } from "react";
import type { Role } from "../types";
import {
  IconBadge,
  IconBoxes,
  IconCalendar,
  IconCash,
  IconChart,
  IconCheckSquare,
  IconClipboard,
  IconClock,
  IconHome,
  IconInbox,
  IconKey,
  IconProfitLoss,
  IconShield,
  IconTag,
  IconThermometer,
  IconUsers,
  IconUtensils,
  IconWallet,
  IconWarning,
} from "../components/icons";
import { canOperate, isAdmin } from "./roles";

export type NavIcon = ComponentType<{ className?: string }>;

export type NavLinkItem = {
  kind: "link";
  to: string;
  label: string;
  description?: string;
  icon: NavIcon;
  /** When true, shown in mobile bottom bar (max 4 total with More button). */
  primary?: boolean;
};

export type NavGroup = {
  id: string;
  label: string;
  items: NavLinkItem[];
};

/**
 * Unified information architecture.
 *
 * <p>v3 restructure (May 2026): admin-specific routes used to live behind
 * a nested {@code <AdminLayout>} with its own second sidebar, which made
 * navigation feel double-stacked and shoved operational pages (Stock,
 * Incidents, Checklists, HACCP) behind an "Administration" wall even
 * though managers and cashiers need them daily.</p>
 *
 * <p>The new structure groups every destination into five role-gated
 * sections that match how the team actually thinks about the work:
 * <ol>
 *   <li><b>Today</b> — what an individual does this shift</li>
 *   <li><b>Operations</b> — daily restaurant running (managers+)</li>
 *   <li><b>Reports</b> — analysis & history (managers+)</li>
 *   <li><b>People</b> — team, payroll, certifications (admins)</li>
 *   <li><b>Settings</b> — infrequent configuration (admins)</li>
 * </ol></p>
 *
 * <p>Routes are unchanged; only the <em>grouping</em> moved. Bookmarks
 * to {@code /admin/stock} etc. still work.</p>
 */
function cashierGroups(): NavGroup[] {
  return [
    {
      id: "today",
      label: "Today",
      items: [
        { kind: "link", to: "/", label: "Home", description: "Today at a glance", icon: IconHome, primary: true },
        { kind: "link", to: "/entry", label: "Shift report", description: "Open or continue today", icon: IconClipboard, primary: true },
        { kind: "link", to: "/schedule", label: "My schedule", description: "When you work", icon: IconCalendar, primary: true },
        { kind: "link", to: "/checklists", label: "Checklists", description: "Opening / closing tasks", icon: IconCheckSquare },
        { kind: "link", to: "/haccp", label: "HACCP", description: "Food-safety logs", icon: IconThermometer },
      ],
    },
  ];
}

function operationsGroups(includeAdmin: boolean): NavGroup[] {
  const groups: NavGroup[] = [
    {
      id: "today",
      label: "Today",
      items: [
        { kind: "link", to: "/", label: "Home", description: "Restaurant overview", icon: IconHome, primary: true },
        { kind: "link", to: "/entry", label: "Shift entry", description: "Open or continue today", icon: IconClipboard, primary: true },
        { kind: "link", to: "/checklists", label: "Checklists", description: "Opening / closing tasks", icon: IconCheckSquare },
        { kind: "link", to: "/haccp", label: "HACCP", description: "Food-safety logs", icon: IconThermometer },
      ],
    },
    {
      id: "operations",
      label: "Operations",
      items: [
        { kind: "link", to: "/admin/inbox", label: "Inbox", description: "Open issues & data health", icon: IconInbox, primary: true },
        { kind: "link", to: "/admin/attendance", label: "Schedule", description: "Who works when", icon: IconCalendar },
        { kind: "link", to: "/admin/stock", label: "Stock", description: "Inventory & POS sync", icon: IconBoxes },
        { kind: "link", to: "/admin/incidents", label: "Incidents", description: "Breakages, complaints, accidents", icon: IconWarning },
        { kind: "link", to: "/admin/menu", label: "Menu items", description: "Items, prices, costs", icon: IconUtensils },
        { kind: "link", to: "/admin/recipes", label: "Recipes", description: "Cost cards & price suggestions", icon: IconUtensils },
        { kind: "link", to: "/admin/checklists", label: "Checklist templates", description: "Opening / closing tasks", icon: IconCheckSquare },
        { kind: "link", to: "/admin/haccp", label: "HACCP history", description: "Food-safety records & export", icon: IconThermometer },
      ],
    },
    {
      id: "reports",
      label: "Reports",
      items: [
        { kind: "link", to: "/reports", label: "Shift reports", description: "All cashier reports", icon: IconClipboard, primary: true },
        { kind: "link", to: "/finance", label: "Finance ledger", description: "Add delivery or expense", icon: IconWallet, primary: true },
        { kind: "link", to: "/profit-loss", label: "Profit & loss", description: "P&L statement", icon: IconProfitLoss },
        { kind: "link", to: "/analytics", label: "Analytics", description: "Exports & summaries", icon: IconChart },
        { kind: "link", to: "/menu", label: "Menu analytics", description: "What sold, where the margin is", icon: IconChart },
        { kind: "link", to: "/treasury/history", label: "Treasury history", description: "Balance changes", icon: IconWallet },
        { kind: "link", to: "/audit", label: "Audit log", description: "Who changed what", icon: IconShield },
      ],
    },
  ];

  if (includeAdmin) {
    groups.push(
      {
        id: "people",
        label: "People",
        items: [
          { kind: "link", to: "/admin/team", label: "Team", description: "People & roles", icon: IconUsers },
          { kind: "link", to: "/admin/salaries", label: "Payroll", description: "Calculate pay", icon: IconCash },
          { kind: "link", to: "/admin/payouts", label: "Payouts", description: "Approvals & history", icon: IconCash },
          { kind: "link", to: "/admin/certifications", label: "Certifications", description: "Sanepid, expiry alerts", icon: IconBadge },
        ],
      },
      {
        id: "settings",
        label: "Settings",
        items: [
          { kind: "link", to: "/admin/settings", label: "Treasury", description: "Balances & %", icon: IconWallet },
          { kind: "link", to: "/admin/hours", label: "Hours", description: "Opening times", icon: IconClock },
          { kind: "link", to: "/admin/tags", label: "Tags", description: "Custom labels", icon: IconTag },
          { kind: "link", to: "/admin/pos", label: "POS", description: "Webhook integrations", icon: IconShield },
          { kind: "link", to: "/admin/security", label: "Security", description: "2FA & sessions", icon: IconKey },
        ],
      },
    );
  }

  return groups;
}

export function navGroupsForRole(role: Role | string | undefined): NavGroup[] {
  if (isAdmin(role)) return operationsGroups(true);
  if (canOperate(role)) return operationsGroups(false);
  return cashierGroups();
}

export function allNavLinks(groups: NavGroup[]): NavLinkItem[] {
  return groups.flatMap((g) => g.items);
}

export function primaryNavLinks(groups: NavGroup[]): NavLinkItem[] {
  return allNavLinks(groups).filter((i) => i.primary);
}

export function isNavActive(pathname: string, to: string): boolean {
  if (to === "/") return pathname === "/";
  if (to === "/reports") {
    // Shift reports list is the "back" for individual entry pages, so
    // highlight the parent when the user is mid-entry.
    return pathname === "/reports" || pathname.startsWith("/entry");
  }
  // Generic prefix match — covers nested routes like /admin/team/123.
  return pathname === to || pathname.startsWith(to + "/");
}

/**
 * Look up the (group, item) pair that owns the given pathname so the
 * top app bar can render a breadcrumb like "Operations / Stock".
 *
 * <p>Falls back to {@code null} for unknown routes; the breadcrumb just
 * hides itself in that case.</p>
 */
export function findActive(
  groups: NavGroup[],
  pathname: string
): { group: NavGroup; item: NavLinkItem } | null {
  // Sort candidates by `to.length` desc so a nested route like
  // `/admin/team/123` matches the more-specific `/admin/team` over
  // a shorter prefix.
  type Match = { group: NavGroup; item: NavLinkItem; specificity: number };
  let best: Match | null = null;
  for (const g of groups) {
    for (const it of g.items) {
      if (isNavActive(pathname, it.to)) {
        const specificity = it.to.length;
        if (!best || specificity > best.specificity) {
          best = { group: g, item: it, specificity };
        }
      }
    }
  }
  return best ? { group: best.group, item: best.item } : null;
}
