import { navGroupsForRole, primaryNavLinks } from "./navigation";
import type { Role } from "../types";

/** Inverse of `tourTargetFromPath` for `nav-*` targets. */
export function routeFromNavTarget(target: string): string | null {
  if (target === "nav-home") return "/";
  if (!target.startsWith("nav-")) return null;
  return `/${target.slice(4)}`;
}

export function isNavTargetInMoreMenu(
  role: Role | string | undefined,
  target: string,
  isMobile: boolean
): boolean {
  if (!isMobile || !target.startsWith("nav-")) return false;
  const route = routeFromNavTarget(target);
  if (!route) return false;
  const primaryPaths = new Set(primaryNavLinks(navGroupsForRole(role)).map((p) => p.to));
  return !primaryPaths.has(route);
}

export function routeMatchesPath(stepRoute: string | undefined, pathname: string): boolean {
  if (!stepRoute) return true;
  const want = stepRoute.split("?")[0];
  if (pathname === want) return true;
  if (want !== "/" && pathname.startsWith(`${want}/`)) return true;
  if (want === "/admin" && pathname.startsWith("/admin/")) return true;
  return false;
}
