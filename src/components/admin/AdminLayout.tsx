import { NavLink, Outlet, useLocation } from "react-router-dom";

const tabs = [
  { to: "/admin/team", label: "Team", desc: "Cashiers & pay" },
  { to: "/admin/attendance", label: "Attendance", desc: "Schedule" },
  { to: "/admin/salaries", label: "Salaries", desc: "Payroll" },
  { to: "/admin/hours", label: "Hours", desc: "Open times" },
  { to: "/admin/audit", label: "Audit", desc: "Activity log" },
  { to: "/admin/settings", label: "Settings", desc: "Platforms" },
];

export function AdminLayout() {
  const { pathname } = useLocation();

  return (
    <div className="pb-8 -mx-4 px-4 md:-mx-8 md:px-8 max-w-4xl">
      <div className="mb-6">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">Admin</h2>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          Team, schedules, payroll, and restaurant hours
        </p>
      </div>

      <nav
        className="flex gap-2 overflow-x-auto pb-2 mb-6 -mx-1 px-1 scrollbar-none"
        aria-label="Admin sections"
      >
        {tabs.map((t) => {
          const active = pathname === t.to || pathname.startsWith(t.to + "/");
          return (
            <NavLink
              key={t.to}
              to={t.to}
              className={`flex flex-col min-w-[5.5rem] px-3 py-2.5 rounded-xl border text-left transition shrink-0 ${
                active
                  ? "bg-[var(--color-saffron)] text-white border-[var(--color-saffron)] shadow-sm"
                  : "bg-white border-black/10 hover:border-[var(--color-saffron)]/40"
              }`}
            >
              <span className="text-sm font-semibold">{t.label}</span>
              <span
                className={`text-[10px] mt-0.5 ${active ? "text-white/80" : "text-[var(--color-muted)]"}`}
              >
                {t.desc}
              </span>
            </NavLink>
          );
        })}
      </nav>

      <Outlet />
    </div>
  );
}
