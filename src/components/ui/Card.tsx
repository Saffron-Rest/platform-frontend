import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  /** Internal padding scale. {@code none} is for cards whose children
   *  carry their own padding (list rows, full-bleed tables). */
  padding?: "none" | "sm" | "md" | "lg";
};

const pad = { none: "", sm: "p-3", md: "p-4", lg: "p-5" };

export function Card({ children, className = "", padding = "md" }: Props) {
  return <div className={`surface-card ${pad[padding]} ${className}`}>{children}</div>;
}
