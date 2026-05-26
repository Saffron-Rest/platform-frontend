import { useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { PageHeader } from "../ui/PageHeader";
import {
  IconBadge,
  IconBoxes,
  IconCalendar,
  IconCash,
  IconCheckSquare,
  IconClock,
  IconInbox,
  IconKey,
  IconMenuBars,
  IconSearch,
  IconShield,
  IconTag,
  IconThermometer,
  IconUsers,
  IconUtensils,
  IconWallet,
  IconWarning,
} from "../icons";

/**
 * Admin shell.
 *
 * <p>Until v3 this was a single horizontal pill row that quickly became
 * unscannable as the product grew (16 pages and counting). We now organise
 * destinations into four functional groups:</p>
 *
 * <ul>
 *   <li><b>Operations</b> — daily restaurant running (Inbox, Schedule,
 *       Menu, Stock, Incidents, Checklists, HACCP).</li>
 *   <li><b>People</b> — team, payroll, certifications.</li>
 *   <li><b>Finance</b> — treasury settings + pay rates.</li>
 *   <li><b>Setup</b> — infrequent configuration (Hours, POS, Tags, Security).</li>
 * </ul>
 *
 * <p>Each item carries an icon (visual scanning) and a one-line description
 * (recall what the page does without clicking). A search box filters the
 * whole sidebar by either label or description. On mobile the sidebar
 * collapses to a hamburger drawer.</p>
 */

type NavItem = {
  to: string;
  label: string;
  desc: string;
  Icon: (props: { className?: string }) => JSX.Element;
};

type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

const groups: NavGroup[] = [
  {
    id: "operations",
    label: "Operations",
    items: [
      { to: "/admin/inbox", label: "Inbox", desc: "Open issues & data health", Icon: IconInbox },
      { to: "/admin/attendance", label: "Schedule", desc: "Who works when", Icon: IconCalendar },
      { to: "/admin/menu", label: "Menu", desc: "Items, prices, costs", Icon: IconUtensils },
      { to: "/admin/stock", label: "Stock", desc: "Inventory & POS sync", Icon: IconBoxes },
      { to: "/admin/incidents", label: "Incidents", desc: "Breakages, complaints, accidents", Icon: IconWarning },
      { to: "/admin/checklists", label: "Checklists", desc: "Opening / closing tasks", Icon: IconCheckSquare },
      { to: "/admin/haccp", label: "HACCP", desc: "Food-safety logs", Icon: IconThermometer },
    ],
  },
  {
    id: "people",
    label: "People",
    items: [
      { to: "/admin/team", label: "Team", desc: "People & roles", Icon: IconUsers },
      { to: "/admin/salaries", label: "Payroll", desc: "Calculate pay", Icon: IconCash },
      { to: "/admin/certifications", label: "Certifications", desc: "Sanepid, expiry alerts", Icon: IconBadge },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    items: [
      { to: "/admin/settings", label: "Treasury", desc: "Balances & %", Icon: IconWallet },
      { to: "/admin/payouts", label: "Pay rates", desc: "Rates & payouts", Icon: IconCash },
    ],
  },
  {
    id: "setup",
    label: "Setup",
    items: [
      { to: "/admin/hours", label: "Hours", desc: "Opening times", Icon: IconClock },
      { to: "/admin/pos", label: "POS", desc: "Webhook integrations", Icon: IconShield },
      { to: "/admin/tags", label: "Tags", desc: "Custom labels", Icon: IconTag },
      { to: "/admin/security", label: "Security", desc: "2FA & sessions", Icon: IconKey },
    ],
  },
];

export function AdminLayout() {
  const { pathname } = useLocation();
  const [filter, setFilter] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  // Filter both labels and descriptions so "salar" finds "Payroll" and
  // "drawer" would find any item that explains it in its description.
  const filtered = useMemo<NavGroup[]>(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (it) =>
            it.label.toLowerCase().includes(q) || it.desc.toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [filter]);

  const activeItem = useMemo(() => {
    for (const g of groups) {
      for (const it of g.items) {
        if (pathname === it.to || pathname.startsWith(it.to + "/")) return it;
      }
    }
    return null;
  }, [pathname]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Administration"
        subtitle={
          activeItem
            ? `${activeItem.label} · ${activeItem.desc}`
            : "Team, schedules, payroll, treasury, and configuration"
        }
        action={
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ring-1 ring-black/10 bg-white text-sm"
            aria-label="Toggle admin menu"
          >
            <IconMenuBars className="w-4 h-4" />
            <span>{mobileOpen ? "Hide menu" : activeItem?.label ?? "Menu"}</span>
          </button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4 md:gap-6">
        {/* Sidebar */}
        <aside
          data-tour="tour-admin-sidebar"
          className={`md:sticky md:top-4 md:max-h-[calc(100vh-2rem)] md:overflow-y-auto ${
            mobileOpen ? "block" : "hidden md:block"
          }`}
        >
          <div className="rounded-xl bg-white ring-1 ring-black/5 p-3">
            <label className="relative block mb-3">
              <span className="sr-only">Filter admin pages</span>
              <IconSearch className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)] pointer-events-none" />
              <input
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter…"
                className="field-input pl-8 py-1.5 text-sm w-full"
              />
            </label>

            {filtered.length === 0 ? (
              <div className="text-xs text-[var(--color-muted)] px-2 py-3">
                No admin pages match "{filter}".
              </div>
            ) : (
              <nav aria-label="Admin sections" className="space-y-4">
                {filtered.map((group) => (
                  <div key={group.id}>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)] px-2 mb-1">
                      {group.label}
                    </div>
                    <ul className="space-y-0.5">
                      {group.items.map((it) => {
                        const active =
                          pathname === it.to || pathname.startsWith(it.to + "/");
                        return (
                          <li key={it.to}>
                            <NavLink
                              to={it.to}
                              onClick={() => setMobileOpen(false)}
                              className={`group flex items-start gap-2.5 px-2 py-1.5 rounded-lg transition-colors ${
                                active
                                  ? "bg-[var(--color-saffron)]/15 text-[var(--color-ink)]"
                                  : "text-[var(--color-ink)] hover:bg-[var(--color-cream)]"
                              }`}
                            >
                              <it.Icon
                                className={`w-4 h-4 mt-0.5 shrink-0 ${
                                  active
                                    ? "text-[var(--color-saffron-dark)]"
                                    : "text-[var(--color-muted)] group-hover:text-[var(--color-ink)]"
                                }`}
                              />
                              <div className="min-w-0">
                                <div
                                  className={`text-sm leading-tight ${
                                    active ? "font-semibold" : "font-medium"
                                  }`}
                                >
                                  {it.label}
                                </div>
                                <div className="text-[11px] text-[var(--color-muted)] leading-tight mt-0.5 line-clamp-1">
                                  {it.desc}
                                </div>
                              </div>
                            </NavLink>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </nav>
            )}
          </div>
        </aside>

        {/* Main content */}
        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
