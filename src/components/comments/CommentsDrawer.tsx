import { useCallback, useEffect, useRef, useState } from "react";
import {
  createComment,
  deleteComment,
  listComments,
  updateComment,
  type Comment,
} from "../../api/comments";
import type { TaggedEntityType } from "../../api/tags";

/**
 * Slide-in drawer for record comments. Stays mounted as a portal-like
 * element on the right; closes on backdrop click / Esc.
 *
 * Pattern: drop a <CommentsTrigger> on any record list/detail, and render
 * the matching <CommentsDrawer> inside the same page tree. Both are
 * controlled — the page owns `open`, `entityType`, `entityId`.
 */
export function CommentsDrawer({
  open,
  entityType,
  entityId,
  title,
  onClose,
  onCountChange,
}: {
  open: boolean;
  entityType: TaggedEntityType | null;
  entityId: string | null;
  title?: string;
  onClose: () => void;
  /** Notified when the comment count changes — list pages use this to
   *  refresh their tile counters without re-fetching the whole list. */
  onCountChange?: (entityId: string, count: number) => void;
}) {
  const [items, setItems] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!entityType || !entityId) return;
    setLoading(true);
    setError("");
    try {
      const rows = await listComments(entityType, entityId);
      setItems(rows);
      onCountChange?.(entityId, rows.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load comments");
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, onCountChange]);

  // Reset state on every open so we never display stale data from a
  // different record.
  useEffect(() => {
    if (open) {
      setDraft("");
      setEditingId(null);
      setEditDraft("");
      void load();
      // Focus the textarea after the drawer animates in.
      const t = setTimeout(() => textRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [open, load]);

  // Auto-scroll to bottom when items change (new comment posted).
  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items, open]);

  // Esc closes — only when not in the middle of editing a comment.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && editingId == null) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, editingId, onClose]);

  const post = async () => {
    if (!entityType || !entityId) return;
    const body = draft.trim();
    if (!body) return;
    setSaving(true);
    setError("");
    try {
      const created = await createComment(entityType, entityId, body);
      setItems((prev) => [...prev, created]);
      onCountChange?.(entityId, items.length + 1);
      setDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not post");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (c: Comment) => {
    setEditingId(c.id);
    setEditDraft(c.body);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const body = editDraft.trim();
    if (!body) return;
    setSaving(true);
    try {
      const updated = await updateComment(editingId, body);
      setItems((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setEditingId(null);
      setEditDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: Comment) => {
    if (!confirm("Delete this comment? This cannot be undone.")) return;
    try {
      await deleteComment(c.id);
      setItems((prev) => {
        const next = prev.filter((x) => x.id !== c.id);
        if (entityId) onCountChange?.(entityId, next.length);
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex" aria-modal="true" role="dialog">
      <button
        type="button"
        className="flex-1 bg-black/40"
        onClick={onClose}
        aria-label="Close comments"
      />
      <aside className="w-full sm:w-[420px] bg-white flex flex-col shadow-2xl">
        <header className="px-4 py-3 border-b border-black/10 flex items-center gap-3">
          <h3 className="font-semibold flex-1 min-w-0 truncate">
            {title ?? "Comments"}
          </h3>
          <span className="text-xs text-[var(--color-muted)] tabular-nums">
            {items.length}
          </span>
          <button
            type="button"
            className="text-[var(--color-muted)] hover:text-[var(--color-ink)] text-lg leading-none"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div
          ref={listRef}
          className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-[var(--color-cream)]/30"
        >
          {loading && (
            <p className="text-sm text-[var(--color-muted)] text-center py-6">
              Loading…
            </p>
          )}
          {!loading && items.length === 0 && (
            <p className="text-sm text-[var(--color-muted)] text-center py-6">
              No comments yet. Be the first to leave a note.
            </p>
          )}
          {items.map((c) => {
            const isEditing = editingId === c.id;
            return (
              <article
                key={c.id}
                className="rounded-2xl bg-white border border-black/5 p-3 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-medium text-sm">{c.authorName}</span>
                  <span className="text-[10px] text-[var(--color-muted)] tabular-nums">
                    {formatRelative(c.createdAt)}
                    {c.editedAt ? " · edited" : ""}
                  </span>
                  {c.canEdit && !isEditing && (
                    <span className="ml-auto flex gap-2">
                      <button
                        type="button"
                        className="text-[10px] font-medium text-[var(--color-saffron-dark)] hover:underline"
                        onClick={() => startEdit(c)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-[10px] font-medium text-red-600 hover:underline"
                        onClick={() => void remove(c)}
                      >
                        Delete
                      </button>
                    </span>
                  )}
                </div>
                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      rows={3}
                      className="w-full text-sm px-2 py-1.5 rounded-md border border-black/10 resize-y focus:outline-none focus:ring-2 focus:ring-[var(--color-saffron)]/40"
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setEditDraft("");
                        }}
                        className="text-xs text-[var(--color-muted)] px-2 py-1"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void saveEdit()}
                        disabled={saving}
                        className="text-xs font-medium text-[var(--color-saffron-dark)] hover:underline"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap leading-relaxed break-words">
                    {renderBody(c.body)}
                  </p>
                )}
              </article>
            );
          })}
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 px-4 py-2 border-t border-red-100">
            {error}
          </p>
        )}

        <footer className="border-t border-black/10 p-3 space-y-2 bg-white">
          <textarea
            ref={textRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Ctrl/Cmd+Enter posts — convention for chat-style inputs.
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                void post();
              }
            }}
            rows={3}
            placeholder="Write a comment… use @username to mention someone"
            className="w-full text-sm px-2 py-2 rounded-md border border-black/10 resize-y focus:outline-none focus:ring-2 focus:ring-[var(--color-saffron)]/40"
          />
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-[var(--color-muted)]">
              ⌘/Ctrl+Enter to post
            </span>
            <button
              type="button"
              onClick={() => void post()}
              disabled={saving || !draft.trim()}
              className="px-3 py-1.5 rounded-md bg-[var(--color-saffron)] text-white text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Posting…" : "Post"}
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}

/** Inline trigger button — shows the bubble icon + count. Use on any row
 *  to open the drawer for that record. */
export function CommentsTrigger({
  count,
  onClick,
  className = "",
}: {
  count: number;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className={`inline-flex items-center gap-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-saffron-dark)] ${className}`}
      title={count > 0 ? `${count} comment${count === 1 ? "" : "s"}` : "Add comment"}
    >
      <svg
        viewBox="0 0 24 24"
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      {count > 0 && <span className="tabular-nums">{count}</span>}
    </button>
  );
}

/** Lightweight relative-time formatter — avoids pulling in a full library
 *  for a single use. Falls back to a date for anything > 7 days old. */
function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const seconds = Math.round((now - then) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

/** Highlight @mention tokens inside the comment body so they read like
 *  the rest of the system (similar to Slack/Linear). */
function renderBody(body: string) {
  const parts = body.split(/(@[A-Za-z0-9._-]{3,32})/g);
  return parts.map((p, i) =>
    p.startsWith("@") ? (
      <span
        key={i}
        className="font-medium text-[var(--color-saffron-dark)] bg-[var(--color-saffron)]/10 px-1 rounded"
      >
        {p}
      </span>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}
