import type { ComponentType } from "react";
import type { Role } from "../types";
import {
  IconCalendar,
  IconChart,
  IconClipboard,
  IconHome,
  IconProfitLoss,
  IconShield,
  IconUsers,
  IconWallet,
} from "../components/icons";
import { canOperate, isAdmin } from "./roles";

export type NavIcon = ComponentType<{ className?: string }>;

export type NavLinkItem = {
  kind: "link";
  to: string;
  label: string;
  description?: string;
  icon: NavIcon;
  /** Shown in mobile bottom bar (max 4 total with More) */
  primary?: boolean;
};

export type NavGroup = {
  id: string;
  label: string;
  items: NavLinkItem[];
};

function cashierGroups(): NavGroup[] {
  return [
    {
      id: "main",
      label: "Daily",
      items: [
        {
          kind: "link",
          to: "/",
          label: "Home",
          description: "Today at a glance",
          icon: IconHome,
          primary: true,
        },
        {
          kind: "link",
          to: "/entry",
          label: "Shift report",
          description: "Open or continue today",
          icon: IconClipboard,
          primary: true,
        },
        {
          kind: "link",
          to: "/schedule",
          label: "My schedule",
          description: "When you work",
          icon: IconCalendar,
          primary: true,
        },
      ],
    },
  ];
}

function operationsGroups(includeAdmin: boolean): NavGroup[] {
  const groups: NavGroup[] = [
    {
      id: "main",
      label: "Overview",
      items: [
        {
          kind: "link",
          to: "/",
          label: "Home",
          description: "Today & treasury",
          icon: IconHome,
          primary: true,
        },
      ],
    },
    {
      id: "operations",
      label: "Operations",
      items: [
        {
          kind: "link",
          to: "/reports",
          label: "Shift reports",
          description: "All cashier reports",
          icon: IconClipboard,
          primary: true,
        },
        {
          kind: "link",
          to: "/finance",
          label: "Finance",
          description: "Delivery & expenses",
          icon: IconWallet,
          primary: true,
        },
      ],
    },
    {
      id: "insights",
      label: "Insights",
      items: [
        {
          kind: "link",
          to: "/profit-loss",
          label: "Profit & loss",
          description: "P&L statement",
          icon: IconProfitLoss,
        },
        {
          kind: "link",
          to: "/analytics",
          label: "Analytics",
          description: "Exports & summaries",
          icon: IconChart,
        },
      ],
    },
    {
      id: "people",
      label: "People",
      items: [
        {
          kind: "link",
          to: "/schedule",
          label: "Attendance",
          description: "Who works when",
          icon: IconCalendar,
        },
      ],
    },
    {
      id: "system",
      label: "System",
      items: [
        {
          kind: "link",
          to: "/audit",
          label: "Audit log",
          description: "Who changed what",
          icon: IconShield,
        },
      ],
    },
  ];

  if (includeAdmin) {
    groups.push({
      id: "admin",
      label: "Administration",
      items: [
        {
          kind: "link",
          to: "/admin",
          label: "Admin",
          description: "Team, pay & settings",
          icon: IconUsers,
        },
      ],
    });
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
    return pathname === "/reports" || pathname.startsWith("/entry");
  }
  if (to === "/admin") {
    return pathname === "/admin" || pathname.startsWith("/admin/");
  }
  return pathname === to || pathname.startsWith(to + "/");
}
