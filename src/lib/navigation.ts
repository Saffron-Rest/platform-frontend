import type { ComponentType } from "react";
import type { Role, User } from "../types";
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
import { canOperate, isAdmin, isCashier } from "./roles";

export type NavIcon = ComponentType<{ className?: string }>;

export type NavLinkItem = {
  kind: "link";
  to: string;
  label: string;
  description?: string;
  icon: NavIcon;
  /** When true, shown in mobile bottom bar (max 4 total with More button). */
  primary?: boolean;
  /**
   * Permission keys (any-of) that grant access to this destination.
   * Mirrors the {@code anyOf} list passed to the corresponding
   * {@code <RequirePermission>} guard in {@code App.tsx} so the sidebar
   * never shows a link the user would be bounced away from. Empty or
   * undefined means "always visible" (cashier-relevant pages).
   */
  requires?: string[];
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
 * <p>v4 restructure (Jun 2026): role-based gating turned into
 * permission-based gating. Each item below declares the permissions
 * that grant entry — {@link navGroupsForUser} filters the list against
 * the user's effective set. Admins always see everything thanks to the
 * isAdmin shortcut. Net effect: a manager granted {@code TEAM_MANAGE}
 * gets the People group in their sidebar without us inventing a custom
 * role.</p>
 */
function cashierGroups(user?: User | null): NavGroup[] {
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
        ...(user?.canViewEarnings
          ? [{ kind: "link" as const, to: "/earnings", label: "My earnings", description: "Pay, shifts & payout requests", icon: IconCash, primary: true }]
          : []),
      ],
    },
  ];
}

/**
 * Full operations IA. Returned even for managers who lack some
 * permissions — {@link navGroupsForUser} prunes items the user can't
 * access and drops empty groups, so callers don't need to reason about
 * which permissions matter for which destinations.
 */
