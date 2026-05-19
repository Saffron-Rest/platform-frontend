/** Space reserved at bottom so highlighted UI stays above the tour dock. */
export const TOUR_DOCK_RESERVE_MOBILE = 360;
export const TOUR_DOCK_RESERVE_DESKTOP = 320;
export const TOUR_SCROLL_TOP_MARGIN = 72;

export function tourDockReservePx(isMobile: boolean) {
  return isMobile ? TOUR_DOCK_RESERVE_MOBILE : TOUR_DOCK_RESERVE_DESKTOP;
}
