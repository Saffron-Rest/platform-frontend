import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { search, type SearchHit, type SearchResponse } from "../../api/search";

const RECENTS_KEY = "saffron.cmdk.recents";
const MAX_RECENTS = 6;

/**
 * Global command palette opened with ⌘K (Cmd+K on macOS, Ctrl+K elsewhere).
 *
 * - Debounced server search, grouped results, keyboard navigable
 * - Built-in quick actions (new expense, today's report, admin pages…)
 *   that match by literal label and always show even without server hits
 * - Recent searches and recent navigations persist in localStorage
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const [recents, setRecents] = useState<string[]>(loadRecents);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Global hotkey — bound once to window. Also listens for the custom
  // {@code saffron:cmdk-open} event so any UI (sidebar button, empty
  // state CTA, etc.) can pop the palette without prop-drilling.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    const openEvt = () => setOpen(true);
    window.addEventListener("keydown", handler);
    window.addEventListener("saffron:cmdk-open", openEvt);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("saffron:cmdk-open", openEvt);
    };
  }, [open]);

  // Reset state on open. Auto-focus the input after the modal animates in.
  useEffect(() => {
    if (open) {
      setQuery("");
      setResult(null);
      setSelected(0);
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Debounced server search — 180ms feels snappy without spamming requests.
  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < 1) {
      setResult(null);
      return;
    }
    setLoading(true);
    const handle = setTimeout(() => {
      search(trimmed)
        .then((r) => setResult(r))
        .catch(() => setResult({ query: trimmed, total: 0, groups: {} }))
        .finally(() => setLoading(false));
    }, 180);
    return () => clearTimeout(handle);
  }, [query, open]);

  // Quick actions are static — defined here so they don't import circularly
  // with the route definitions. Keep tags ("Go to", "Add", "Open") in the
  // title so plain-language queries like "go to payroll" still match.
  const quickActions = useMemo<SearchHit[]>(
    () => [
      // Daily actions — surfaced first because they're the highest-frequency tasks.
      { type: "audit", id: "qa-new-shift", title: "New shift report", subtitle: "Cashier entry", url: "/entry", score: 100 },
      { type: "audit", id: "qa-add-expense", title: "Add expense", subtitle: "Finance ledger", url: "/finance?add=expense", score: 100 },
      { type: "audit", id: "qa-add-delivery", title: "Add delivery income", subtitle: "Finance ledger", url: "/finance?add=delivery", score: 100 },
      { type: "audit", id: "qa-checklists", title: "Open daily checklists", subtitle: "Operations", url: "/checklists", score: 100 },
      { type: "audit", id: "qa-haccp", title: "Log HACCP entry", subtitle: "Food safety", url: "/haccp", score: 100 },

      // Reports & analytics
      { type: "audit", id: "qa-dashboard", title: "Go to dashboard", subtitle: "Overview", url: "/", score: 95 },
      { type: "audit", id: "qa-reports", title: "Go to shift reports", subtitle: "History", url: "/reports", score: 95 },
      { type: "audit", id: "qa-analytics", title: "Go to analytics", subtitle: "Reports & PDF export", url: "/analytics", score: 95 },
      { type: "audit", id: "qa-pl", title: "Go to profit & loss", subtitle: "Reports", url: "/profit-loss", score: 95 },
      { type: "audit", id: "qa-finance", title: "Go to finance ledger", subtitle: "Expenses & income", url: "/finance", score: 95 },
      { type: "audit", id: "qa-menu", title: "Go to menu analytics", subtitle: "Reports", url: "/menu", score: 90 },
      { type: "audit", id: "qa-menu-eng", title: "Menu engineering matrix", subtitle: "Reports", url: "/menu/engineering", score: 90 },
      { type: "audit", id: "qa-treasury", title: "Treasury history", subtitle: "Reports", url: "/treasury/history", score: 90 },

      // Admin — Operations
      { type: "audit", id: "qa-inbox", title: "Admin · inbox", subtitle: "Open issues & data health", url: "/admin/inbox", score: 85 },
      { type: "audit", id: "qa-attendance", title: "Admin · schedule", subtitle: "Calendar & shifts", url: "/admin/attendance", score: 85 },
      { type: "audit", id: "qa-admin-menu", title: "Admin · menu items", subtitle: "Items, prices, costs", url: "/admin/menu", score: 85 },
      { type: "audit", id: "qa-admin-recipes", title: "Admin · recipes", subtitle: "Cost cards & price suggestions", url: "/admin/recipes", score: 85 },
      { type: "audit", id: "qa-stock", title: "Admin · stock", subtitle: "Inventory & POS sync", url: "/admin/stock", score: 85 },
      { type: "audit", id: "qa-incidents", title: "Admin · incidents", subtitle: "Breakages, complaints, accidents", url: "/admin/incidents", score: 85 },
      { type: "audit", id: "qa-admin-checklists", title: "Admin · checklist templates", subtitle: "Opening / closing tasks", url: "/admin/checklists", score: 85 },
      { type: "audit", id: "qa-admin-haccp", title: "Admin · HACCP logs", subtitle: "Food-safety history & export", url: "/admin/haccp", score: 85 },

      // Admin — People
      { type: "audit", id: "qa-team", title: "Admin · team", subtitle: "People & roles", url: "/admin/team", score: 85 },
      { type: "audit", id: "qa-salaries", title: "Admin · payroll", subtitle: "Calculate pay", url: "/admin/salaries", score: 85 },
      { type: "audit", id: "qa-payouts", title: "Admin · payouts", subtitle: "Approvals", url: "/admin/payouts", score: 85 },
      { type: "audit", id: "qa-certs", title: "Admin · certifications", subtitle: "Sanepid, expiry alerts", url: "/admin/certifications", score: 85 },

      // Admin — Setup
      { type: "audit", id: "qa-hours", title: "Admin · restaurant hours", subtitle: "Opening times", url: "/admin/hours", score: 80 },
      { type: "audit", id: "qa-pos", title: "Admin · POS integrations", subtitle: "Webhooks", url: "/admin/pos", score: 80 },
      { type: "audit", id: "qa-tags", title: "Admin · tag library", subtitle: "Custom labels", url: "/admin/tags", score: 80 },
      { type: "audit", id: "qa-security", title: "Admin · security & 2FA", subtitle: "Personal security settings", url: "/admin/security", score: 80 },
      { type: "audit", id: "qa-settings", title: "Admin · settings", subtitle: "Restaurant-wide settings", url: "/admin/settings", score: 80 },
      { type: "audit", id: "qa-audit", title: "Audit log", subtitle: "Who changed what", url: "/audit", score: 80 },
    ],
    []
  );

  const matchingQuickActions = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Surface the top frequent-use actions when the input is empty so
    // first-time openers see useful destinations, not a blank dialog.
    if (!q) return quickActions.slice(0, 6);
    return quickActions.filter((a) =>
      a.title.toLowerCase().includes(q) ||
      (a.subtitle ?? "").toLowerCase().includes(q)
    );
  }, [query, quickActions]);

  // Build the flat row list in display order so arrow keys move through
  // groups continuously instead of jumping within one group only.
  const flatRows: { group: string; hit: SearchHit }[] = useMemo(() => {
    const rows: { group: string; hit: SearchHit }[] = [];
    if (matchingQuickActions.length > 0) {
      for (const hit of matchingQuickActions) rows.push({ group: "Quick actions", hit });
    }
    if (result) {
      for (const [groupKey, hits] of Object.entries(result.groups)) {
        if (!hits) continue;
        const label = groupLabel(groupKey);
        for (const hit of hits) rows.push({ group: label, hit });
      }
    }
    return rows;
  }, [result, matchingQuickActions]);

  // Clamp the cursor whenever the row list shrinks (typing narrows results).
  useEffect(() => {
    if (selected >= flatRows.length) setSelected(Math.max(0, flatRows.length - 1));
  }, [flatRows.length, selected]);

  // Scroll selected row into view.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-cmdk-row="${selected}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [selected, open]);

  const onPick = useCallback(
    (hit: SearchHit) => {
      const trimmed = query.trim();
      if (trimmed) saveRecent(trimmed, setRecents);
      setOpen(false);
      navigate(hit.url);
    },
    [navigate, query]
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(flatRows.length - 1, s + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(0, s - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const row = flatRows[selected];
      if (row) onPick(row.hit);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/40 flex items-start justify-center pt-[10vh] px-4"
      role="dialog"
      aria-modal="true"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-4 py-3 border-b border-black/10 flex items-center gap-3">
          <svg
            viewBox="0 0 24 24"
            className="w-5 h-5 text-[var(--color-muted)]"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search anything… reports, expenses, payouts, people"
            className="flex-1 text-base outline-none bg-transparent"
          />
          <kbd className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-[var(--color-cream)] text-[var(--color-muted)] border border-black/10">
            Esc
          </kbd>
        </header>

        <div ref={listRef} className="flex-1 overflow-y-auto">
          {query.trim().length === 0 && recents.length > 0 && (
            <div>
              <p className="px-4 py-2 text-[10px] uppercase tracking-wide text-[var(--color-muted)] bg-[var(--color-cream)]/50">
                Recent searches
              </p>
              <ul>
                {recents.map((r) => (
                  <li key={r}>
                    <button
                      type="button"
                      className="w-full text-left px-4 py-2 hover:bg-[var(--color-cream)]/60 text-sm flex items-center gap-2"
                      onClick={() => setQuery(r)}
                    >
                      <span className="text-[var(--color-muted)]">↺</span>
                      {r}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {flatRows.length === 0 && query.trim().length > 0 && !loading && (
            <p className="px-4 py-6 text-sm text-[var(--color-muted)] text-center">
              No results for "{query.trim()}".
            </p>
          )}

          {loading && (
            <p className="px-4 py-3 text-xs text-[var(--color-muted)]">Searching…</p>
          )}

          {renderGrouped(flatRows, selected, onPick)}
        </div>

        <footer className="px-4 py-2 border-t border-black/10 flex items-center gap-3 text-[10px] text-[var(--color-muted)] bg-[var(--color-cream)]/40">
          <span>
            <kbd className="px-1 py-0.5 rounded bg-white border border-black/10">↑↓</kbd>{" "}
            navigate
          </span>
          <span>
            <kbd className="px-1 py-0.5 rounded bg-white border border-black/10">⏎</kbd>{" "}
            select
          </span>
          <span className="ml-auto">
            <kbd className="px-1 py-0.5 rounded bg-white border border-black/10">⌘K</kbd>{" "}
            toggle
          </span>
        </footer>
      </div>
    </div>
  );
}

function renderGrouped(
  rows: { group: string; hit: SearchHit }[],
  selected: number,
  onPick: (hit: SearchHit) => void
) {
  if (rows.length === 0) return null;
  const out: React.ReactNode[] = [];
  let lastGroup = "";
  rows.forEach((row, idx) => {
    if (row.group !== lastGroup) {
      lastGroup = row.group;
      out.push(
        <p
          key={`g-${row.group}`}
          className="px-4 py-2 text-[10px] uppercase tracking-wide text-[var(--color-muted)] bg-[var(--color-cream)]/50"
        >
          {row.group}
        </p>
      );
    }
    out.push(
      <button
        key={`r-${idx}`}
        type="button"
        data-cmdk-row={idx}
        onClick={() => onPick(row.hit)}
        className={`w-full text-left px-4 py-2 flex items-center gap-3 hover:bg-[var(--color-cream)]/60 ${
          selected === idx ? "bg-[var(--color-cream)]/70" : ""
        }`}
      >
        <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-saffron-dark)] w-14 shrink-0">
          {row.hit.type}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm truncate">{row.hit.title}</p>
          {row.hit.subtitle && (
            <p className="text-[11px] text-[var(--color-muted)] truncate">
              {row.hit.subtitle}
            </p>
          )}
        </div>
        <span className="text-[10px] text-[var(--color-muted)]">↵</span>
      </button>
    );
  });
  return out;
}

function groupLabel(key: string): string {
  switch (key) {
    case "entries":
      return "Shift reports";
    case "expenses":
      return "Expenses";
    case "payouts":
      return "Payouts";
    case "deliveries":
      return "Delivery income";
    case "people":
      return "People";
    case "tags":
      return "Tags";
    case "comments":
      return "Comments";
    case "audit":
      return "Audit log";
    default:
      return key;
  }
}

function loadRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed.filter((s) => typeof s === "string").slice(0, MAX_RECENTS);
    return [];
  } catch {
    return [];
  }
}

function saveRecent(value: string, set: (next: string[]) => void) {
  try {
    const cur = loadRecents();
    const next = [value, ...cur.filter((s) => s !== value)].slice(0, MAX_RECENTS);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
    set(next);
  } catch {
    // ignored
  }
}

/**
 * Open the global command palette from anywhere. Fires a custom event
 * picked up by the mounted {@link CommandPalette} — avoids prop-drilling
 * an "open" callback through every layout component.
 */
export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent("saffron:cmdk-open"));
}
