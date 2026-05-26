import { Link } from "react-router-dom";
import type { NavGroup } from "../../lib/navigation";
import { isNavActive } from "../../lib/navigation";
import { tourTargetFromPath } from "../../lib/tourTargets";

type Props = {
  groups: NavGroup[];
  pathname: string;
};

export function SidebarNav({ groups, pathname }: Props) {
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-5" aria-label="Main">
      {groups.map((group) => (
        <div key={group.id}>
          <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
            {group.label}
          </p>
          <ul className="space-y-px">
            {group.items.map((item) => {
              const active = isNavActive(pathname, item.to);
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    data-tour={tourTargetFromPath(item.to)}
                    className={`nav-item ${active ? "nav-item-active" : "nav-item-idle"}`}
                  >
                    <Icon className="w-[18px] h-[18px] shrink-0" />
                    <span className="min-w-0 truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
