import { useMemo, useState } from "react";
import { Link, Outlet, useLocation, Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
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
import { CommandPalette, openCommandPalette } from "../search/CommandPalette";
import { NotificationCenter } from "../notifications/NotificationCenter";
import { TopAppBar } from "./TopAppBar";

/**
 * v3 application shell (restructure, May 2026).
 *
 * <p>Three big changes vs v2:
 * <ol>
 *   <li>Slimmer dark sidebar focused on navigation only — user info
 *       and logout moved into the top-bar dropdown so the sidebar can
 *       fit more sections.</li>
 *   <li>Sticky white top bar with breadcrumb, persistent search trigger,
 *       notifications, and user menu. Replaces the page-by-page header
 *       chrome that was previously inconsistent.</li>
 *   <li>Admin routes no longer wrap in a second sidebar — the unified
 *       left nav surfaces every page; AdminLayout is just an Outlet
 *       wrapper now.</li>
 * </ol></p>
 */
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
      {/* Desktop sidebar — navigation only. User info and logout live in
          the TopAppBar dropdown to free up vertical space for sections. */}
      <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:w-[var(--sidebar-width)] bg-[var(--color-ink)] text-white">
        <div className="px-5 pt-5 pb-3 border-b border-white/[0.08]">
          <Link to="/" className="block group">
            <h1 className="font-[family-name:var(--font-display)] text-2xl tracking-tight leading-none group-hover:text-white/90 transition">
              Saffron
            </h1>
            <p className="text-white/40 text-[11px] mt-1 font-medium">Cash flow</p>
          </Link>
        </div>

        <div className="px-3 pt-3 pb-2">
          <button
            type="button"
            onClick={openCommandPalette}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-sm text-white/55 hover:text-white transition border border-white/[0.04]"
            aria-label="Search"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <span className="flex-1 text-left">Search</span>
            <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-white/50">
              ⌘K
            </kbd>
          </button>
        </div>

        <SidebarNav groups={groups} pathname={loc.pathname} />
      </aside>

      <div className="flex-1 md:ml-[var(--sidebar-width)] flex flex-col min-h-screen">
        {/* Desktop top bar */}
        <TopAppBar />

        {/* Mobile mini-header */}
        <header className="md:hidden sticky top-0 z-30 bg-[var(--color-ink)] text-white px-4 py-3 border-b border-white/10">
          <div className="flex items-center justify-between gap-3">
            <Link to="/" className="min-w-0">
              <h1 className="font-[family-name:var(--font-display)] text-xl tracking-tight">Saffron</h1>
              <p className="text-white/55 text-xs truncate">{user.name}</p>
            </Link>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={openCommandPalette}
                aria-label="Search"
                className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </button>
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

        <main className="flex-1 w-full mx-auto px-4 py-5 md:px-10 md:py-8 page-main max-w-6xl">
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