function fullOperationsGroups(): NavGroup[] {
  return [
    {
      id: "today",
      label: "Today",
      items: [
        { kind: "link", to: "/", label: "Home", description: "Restaurant overview", icon: IconHome, primary: true },
        { kind: "link", to: "/entry", label: "Shift report", description: "Open or continue today", icon: IconClipboard, primary: true },
        { kind: "link", to: "/checklists", label: "Checklists", description: "Opening / closing tasks", icon: IconCheckSquare },
      ],
    },
    {
      id: "operations",
      label: "Operations",
      items: [
        { kind: "link", to: "/pos", label: "POS", description: "Open the tablet ordering screen", icon: IconCash, requires: ["REPORTS_VIEW"] },
        { kind: "link", to: "/admin/inbox", label: "Issues", description: "Data health & open issues", icon: IconInbox, primary: true, requires: ["REPORTS_VIEW"] },
        { kind: "link", to: "/schedule", label: "Schedule", description: "Who works when", icon: IconCalendar, requires: ["ATTENDANCE_VIEW", "SCHEDULE_MANAGE", "SCHEDULE_BULK"] },
        { kind: "link", to: "/admin/stock", label: "Stock", description: "Inventory & POS sync", icon: IconBoxes, requires: ["STOCK_VIEW", "STOCK_ADJUST", "STOCK_MANAGE", "STOCK_DELETE"] },
        { kind: "link", to: "/admin/incidents", label: "Incidents", description: "Breakages, complaints, accidents", icon: IconWarning, requires: ["INCIDENTS_VIEW", "INCIDENTS_FILE", "INCIDENTS_RESOLVE"] },
        { kind: "link", to: "/admin/menu", label: "Menu items", description: "Items, prices, costs", icon: IconUtensils, requires: ["MENU_VIEW", "MENU_MANAGE"] },
        { kind: "link", to: "/admin/recipes", label: "Recipes", description: "Cost cards & price suggestions", icon: IconUtensils, requires: ["MENU_VIEW", "MENU_RECIPES_MANAGE"] },
        { kind: "link", to: "/admin/checklists", label: "Checklist templates", description: "Opening / closing tasks", icon: IconCheckSquare, requires: ["CHECKLISTS_RUN", "CHECKLISTS_CONFIGURE"] },
        { kind: "link", to: "/haccp", label: "HACCP history", description: "Food-safety records & export", icon: IconThermometer, requires: ["HACCP_LOG", "HACCP_EXPORT", "HACCP_CONFIGURE"] },
      ],
    },
    {
      id: "reports",
      label: "Reports",
      items: [
        { kind: "link", to: "/accounting", label: "Accounting Hub", description: "What needs attention today", icon: IconProfitLoss, requires: ["REPORTS_VIEW"] },
        { kind: "link", to: "/reports", label: "Shift reports", description: "All cashier reports", icon: IconClipboard, primary: true, requires: ["REPORTS_VIEW"] },
        { kind: "link", to: "/reports?tab=expenses", label: "Expenses & Income", description: "Add delivery or expense", icon: IconWallet, primary: true, requires: ["EXPENSES_VIEW", "EXPENSES_EDIT", "TREASURY_VIEW", "TREASURY_MANAGE"] },
        { kind: "link", to: "/reports?tab=pl", label: "Profit & loss", description: "P&L statement", icon: IconProfitLoss, requires: ["PROFIT_LOSS_VIEW"] },
        { kind: "link", to: "/reports?tab=export", label: "Export", description: "Exports & summaries", icon: IconChart, requires: ["REPORTS_VIEW", "REPORTS_EXPORT"] },
        { kind: "link", to: "/menu", label: "Menu analytics", description: "What sold, where the margin is", icon: IconChart, requires: ["MENU_VIEW", "REPORTS_VIEW"] },
        { kind: "link", to: "/reports?tab=payables", label: "Payables", description: "Supplier credit & due dates", icon: IconWallet, requires: ["PAYABLES_VIEW", "PAYABLES_MANAGE"] },
        { kind: "link", to: "/reports?tab=owner-expenses", label: "Owner expenses", description: "Expenses paid by the owner", icon: IconWallet, requires: ["OWNER_EXPENSES_VIEW", "OWNER_EXPENSES_MANAGE", "OWNER_EXPENSES_FILE"] },
        { kind: "link", to: "/reports?tab=treasury", label: "Treasury history", description: "Balance changes", icon: IconWallet, requires: ["TREASURY_VIEW", "TREASURY_MANAGE"] },
      ],
    },
    {
      id: "people",
      label: "People",
      items: [
        { kind: "link", to: "/admin/people", label: "Team", description: "People & roles", icon: IconUsers, requires: ["TEAM_VIEW", "TEAM_MANAGE"] },
        { kind: "link", to: "/admin/people?tab=payroll", label: "Payroll", description: "Calculate pay", icon: IconCash, requires: ["SALARIES_VIEW", "SALARIES_MANAGE", "PAY_RATES_MANAGE"] },
        { kind: "link", to: "/admin/payout-requests", label: "Payout requests", description: "Cashier pay requests — approve or decline", icon: IconWallet, requires: ["SALARIES_VIEW", "SALARIES_MANAGE"] },
        { kind: "link", to: "/admin/people?tab=payouts", label: "Payouts", description: "Approvals & history", icon: IconCash, requires: ["SALARIES_VIEW", "SALARIES_MANAGE"] },
        { kind: "link", to: "/admin/people?tab=certifications", label: "Certifications", description: "Sanepid, expiry alerts", icon: IconBadge, requires: ["CERTIFICATIONS_VIEW", "CERTIFICATIONS_MANAGE"] },
      ],
    },
    {
      id: "settings",
      label: "Settings",
      items: [
        { kind: "link", to: "/admin/settings", label: "Treasury", description: "Balances & %", icon: IconWallet, requires: ["SETTINGS_VIEW", "SETTINGS_MANAGE", "TREASURY_VIEW", "TREASURY_MANAGE"] },
        { kind: "link", to: "/admin/settings?tab=hours", label: "Hours", description: "Opening times", icon: IconClock, requires: ["SETTINGS_VIEW", "SETTINGS_MANAGE"] },
        { kind: "link", to: "/admin/settings?tab=tags", label: "Tags", description: "Custom labels", icon: IconTag, requires: ["TAGS_MANAGE"] },
        { kind: "link", to: "/admin/settings?tab=pos", label: "POS & Simulator", description: "Webhook integrations & stock test", icon: IconShield, requires: ["POS_INTEGRATION_VIEW", "POS_INTEGRATION_MANAGE"] },
        { kind: "link", to: "/admin/settings?tab=audit", label: "Audit log", description: "Who changed what", icon: IconShield, requires: ["AUDIT_VIEW"] },
        // Truly admin-only — no permission can substitute, so the
        // sidebar only ever surfaces this for ADMIN users (the empty
        // requires list combined with the role check below).
        { kind: "link", to: "/admin/settings?tab=security", label: "Security", description: "2FA & sessions", icon: IconKey, requires: ["__admin_only__"] },
      ],
    },
  ];
}

/**
 * Decide whether {@code user} can see a given navigation item.
 *
 * <p>Rules:
 * <ul>
 *   <li>No {@code requires} list ⇒ visible to anyone authenticated.</li>
 *   <li>The sentinel {@code "__admin_only__"} short-circuits to admins
 *       only — useful for routes like {@code /admin/security} that
 *       have no graspable permission to delegate.</li>
 *   <li>Otherwise: admins always pass; everyone else needs at least
 *       one of the listed permissions in their effective set.</li>
 * </ul></p>
 */
