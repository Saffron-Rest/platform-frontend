import { useEffect, useRef, useState } from "react";
import { listTags, type Tag } from "../../api/tags";
import { TagChip } from "./TagChip";

/** Multi-select tag filter for list pages. AND semantics — a record must
 *  carry ALL selected tags to pass the filter (mirrors backend). */
export function TagFilterDropdown({
  selectedTagIds,
  onChange,
  label = "Tags",
}: {
  selectedTagIds: string[];
  onChange: (next: string[]) => void;
  label?: string;
}) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    listTags()
      .then(setTags)
      .catch(() => setTags([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const selected = new Set(selectedTagIds);
  const visible = tags
    .filter((t) => t.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => (b.usageCount ?? 0) - (a.usageCount ?? 0));

  const toggle = (id: string) => {
    if (selected.has(id)) onChange(selectedTagIds.filter((x) => x !== id));
    else onChange([...selectedTagIds, id]);
  };

  const selectedTags = tags.filter((t) => selected.has(t.id));

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-black/10 bg-white text-sm hover:bg-[var(--color-cream)]/40 transition"
      >
        <span className="text-[var(--color-muted)] text-xs uppercase tracking-wide">
          {label}
        </span>
        {selectedTags.length === 0 ? (
          <span className="text-[var(--color-muted)]">All</span>
        ) : (
          <span className="flex items-center gap-1 flex-wrap">
            {selectedTags.slice(0, 3).map((t) => (
              <TagChip key={t.id} tag={t} size="sm" />
            ))}
            {selectedTags.length > 3 && (
              <span className="text-[10px] text-[var(--color-muted)]">
                +{selectedTags.length - 3}
              </span>
            )}
          </span>
        )}
        <span className="ml-auto text-[var(--color-muted)] text-xs">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 w-72 rounded-xl border border-black/10 bg-white shadow-lg overflow-hidden">
          <div className="p-2 border-b border-black/5 flex items-center gap-2">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a tag…"
              className="flex-1 text-sm px-2 py-1.5 rounded-md border border-black/10 focus:outline-none focus:ring-2 focus:ring-[var(--color-saffron)]/40"
            />
            {selectedTags.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs text-[var(--color-muted)] hover:text-red-600 px-1"
              >
                Clear
              </button>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {loading && (
              <p className="text-xs text-[var(--color-muted)] px-3 py-2">Loading…</p>
            )}
            {!loading && visible.length === 0 && (
              <p className="text-xs text-[var(--color-muted)] px-3 py-2">
                No tags match.
              </p>
            )}
            {visible.map((t) => {
              const isSelected = selected.has(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggle(t.id)}
                  className={`w-full text-left px-3 py-1.5 flex items-center gap-2 text-sm hover:bg-[var(--color-cream)]/60 ${
                    isSelected ? "font-medium" : ""
                  }`}
                >
                  <span
                    className="w-3.5 h-3.5 rounded border flex items-center justify-center text-[10px] leading-none"
                    style={{
                      borderColor: "#0003",
                      background: isSelected ? "var(--color-saffron)" : "white",
                      color: "white",
                    }}
                  >
                    {isSelected ? "✓" : ""}
                  </span>
                  <TagChip tag={t} size="sm" />
                  <span className="ml-auto text-[10px] text-[var(--color-muted)] tabular-nums">
                    {t.usageCount ?? 0}
                  </span>
                </button>
              );
            })}
          </div>
          {selectedTags.length > 1 && (
            <p className="px-3 py-1.5 text-[10px] text-[var(--color-muted)] border-t border-black/5">
              Records must carry all {selectedTags.length} selected tags.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
