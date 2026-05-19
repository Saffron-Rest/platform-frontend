import { Link } from "react-router-dom";
import type { NavGroup, NavLinkItem } from "../../lib/navigation";
import { isNavActive } from "../../lib/navigation";

type Props = {
  open: boolean;
  onClose: () => void;
  groups: NavGroup[];
  pathname: string;
  primaryPaths: Set<string>;
};

export function MoreMenu({ open, onClose, groups, pathname, primaryPaths }: Props) {
  if (!open) return null;

  const secondaryGroups = groups
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => !primaryPaths.has(i.to)),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px] md:hidden"
        aria-label="Close menu"
        onClick={onClose}
      />
      <div
        className="fixed inset-x-0 bottom-0 z-[70] md:hidden rounded-t-3xl bg-white border-t border-black/10 max-h-[min(85vh,32rem)] overflow-y-auto"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        role="dialog"
        aria-modal="true"
        aria-label="More navigation"
      >
        <div className="w-10 h-1 rounded-full bg-black/15 mx-auto mt-3 mb-2" />
        <div className="px-5 pb-6 pt-2 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">More</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-semibold text-[var(--color-saffron)] px-3 py-1.5"
            >
              Done
            </button>
          </div>
          {secondaryGroups.map((group) => (
            <div key={group.id}>
              <p className="section-title mb-2">{group.label}</p>
              <ul className="space-y-1">
                {group.items.map((item) => (
                  <MoreRow key={item.to} item={item} active={isNavActive(pathname, item.to)} onClose={onClose} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function MoreRow({
  item,
  active,
  onClose,
}: {
  item: NavLinkItem;
  active: boolean;
  onClose: () => void;
}) {
  const Icon = item.icon;
  return (
    <li>
      <Link
        to={item.to}
        onClick={onClose}
        className={`flex items-center gap-3 p-3 rounded-xl transition ${
          active ? "bg-[var(--color-saffron-light)] text-[var(--color-saffron-dark)]" : "hover:bg-black/[0.03]"
        }`}
      >
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ${
            active ? "bg-[var(--color-saffron)] text-white" : "bg-stone-100 text-[var(--color-muted)]"
          }`}
        >
          <Icon className="w-5 h-5" />
        </span>
        <span className="min-w-0">
          <span className="block font-semibold text-sm">{item.label}</span>
          {item.description && (
            <span className="block text-xs text-[var(--color-muted)] truncate">{item.description}</span>
          )}
        </span>
      </Link>
    </li>
  );
}
