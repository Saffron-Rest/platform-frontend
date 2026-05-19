import { Link } from "react-router-dom";
import type { NavLinkItem } from "../../lib/navigation";
import { isNavActive } from "../../lib/navigation";

function IconMore({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}

type Props = {
  primary: NavLinkItem[];
  pathname: string;
  onMore?: () => void;
  moreActive?: boolean;
  showMore?: boolean;
};

export function BottomNav({ primary, pathname, onMore, moreActive, showMore = true }: Props) {
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white/95 backdrop-blur-lg border-t border-black/[0.08]"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="Main"
    >
      <div className="flex max-w-lg mx-auto">
        {primary.map((item) => {
          const active = isNavActive(pathname, item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2.5 min-h-[var(--nav-height)] transition ${
                active ? "text-[var(--color-saffron)]" : "text-[var(--color-muted)]"
              }`}
            >
              <Icon className={active ? "w-6 h-6" : "w-5 h-5"} />
              <span className="text-[10px] font-bold tracking-wide">{item.label}</span>
            </Link>
          );
        })}
        {showMore && onMore && (
          <button
            type="button"
            onClick={onMore}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2.5 min-h-[var(--nav-height)] transition ${
              moreActive ? "text-[var(--color-saffron)]" : "text-[var(--color-muted)]"
            }`}
            aria-expanded={moreActive}
            aria-label="More menu"
          >
            <IconMore className={moreActive ? "w-6 h-6" : "w-5 h-5"} />
            <span className="text-[10px] font-bold tracking-wide">More</span>
          </button>
        )}
      </div>
    </nav>
  );
}
