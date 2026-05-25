import { useMemo, useState } from "react";
import { Link, Outlet, useLocation, Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { roleLabel } from "../../lib/roles";
import {
  allNavLinks,
  navGroupsForRole,
  primaryNavLinks,
} from "../../lib/navigation";
import { Spinner } from "../ui/Spinner";
import { SidebarNav } from "./SidebarNav";
import { BottomNav } from "./BottomNav";
import { MoreMenu } from "./MoreMenu";
import { OnboardingProvider, useOnboarding } from "../../context/OnboardingContext";
import { CommandPalette } from "../search/CommandPalette";
import { NotificationCenter } from "../notifications/NotificationCenter";

function AppShellInner({
  moreOpen,
  setMoreOpen,
}: {
  moreOpen: boolean;
  setMoreOpen: (open: boolean) => void;
}) {
  const { user, loading, logout } = useAuth();
  const { openQuickGuide } = useOnboarding();
  const loc = useLocation();

  const groups = useMemo(() => navGroupsForRole(user?.role), [user?.role]);
  const primary = useMemo(() => primaryNavLinks(groups), [groups]);
  const primaryPaths = useMemo(() => new Set(primary.map((p) => p.to)), [primary]);

  const showMoreButton = allNavLinks(groups).length > primary.length;
  const mobilePrimary = showMoreButton ? primary.slice(0, 3) : primary;

  const moreActive =
    moreOpen ||
    allNavLinks(groups).some(
      (i) => !primaryPaths.has(i.to) && (loc.pathname === i.to || loc.pathname.startsWith(i.to + "/"))
    );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-cream)]">
        <Spinner label="Signing in…" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />;

  return (
    <div className="min-h-screen bg-[var(--color-cream)] md:flex">
      <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:w-[var(--sidebar-width)] bg-[var(--color-ink)] text-white">
        <div className="p-5 border-b border-white/10">
          <Link to="/" className="block group">
            <h1 className="font-[family-name:var(--font-display)] text-2xl tracking-tight group-hover:text-white/90 transition">
              Saffron
            </h1>
            <p className="text-white/50 text-xs mt-0.5">Cash flow</p>
          </Link>
          <div className="mt-4 flex items-center gap-3 min-w-0">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-saffron)] text-sm font-bold">
              {user.name.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{user.name}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/45">
                {roleLabel(user.role)}
              </p>
            </div>
            <NotificationCenter />
          </div>
        </div>
        <SidebarNav groups={groups} pathname={loc.pathname} />
        <div className="p-4 border-t border-white/10 space-y-2">
          <button
            type="button"
            onClick={openQuickGuide}
            data-tour="tour-help"
            className="w-full text-sm py-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition font-semibold text-white/90"
          >
            Guided tour
          </button>
          <button
            type="button"
            onClick={logout}
            className="w-full text-sm py-2.5 rounded-xl bg-white/10 hover:bg-white/15 transition font-semibold"
          >
            Log out
          </button>
        </div>
      </aside>

      <div className="flex-1 md:ml-[var(--sidebar-width)] flex flex-col min-h-screen">
        <header className="md:hidden sticky top-0 z-30 bg-[var(--color-ink)] text-white px-4 py-3 border-b border-white/10">
          <div className="flex items-center justify-between gap-3">
            <Link to="/" className="min-w-0">
              <h1 className="font-[family-name:var(--font-display)] text-xl tracking-tight">Saffron</h1>
              <p className="text-white/55 text-xs truncate">{user.name}</p>
            </Link>
            <div className="flex shrink-0 items-center gap-2">
              <NotificationCenter />
              <button
                type="button"
                onClick={openQuickGuide}
                data-tour="tour-help"
                className="text-xs font-semibold px-3 py-2 rounded-full bg-white/5 hover:bg-white/10"
              >
                Guide
              </button>
              <button
                type="button"
                onClick={logout}
                className="text-xs font-semibold px-3 py-2 rounded-full bg-white/10 hover:bg-white/15"
              >
                Log out
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 w-full mx-auto px-4 py-5 md:px-8 md:py-8 page-main max-w-3xl lg:max-w-4xl">
          <Outlet />
        </main>

        <BottomNav
          primary={mobilePrimary}
          pathname={loc.pathname}
          onMore={() => setMoreOpen(true)}
          moreActive={moreActive}
          showMore={showMoreButton}
        />
        {showMoreButton && (
          <MoreMenu
            open={moreOpen}
            onClose={() => setMoreOpen(false)}
            groups={groups}
            pathname={loc.pathname}
            primaryPaths={primaryPaths}
          />
        )}
        <CommandPalette />
      </div>
    </div>
  );
}

export function AppShell() {
  const [moreOpen, setMoreOpen] = useState(false);
  return (
    <OnboardingProvider onOpenMoreMenu={() => setMoreOpen(true)}>
      <AppShellInner moreOpen={moreOpen} setMoreOpen={setMoreOpen} />
    </OnboardingProvider>
  );
}
