import { Link, Outlet, useLocation, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { IconCalendar, IconChart, IconClipboard, IconHome, IconProfitLoss, IconShield, IconUsers } from "./icons";
import { canOperate, isAdmin, roleLabel } from "../lib/roles";
import { Spinner } from "./ui/Spinner";

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }> };

const cashierNav: NavItem[] = [
  { to: "/", label: "Home", icon: IconHome },
  { to: "/entry", label: "Today", icon: IconClipboard },
  { to: "/schedule", label: "Schedule", icon: IconCalendar },
];

const managerNav: NavItem[] = [
  { to: "/", label: "Home", icon: IconHome },
  { to: "/reports", label: "Reports", icon: IconClipboard },
  { to: "/profit-loss", label: "P&L", icon: IconProfitLoss },
  { to: "/analytics", label: "Analytics", icon: IconChart },
  { to: "/audit", label: "Audit", icon: IconShield },
  { to: "/schedule", label: "Attendance", icon: IconCalendar },
];

const adminNav: NavItem[] = [
  ...managerNav,
  { to: "/admin", label: "Admin", icon: IconUsers },
];

function isActive(pathname: string, to: string) {
  if (to === "/reports")
    return pathname === "/reports" || pathname.startsWith("/entry");
  if (to === "/profit-loss") return pathname === "/profit-loss";
  if (to === "/entry") return pathname === "/entry" || pathname.startsWith("/entry/");
  if (to === "/admin") return pathname === "/admin" || pathname.startsWith("/admin/");
  if (to === "/audit") return pathname === "/audit";
  if (to === "/schedule") return pathname === "/schedule";
  return pathname === to;
}

function NavLink({ item, active, mobile }: { item: NavItem; active: boolean; mobile?: boolean }) {
  const Icon = item.icon;
  if (mobile) {
    return (
      <Link
        to={item.to}
        className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2 min-h-[3.25rem] transition ${
          active ? "text-[var(--color-saffron)]" : "text-[var(--color-muted)]"
        }`}
      >
        <Icon className={active ? "w-6 h-6" : "w-5 h-5"} />
        <span className="text-[10px] font-semibold tracking-wide">{item.label}</span>
      </Link>
    );
  }
  return (
    <Link
      to={item.to}
      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition ${
        active
          ? "bg-[var(--color-saffron)] text-white shadow-sm"
          : "text-white/70 hover:bg-white/10 hover:text-white"
      }`}
    >
      <Icon className="w-5 h-5 shrink-0" />
      {item.label}
    </Link>
  );
}

export function Layout() {
  const { user, loading, logout } = useAuth();
  const loc = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-cream)]">
        <Spinner label="Signing in…" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  const nav = isAdmin(user.role) ? adminNav : canOperate(user.role) ? managerNav : cashierNav;

  return (
    <div className="min-h-screen bg-[var(--color-cream)] md:flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-60 md:fixed md:inset-y-0 bg-[var(--color-ink)] text-white">
        <div className="p-6 border-b border-white/10">
          <h1 className="font-[family-name:var(--font-display)] text-2xl tracking-tight">Saffron</h1>
          <p className="text-white/60 text-sm mt-1 truncate">{user.name}</p>
          <span className="inline-block mt-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white/10">
            {roleLabel(user.role)}
          </span>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {nav.map((item) => (
            <NavLink key={item.to} item={item} active={isActive(loc.pathname, item.to)} />
          ))}
        </nav>
        <div className="p-4 border-t border-white/10">
          <button
            onClick={logout}
            className="w-full text-sm py-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition font-medium"
          >
            Log out
          </button>
        </div>
      </aside>

      <div className="flex-1 md:ml-60 flex flex-col min-h-screen">
        {/* Mobile header */}
        <header className="md:hidden bg-[var(--color-ink)] text-white px-4 py-3 sticky top-0 z-30">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-[family-name:var(--font-display)] text-xl tracking-tight">Saffron</h1>
              <p className="text-white/60 text-xs">{user.name}</p>
            </div>
            <button
              onClick={logout}
              className="text-xs px-3 py-2 rounded-full bg-white/10 hover:bg-white/20 transition font-medium"
            >
              Log out
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-5 md:px-8 md:py-8 page-main">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav
          className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white/95 backdrop-blur-md border-t border-black/10"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <div className="flex max-w-lg mx-auto">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                item={item}
                active={isActive(loc.pathname, item.to)}
                mobile
              />
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