function canSeeItem(user: User | null | undefined, item: NavLinkItem): boolean {
  if (!item.requires || item.requires.length === 0) return true;
  if (item.requires.includes("__admin_only__")) {
    return isAdmin(user?.role);
  }
  if (isAdmin(user?.role)) return true;
  const held = new Set(user?.effectivePermissions ?? []);
  return item.requires.some((p) => held.has(p));
}

function filterGroups(user: User | null | undefined, groups: NavGroup[]): NavGroup[] {
  return groups
    .map((g) => ({ ...g, items: g.items.filter((it) => canSeeItem(user, it)) }))
    .filter((g) => g.items.length > 0);
}

/**
 * Build the sidebar/breadcrumb structure for the current user.
 *
 * <p>Cashiers get a dedicated, simplified IA. Anyone else (manager or
 * admin) sees the full operations tree filtered down to the permissions
 * they actually hold. Empty groups are dropped so a manager without
 * payroll grants doesn't see an empty "People" header.</p>
 */
export function navGroupsForUser(user: User | null | undefined): NavGroup[] {
  if (!user) return [];
  if (isCashier(user.role) && !isAdmin(user.role) && !canOperate(user.role)) {
    return cashierGroups(user);
  }
  return filterGroups(user, fullOperationsGroups());
}

/**
 * @deprecated Use {@link navGroupsForUser} so permission grants can
 * influence the sidebar. Kept as a thin role-only fallback for tour
 * helpers that don't have access to the full user object.
 */
export function navGroupsForRole(role: Role | string | undefined): NavGroup[] {
  if (isAdmin(role)) {
    return fullOperationsGroups();
  }
  if (canOperate(role)) {
    // Approximate a manager view by stripping admin-only sentinel items;
    // not perfect, but only used by tour helpers that need a coarse list.
    return fullOperationsGroups()
      .map((g) => ({
        ...g,
        items: g.items.filter((it) => !it.requires?.includes("__admin_only__")),
      }))
      .filter((g) => g.items.length > 0);
  }
  return cashierGroups();
}

export function allNavLinks(groups: NavGroup[]): NavLinkItem[] {
  return groups.flatMap((g) => g.items);
}

export function primaryNavLinks(groups: NavGroup[]): NavLinkItem[] {
  return allNavLinks(groups).filter((i) => i.primary);
}

// Routes that use ?tab= to switch sub-pages. Value = the tab name that
// the bare path (no ?tab=) defaults to, so the right item highlights.
const TAB_HUB_DEFAULTS: Record<string, string> = {
  "/reports":         "shift-reports",
  "/admin/settings":  "treasury",
  "/admin/people":    "team",
};

export function isNavActive(pathname: string, to: string, search?: string): boolean {
  if (to === "/") return pathname === "/";
  const qIdx = to.indexOf("?");
  const toPath  = qIdx >= 0 ? to.slice(0, qIdx) : to;
  const toQuery = qIdx >= 0 ? to.slice(qIdx + 1) : "";

  // /reports links also light up while the user is editing an entry.
  if (toPath === "/reports" && pathname.startsWith("/entry")) {
    const toTab = toQuery ? (new URLSearchParams(toQuery).get("tab") ?? "shift-reports") : "shift-reports";
    return toTab === "shift-reports";
  }

  // Tab hub routes: compare both pathname AND the ?tab= param.
  if (toPath in TAB_HUB_DEFAULTS) {
    if (pathname !== toPath) return false;
    const defaultTab   = TAB_HUB_DEFAULTS[toPath];
    const toTab        = toQuery ? (new URLSearchParams(toQuery).get("tab") ?? defaultTab) : defaultTab;
    const currentTab   = search  ? (new URLSearchParams(search ).get("tab") ?? defaultTab) : defaultTab;
    return toTab === currentTab;
  }

  // Generic prefix match — covers nested routes like /admin/team/123.
  return pathname === toPath || pathname.startsWith(toPath + "/");
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
  pathname: string,
  search?: string
): { group: NavGroup; item: NavLinkItem } | null {
  // Sort candidates by `to.length` desc so a nested route like
  // `/admin/team/123` matches the more-specific `/admin/team` over
  // a shorter prefix.
  type Match = { group: NavGroup; item: NavLinkItem; specificity: number };
  let best: Match | null = null;
  for (const g of groups) {
    for (const it of g.items) {
      if (isNavActive(pathname, it.to, search)) {
        const specificity = it.to.split("?")[0].length;
        if (!best || specificity > best.specificity) {
          best = { group: g, item: it, specificity };
        }
      }
    }
  }
  return best ? { group: best.group, item: best.item } : null;
}
