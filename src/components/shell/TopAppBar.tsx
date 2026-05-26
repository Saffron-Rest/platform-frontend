import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useOnboarding } from "../../context/OnboardingContext";
import { findActive, navGroupsForRole } from "../../lib/navigation";
import { roleLabel } from "../../lib/roles";
import {
  IconChevronDown,
  IconChevronRight,
  IconHelp,
  IconLogout,
  IconSearch,
} from "../icons";
import { NotificationCenter } from "../notifications/NotificationCenter";
import { openCommandPalette } from "../search/CommandPalette";

/**
 * Top application bar for the desktop shell.
 *
 * <p>Renders a slim white sticky header above every authenticated page
 * with four regions:
 * <ul>
 *   <li>Left: breadcrumb derived from the navigation IA</li>
 *   <li>Center: persistent search trigger (mock input that opens ⌘K)</li>
 *   <li>Right: notification bell + help + user menu dropdown</li>
 * </ul></p>
 *
 * <p>Mobile uses the existing dark mini-header in {@link AppShell} —
 * this component is hidden below {@code md}.</p>
 */
export function TopAppBar() {
  const { user, logout } = useAuth();
  const { openQuickGuide } = useOnboarding();
  const loc = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the user menu when clicking outside or pressing escape — the
  // dropdown is purely keyboard-friendly so we don't need a heavier
  // focus-trap library here.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const groups = navGroupsForRole(user?.role);
  const active = findActive(groups, loc.pathname);

  // Show OS-correct modifier hint in the search button. Falls back to
  // "Ctrl" outside the browser (jsdom in tests).
  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPod|iPad/i.test(navigator.platform || navigator.userAgent || "");
  const modKey = isMac ? "⌘" : "Ctrl";

  return (
    <header className="hidden md:flex sticky top-0 z-30 bg-white/85 backdrop-blur border-b border-black/[0.06] h-14 items-center gap-4 px-10">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm min-w-0 flex-1">
        {active ? (
          <>
            <span className="text-[var(--color-muted)]">{active.group.label}</span>
            <IconChevronRight className="w-3.5 h-3.5 text-[var(--color-muted)]/60 shrink-0" />
            <span className="text-[var(--color-ink)] font-medium truncate">
              {active.item.label}
            </span>
          </>
        ) : (
          <Link to="/" className="text-[var(--color-muted)] hover:text-[var(--color-ink)]">
            Home
          </Link>
        )}
      </nav>

      {/* Search trigger */}
      <button
        type="button"
        onClick={openCommandPalette}
        className="hidden lg:flex items-center gap-2 w-72 xl:w-96 px-3 py-1.5 rounded-lg border border-black/[0.08] bg-white hover:bg-[var(--color-cream)] transition text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        aria-label="Search"
      >
        <IconSearch className="w-4 h-4 shrink-0" />
        <span className="flex-1 text-left">Search anything…</span>
        <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--color-cream)] border border-black/[0.08] text-[var(--color-muted)]">
          {modKey} K
        </kbd>
      </button>
      <button
        type="button"
        onClick={openCommandPalette}
        className="lg:hidden p-2 rounded-lg hover:bg-[var(--color-cream)] text-[var(--color-muted)] hover:text-[var(--color-ink)] transition"
        aria-label="Search"
      >
        <IconSearch className="w-4 h-4" />
      </button>

      {/* Right: notifications + user */}
      <div className="flex items-center gap-1">
        <NotificationCenter />
        <button
          type="button"
          onClick={openQuickGuide}
          aria-label="Help"
          className="p-2 rounded-lg hover:bg-[var(--color-cream)] text-[var(--color-muted)] hover:text-[var(--color-ink)] transition"
          data-tour="tour-help"
        >
          <IconHelp className="w-4 h-4" />
        </button>

        {user && (
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 pl-1.5 pr-2 py-1 rounded-full hover:bg-[var(--color-cream)] transition"
              aria-label="Account menu"
              aria-expanded={menuOpen}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-saffron)] text-white text-xs font-bold">
                {user.name.charAt(0).toUpperCase()}
              </span>
              <span className="hidden xl:inline text-sm font-medium text-[var(--color-ink)] max-w-[8rem] truncate">
                {user.name}
              </span>
              <IconChevronDown className="w-3.5 h-3.5 text-[var(--color-muted)]" />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-60 bg-white rounded-xl shadow-lg border border-black/[0.06] overflow-hidden z-40"
              >
                <div className="px-3 py-3 border-b border-black/[0.05]">
                  <p className="text-sm font-semibold truncate">{user.name}</p>
                  <p className="text-xs text-[var(--color-muted)]">
                    {roleLabel(user.role)}
                  </p>
                </div>
                <MenuLink
                  to="/admin/security"
                  onClick={() => setMenuOpen(false)}
                  label="Security & 2FA"
                  description="Personal settings"
                />
                <MenuLink
                  to="/change-password"
                  onClick={() => setMenuOpen(false)}
                  label="Change password"
                />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    openQuickGuide();
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-cream)] transition flex items-center gap-2"
                >
                  <IconHelp className="w-4 h-4 text-[var(--color-muted)]" />
                  <span>Guided tour</span>
                </button>
                <div className="border-t border-black/[0.05]">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      logout();
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 text-[var(--color-danger)] transition flex items-center gap-2"
                  >
                    <IconLogout className="w-4 h-4" />
                    <span>Log out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

function MenuLink({
  to,
  label,
  description,
  onClick,
}: {
  to: string;
  label: string;
  description?: string;
  onClick: () => void;
}) {
  return (
    <Link
      to={to}
      role="menuitem"
      onClick={onClick}
      className="block px-3 py-2 text-sm hover:bg-[var(--color-cream)] transition"
    >
      <span className="block">{label}</span>
      {description && (
        <span className="block text-[11px] text-[var(--color-muted)]">{description}</span>
      )}
    </Link>
  );
}
