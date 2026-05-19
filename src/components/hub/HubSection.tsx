import type { ReactNode } from "react";

type Props = {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  tourId?: string;
};

export function HubSection({ title, action, children, className = "", tourId }: Props) {
  return (
    <section className={`space-y-3 ${className}`} data-tour={tourId}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="section-title">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
