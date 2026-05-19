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
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6" aria-label="Main">
      {groups.map((group) => (
        <div key={group.id}>
          <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
            {group.label}
          </p>
          <ul className="space-y-0.5">
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
                    <Icon className="w-5 h-5 shrink-0 opacity-90" />
                    <span className="min-w-0">
                      <span className="block truncate">{item.label}</span>
                    </span>
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
