import { useCallback, useEffect, useState } from "react";
import {
  createSavedView,
  deleteSavedView,
  listSavedViews,
  updateSavedView,
  type SavedView,
} from "../../api/savedViews";

/**
 * Compact pinned-filters bar. The page passes the current filter object
 * via `currentFilters` and a callback to apply a stored filter set.
 *
 * Storage is per-user, per-page, server-side — so saved views follow the
 * user across devices.
 */
export function SavedViewsBar<Filters>({
  page,
  currentFilters,
  onApply,
}: {
  page: string;
  currentFilters: Filters;
  onApply: (filters: Filters) => void;
}) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listSavedViews(page);
      setViews(rows);
      // Apply the user's default once on first load. Avoid re-applying on
      // subsequent refreshes — that would trample interactive changes.
      const def = rows.find((v) => v.isDefault);
      if (def && activeId == null) {
        try {
          const parsed = JSON.parse(def.filters) as Filters;
          onApply(parsed);
          setActiveId(def.id);
        } catch {
          // Drop invalid JSON silently — the rest of the bar keeps working.
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load views");
    } finally {
      setLoading(false);
    }
    // Deliberately omit onApply/activeId — load is only invoked manually.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  const apply = (v: SavedView) => {
    try {
      const parsed = JSON.parse(v.filters) as Filters;
      onApply(parsed);
      setActiveId(v.id);
    } catch {
      setError("This saved view has corrupted filters");
    }
  };

  const save = async () => {
    const name = newName.trim();
    if (!name) return;
    setError("");
    try {
      const created = await createSavedView({
        page,
        name,
        filters: currentFilters,
      });
      setViews((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setActiveId(created.id);
      setNewName("");
      setShowAdd(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    }
  };

  const overwrite = async (v: SavedView) => {
    setError("");
    try {
      const updated = await updateSavedView(v.id, { filters: currentFilters });
      setViews((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update");
    }
  };

  const setDefault = async (v: SavedView) => {
    try {
      const updated = await updateSavedView(v.id, { isDefault: !v.isDefault });
      setViews((prev) =>
        prev.map((x) =>
          x.id === updated.id
            ? updated
            : updated.isDefault
            ? { ...x, isDefault: false }
            : x
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update");
    }
  };

  const remove = async (v: SavedView) => {
    if (!confirm(`Delete saved view "${v.name}"?`)) return;
    try {
      await deleteSavedView(v.id);
      setViews((prev) => prev.filter((x) => x.id !== v.id));
      if (activeId === v.id) setActiveId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete");
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] uppercase tracking-wide font-semibold text-[var(--color-muted)]">
          Views
        </span>
        {loading && (
          <span className="text-xs text-[var(--color-muted)]">…</span>
        )}
        {views.length === 0 && !loading && (
          <span className="text-xs text-[var(--color-muted)]">
            No saved views yet — pin the current filters with "Save view".
          </span>
        )}
        {views.map((v) => {
          const active = v.id === activeId;
          return (
            <span key={v.id} className="inline-flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => apply(v)}
                className={`px-2.5 py-1 rounded-l-full text-xs border transition ${
                  active
                    ? "bg-[var(--color-saffron)] border-[var(--color-saffron)] text-white"
                    : "bg-white border-black/10 hover:bg-[var(--color-cream)]/40"
                }`}
                title={v.isDefault ? "Default view" : undefined}
              >
                {v.isDefault && <span className="mr-1">★</span>}
                {v.name}
              </button>
              <ViewMenu
                view={v}
                onOverwrite={() => void overwrite(v)}
                onToggleDefault={() => void setDefault(v)}
                onDelete={() => void remove(v)}
              />
            </span>
          );
        })}
        {!showAdd ? (
          <button
            type="button"
            className="text-xs px-2.5 py-1 rounded-full border border-dashed border-black/15 text-[var(--color-saffron-dark)] hover:bg-[var(--color-cream)]/40"
            onClick={() => setShowAdd(true)}
          >
            + Save current filters
          </button>
        ) : (
          <span className="inline-flex items-center gap-2 bg-white border border-black/10 rounded-full pl-2">
            <input
              type="text"
              value={newName}
              autoFocus
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void save();
                if (e.key === "Escape") {
                  setShowAdd(false);
                  setNewName("");
                }
              }}
              placeholder="View name"
              className="text-xs px-1 py-1 outline-none bg-transparent"
            />
            <button
              type="button"
              onClick={() => void save()}
              disabled={!newName.trim()}
              className="text-xs px-2 py-1 rounded-r-full bg-[var(--color-saffron)] text-white disabled:opacity-50"
            >
              Save
            </button>
          </span>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function ViewMenu({
  view,
  onOverwrite,
  onToggleDefault,
  onDelete,
}: {
  view: SavedView;
  onOverwrite: () => void;
  onToggleDefault: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        className="px-1.5 py-1 rounded-r-full text-xs border border-black/10 border-l-0 hover:bg-[var(--color-cream)]/40 bg-white"
        aria-label={`Manage ${view.name}`}
      >
        ▾
      </button>
      {open && (
        <span className="absolute right-0 top-full mt-1 z-30 min-w-[160px] bg-white border border-black/10 rounded-lg shadow-lg text-xs overflow-hidden">
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onOverwrite();
              setOpen(false);
            }}
            className="block w-full text-left px-3 py-2 hover:bg-[var(--color-cream)]/40"
          >
            Update with current filters
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onToggleDefault();
              setOpen(false);
            }}
            className="block w-full text-left px-3 py-2 hover:bg-[var(--color-cream)]/40"
          >
            {view.isDefault ? "Remove as default" : "Make default"}
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onDelete();
              setOpen(false);
            }}
            className="block w-full text-left px-3 py-2 text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
        </span>
      )}
    </span>
  );
}
