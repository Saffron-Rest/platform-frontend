import type { Tag } from "../../api/tags";

/** Pick a readable text colour given a background. Returns either a
 *  near-black or near-white string. */
function pickContrast(bg: string): string {
  const hex = bg.replace("#", "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#1a1a1a" : "#ffffff";
}

/** Deterministic colour for tags that didn't get one assigned. Picks
 *  from a small saffron-tuned palette by hashing the tag id/name. */
function fallbackColor(seed: string): string {
  const palette = [
    "#E07A5F", "#3D5A80", "#81B29A", "#F2CC8F",
    "#A37774", "#6D597A", "#B56576", "#355070",
  ];
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}

export function TagChip({
  tag,
  size = "md",
  onRemove,
  className = "",
}: {
  tag: Pick<Tag, "id" | "name" | "color">;
  size?: "sm" | "md";
  /** If provided, renders an ✕ that calls this callback. */
  onRemove?: () => void;
  className?: string;
}) {
  const bg = tag.color || fallbackColor(tag.id || tag.name);
  const fg = pickContrast(bg);
  const pad = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${pad} ${className}`}
      style={{ backgroundColor: bg, color: fg }}
      title={tag.name}
    >
      <span className="max-w-[10rem] truncate">{tag.name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          className="-mr-0.5 leading-none opacity-70 hover:opacity-100"
          aria-label={`Remove tag ${tag.name}`}
        >
          ×
        </button>
      )}
    </span>
  );
}
