import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchNotificationInbox,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationInbox,
  type NotificationItem,
} from "../../api/notifications";
import { useAuth } from "../../context/AuthContext";

/** Polls the unread counter every minute; pulls the full inbox when the
 *  user opens the dropdown. Kept self-contained so it can drop into any
 *  layout — the bell button + popover both live here. */
export function NotificationCenter() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [inbox, setInbox] = useState<NotificationInbox | null>(null);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Only poll for authenticated, non-cashier users — the mobile app already
  // handles the cashier inbox via push + dedicated screen.
  const enabled = !!user && user.role !== "CASHIER";

  // Cheap unread poll — 60s interval.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const n = await fetchUnreadCount();
        if (!cancelled) setUnread(n);
      } catch {
        // Network blip — preserve the last known count.
      }
    };
    void fetchOnce();
    const handle = setInterval(() => void fetchOnce(), 60_000);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [enabled]);

  const openInbox = useCallback(async () => {
    setOpen(true);
    setLoading(true);
    try {
      const data = await fetchNotificationInbox();
      setInbox(data);
      setUnread(data.unread);
    } catch {
      // Show whatever we have — UI degrades gracefully on errors.
    } finally {
      setLoading(false);
    }
  }, []);

  // Close on outside click / Esc.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onPick = async (n: NotificationItem) => {
    setOpen(false);
    if (!n.readAt) {
      try {
        await markNotificationRead(n.id);
        setUnread((u) => Math.max(0, u - 1));
        setInbox((prev) =>
          prev
            ? {
                ...prev,
                items: prev.items.map((x) =>
                  x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x
                ),
              }
            : prev
        );
      } catch {
        // Mark-read failures shouldn't block navigation.
      }
    }
    if (n.url) navigate(n.url);
  };

  const onMarkAll = async () => {
    try {
      await markAllNotificationsRead();
      setUnread(0);
      setInbox((prev) =>
        prev
          ? {
              ...prev,
              unread: 0,
              items: prev.items.map((x) =>
                x.readAt ? x : { ...x, readAt: new Date().toISOString() }
              ),
            }
          : prev
      );
    } catch {
      // ignored
    }
  };

  if (!enabled) return null;

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : void openInbox())}
        className="relative p-2 rounded-lg hover:bg-white/10 text-white/80 hover:text-white"
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
      >
        <svg
          viewBox="0 0 24 24"
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-[360px] max-w-[92vw] bg-white text-[var(--color-ink)] rounded-2xl shadow-2xl overflow-hidden z-50 border border-black/10">
          <header className="px-4 py-3 border-b border-black/10 flex items-center gap-2">
            <h3 className="font-semibold flex-1">Notifications</h3>
            {(inbox?.unread ?? 0) > 0 && (
              <button
                type="button"
                onClick={() => void onMarkAll()}
                className="text-xs text-[var(--color-saffron-dark)] hover:underline"
              >
                Mark all read
              </button>
            )}
          </header>
          <div className="max-h-[60vh] overflow-y-auto">
            {loading ? (
              <p className="px-4 py-6 text-sm text-[var(--color-muted)] text-center">
                Loading…
              </p>
            ) : !inbox || inbox.items.length === 0 ? (
              <p className="px-4 py-6 text-sm text-[var(--color-muted)] text-center">
                You're all caught up.
              </p>
            ) : (
              <ul>
                {inbox.items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => void onPick(n)}
                      className={`w-full text-left px-4 py-3 hover:bg-[var(--color-cream)]/40 flex items-start gap-3 ${
                        n.readAt ? "" : "bg-[var(--color-cream)]/30"
                      }`}
                    >
                      {!n.readAt && (
                        <span
                          className="w-2 h-2 rounded-full bg-[var(--color-saffron)] mt-1.5 shrink-0"
                          aria-hidden
                        />
                      )}
                      <div className={`flex-1 min-w-0 ${n.readAt ? "pl-[14px]" : ""}`}>
                        <p className="text-sm font-medium truncate">{n.title}</p>
                        {n.body && (
                          <p className="text-xs text-[var(--color-muted)] mt-0.5 line-clamp-2 break-words">
                            {n.body}
                          </p>
                        )}
                        <p className="text-[10px] text-[var(--color-muted)] mt-1">
                          {formatRelative(n.createdAt)}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
