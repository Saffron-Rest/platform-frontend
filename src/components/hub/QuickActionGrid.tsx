import { Link } from "react-router-dom";
import type { NavLinkItem } from "../../lib/navigation";

type Props = {
  items: NavLinkItem[];
  /** First item rendered as accent tile */
  accentFirst?: boolean;
};

export function QuickActionGrid({ items, accentFirst = true }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((item, index) => {
        const Icon = item.icon;
        const accent = accentFirst && index === 0;
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`hub-tile ${accent ? "hub-tile-accent col-span-2 sm:col-span-1" : ""}`}
          >
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                accent ? "bg-white/20" : "bg-[var(--color-saffron-light)] text-[var(--color-saffron)]"
              }`}
            >
              <Icon className="w-5 h-5" />
            </span>
            <span>
              <span className={`block font-bold text-sm ${accent ? "text-white" : ""}`}>{item.label}</span>
              {item.description && (
                <span
                  className={`block text-xs mt-0.5 ${accent ? "text-white/80" : "text-[var(--color-muted)]"}`}
                >
                  {item.description}
                </span>
              )}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
