import { useEffect, useRef, useState } from "react";
import {
  createTag,
  listTags,
  setTagsForEntity,
  type Tag,
  type TaggedEntityType,
} from "../../api/tags";
import { TagChip } from "./TagChip";

/**
 * Inline tag editor for a single record.
 *
 * Displays the currently-assigned tags as chips and a "+ Tag" button that
 * opens a picker. The picker:
 *  - filters available tags by typed query
 *  - lets the user check/uncheck multiple at once
 *  - offers "Create '<query>'" when no exact match exists
 *  - saves on close (replace-all semantics — one network roundtrip)
 *
 * Tag library is cached in module memory between picker opens; refetched
 * after any create so the new tag is selectable elsewhere.
 */

let libraryCache: Tag[] | null = null;
const cacheSubscribers = new Set<() => void>();

function notifyCache() {
  for (const cb of cacheSubscribers) cb();
}

function useTagLibrary() {
  const [tags, setTags] = useState<Tag[]>(libraryCache ?? []);
  const [loading, setLoading] = useState(libraryCache == null);
  useEffect(() => {
    const sub = () => setTags(libraryCache ?? []);
    cacheSubscribers.add(sub);
    if (libraryCache == null) {
      setLoading(true);
      listTags()
        .then((r) => {
          libraryCache = r;
          notifyCache();
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
    return () => {
      cacheSubscribers.delete(sub);
    };
  }, []);
  const refresh = async () => {
    const r = await listTags();
    libraryCache = r;
    notifyCache();
    return r;
  };
  return { tags, loading, refresh };
}

/** External helper to bust the cache after admin edits in the Tag Library page. */
export function invalidateTagLibrary() {
  libraryCache = null;
  notifyCache();
}

export function TagPicker({
  entityType,
  entityId,
  initialTags,
  onChange,
  disabled,
  buttonLabel = "+ Tag",
  size = "md",
}: {
  entityType: TaggedEntityType;
  entityId: string;
  initialTags: Tag[];
  /** Notified after each successful save with the newly applied tag list. */
  onChange?: (next: Tag[]) => void;
  disabled?: boolean;
  buttonLabel?: string;
  size?: "sm" | "md";
}) {
  const { tags: library, refresh } = useTagLibrary();
  const [assigned, setAssigned] = useState<Tag[]>(initialTags);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  // Keep state in sync if the parent provides a fresh list (e.g. after
  // refetching the page).
  useEffect(() => {
    setAssigned(initialTags);
  }, [initialTags]);

  // Close the popover on outside click. Plain mousedown is enough — we
  // also don't trap focus inside since this is a casual editor.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const assignedIds = new Set(assigned.map((t) => t.id));
  const filteredLibrary = library
    .filter((t) => t.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));
  const exactMatch = library.find(
    (t) => t.name.toLowerCase() === query.trim().toLowerCase()
  );
  const canCreate = query.trim().length > 0 && !exactMatch;

  const toggle = async (tag: Tag) => {
    if (disabled) return;
    const next = assignedIds.has(tag.id)
      ? assigned.filter((t) => t.id !== tag.id)
      : [...assigned, tag];
    await commit(next);
  };

  const commit = async (next: Tag[]) => {
    setSaving(true);
    setError("");
    try {
      await setTagsForEntity(entityType, entityId, next.map((t) => t.id));
      setAssigned(next);
      onChange?.(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update tags");
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!query.trim()) return;
    setSaving(true);
    setError("");
    try {
      const created = await createTag({ name: query.trim() });
      await refresh();
      const next = [...assigned, created];
      await setTagsForEntity(entityType, entityId, next.map((t) => t.id));
      setAssigned(next);
      onChange?.(next);
      setQuery("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create tag");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div ref={rootRef} className="inline-flex items-center gap-1.5 flex-wrap relative">
      {assigned.map((t) => (
        <TagChip
          key={t.id}
          tag={t}
          size={size}
          onRemove={disabled ? undefined : () => void toggle(t)}
        />
      ))}
      {!disabled && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-xs font-medium text-[var(--color-saffron-dark)] px-2 py-0.5 rounded-full border border-dashed border-[var(--color-saffron)]/40 hover:bg-[var(--color-saffron)]/10"
        >
          {buttonLabel}
        </button>
      )}
      {open && (
        <div
          className="absolute left-0 top-full mt-1 z-30 w-72 rounded-xl border border-black/10 bg-white shadow-lg overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-2 border-b border-black/5">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search or create tag…"
              className="w-full text-sm px-2 py-1.5 rounded-md border border-black/10 focus:outline-none focus:ring-2 focus:ring-[var(--color-saffron)]/40"
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {filteredLibrary.length === 0 && !canCreate && (
              <p className="text-xs text-[var(--color-muted)] px-3 py-2">
                No tags yet. Type a name and press Create.
              </p>
            )}
            {filteredLibrary.map((t) => {
              const isAssigned = assignedIds.has(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => void toggle(t)}
                  disabled={saving}
                  className={`w-full text-left px-3 py-1.5 flex items-center gap-2 text-sm hover:bg-[var(--color-cream)]/60 ${
                    isAssigned ? "font-medium" : ""
                  }`}
                >
                  <span
                    className="w-3.5 h-3.5 rounded border flex items-center justify-center text-[10px] leading-none"
                    style={{
                      borderColor: "#0003",
                      background: isAssigned ? "var(--color-saffron)" : "white",
                      color: "white",
                    }}
                  >
                    {isAssigned ? "✓" : ""}
                  </span>
                  <TagChip tag={t} size="sm" />
                  <span className="ml-auto text-[10px] text-[var(--color-muted)] tabular-nums">
                    {t.usageCount ?? 0}
                  </span>
                </button>
              );
            })}
            {canCreate && (
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={saving}
                className="w-full text-left px-3 py-2 text-sm border-t border-black/5 hover:bg-[var(--color-cream)]/60"
              >
                + Create "<strong>{query.trim()}</strong>"
              </button>
            )}
          </div>
          {error && (
            <p className="px-3 py-2 text-xs text-red-600 bg-red-50 border-t border-red-100">
              {error}
            </p>
          )}
          {saving && (
            <p className="px-3 py-1.5 text-[10px] text-[var(--color-muted)] border-t border-black/5">
              Saving…
            </p>
          )}
        </div>
      )}
    </div>
  );
}
