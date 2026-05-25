import { NavLink, Outlet, useLocation } from "react-router-dom";
import { PageHeader } from "../ui/PageHeader";

const tabs = [
  { to: "/admin/inbox", label: "Inbox", desc: "Open issues" },
  { to: "/admin/team", label: "Team", desc: "People & pay rates" },
  { to: "/admin/attendance", label: "Schedule", desc: "Who works when" },
  { to: "/admin/salaries", label: "Payroll", desc: "Calculate pay" },
  { to: "/admin/payouts", label: "Manage pay", desc: "Rates & payouts" },
  { to: "/admin/hours", label: "Hours", desc: "Opening times" },
  { to: "/admin/settings", label: "Treasury", desc: "Balances & %" },
  { to: "/admin/menu", label: "Menu", desc: "Items, prices, costs" },
  { to: "/admin/pos", label: "POS", desc: "Webhook integrations" },
  { to: "/admin/tags", label: "Tags", desc: "Custom labels" },
];

export function AdminLayout() {
  const { pathname } = useLocation();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Administration"
        subtitle="Team, schedules, payroll, and treasury settings"
      />

      <nav
        data-tour="tour-admin-tabs"
        className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none"
        aria-label="Admin sections"
      >
        {tabs.map((t) => {
          const active = pathname === t.to || pathname.startsWith(t.to + "/");
          return (
            <NavLink
              key={t.to}
              to={t.to}
              className={`tab-pill shrink-0 ${active ? "tab-pill-active" : "tab-pill-idle"}`}
            >
              {t.label}
            </NavLink>
          );
        })}
      </nav>

      <Outlet />
    </div>
  );
}
