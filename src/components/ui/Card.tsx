import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  padding?: "sm" | "md" | "lg";
};

const pad = { sm: "p-3", md: "p-4", lg: "p-5" };

export function Card({ children, className = "", padding = "md" }: Props) {
  return (
    <div className={`bg-white rounded-2xl border border-black/[0.06] shadow-sm ${pad[padding]} ${className}`}>
      {children}
    </div>
  );
}
