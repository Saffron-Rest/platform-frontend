/** Maps a route path to a stable `data-tour` id used in nav and tours. */
export function tourTargetFromPath(to: string): string {
  if (to === "/") return "nav-home";
  const slug = to.replace(/^\//, "").replace(/\//g, "-");
  return `nav-${slug}`;
}

export const TOUR_CENTER = "__center__";
