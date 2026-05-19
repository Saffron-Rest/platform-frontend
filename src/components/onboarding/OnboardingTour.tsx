import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import type { Role } from "../../types";
import {
  dismissQuickGuide,
  tourStepsForRole,
} from "../../lib/onboarding";
import { isNavTargetInMoreMenu, routeMatchesPath } from "../../lib/tourNav";
import { tourDockReservePx, TOUR_SCROLL_TOP_MARGIN } from "../../lib/tourLayout";
import { TOUR_CENTER } from "../../lib/tourTargets";
import { roleLabel } from "../../lib/roles";
import { Button } from "../ui/Button";

type Props = {
  role: Role | string;
  userId: string;
  onClose: () => void;
  onOpenMoreMenu?: () => void;
};

type Rect = { top: number; left: number; width: number; height: number };

const PAD = 10;
const MAX_WAIT_MS = 5000;
const STEP_LEAVE_MS = 180;
const NAV_SETTLE_MS = 400;

function findTarget(selector: string): HTMLElement | null {
  const el = document.querySelector(`[data-tour="${selector}"]`) as HTMLElement | null;
  if (el && isVisible(el)) return el;
  return null;
}

function isVisible(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  if (r.width < 2 && r.height < 2) return false;
  const style = window.getComputedStyle(el);
  return style.visibility !== "hidden" && style.display !== "none" && style.opacity !== "0";
}

function measure(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function holeFromRect(rect: Rect): Rect {
  return {
    top: rect.top - PAD,
    left: rect.left - PAD,
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
  };
}

function waitForTarget(
  selector: string,
  onFound: (rect: Rect | null) => void,
  signal: { cancelled: boolean }
) {
  const start = Date.now();
  const tick = () => {
    if (signal.cancelled) return;
    const el = selector === TOUR_CENTER ? null : findTarget(selector);
    if (selector === TOUR_CENTER || el) {
      onFound(el ? measure(el) : null);
      return;
    }
    if (Date.now() - start > MAX_WAIT_MS) {
      onFound(null);
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function scrollTargetIntoView(el: HTMLElement, isMobile: boolean) {
  const reserve = tourDockReservePx(isMobile);
  const prevBottom = el.style.scrollMarginBottom;
  const prevTop = el.style.scrollMarginTop;
  el.style.scrollMarginBottom = `${reserve}px`;
  el.style.scrollMarginTop = `${TOUR_SCROLL_TOP_MARGIN}px`;
  el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
  return () => {
    el.style.scrollMarginBottom = prevBottom;
    el.style.scrollMarginTop = prevTop;
  };
}

function useIsMobile() {
  const [mobile, setMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 768
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const fn = () => setMobile(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return mobile;
}

export function OnboardingTour({ role, userId, onClose, onOpenMoreMenu }: Props) {
  const steps = useMemo(() => tourStepsForRole(role), [role]);
  const navigate = useNavigate();
  const location = useLocation();
  const cardRef = useRef<HTMLDivElement>(null);
  const focusedRef = useRef<HTMLElement | null>(null);
  const scrollCleanupRef = useRef<(() => void) | null>(null);
  const aliveRef = useRef(true);
  const settleTimerRef = useRef<number | null>(null);
  const isMobile = useIsMobile();

  const [stepIndex, setStepIndex] = useState(0);
  const [remember, setRemember] = useState(false);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [holeRect, setHoleRect] = useState<Rect | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [navPending, setNavPending] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [contentVisible, setContentVisible] = useState(true);
  const [busy, setBusy] = useState(false);

  const step = steps[stepIndex];
  const isCenter = step?.target === TOUR_CENTER;
  const isDocked = !isCenter;
  const isLast = steps.length > 0 && stepIndex === steps.length - 1;
  const isIntro = stepIndex === 0 && isCenter;
  const progressPct = steps.length ? ((stepIndex + 1) / steps.length) * 100 : 0;

  const finish = useCallback(() => {
    dismissQuickGuide(role, userId, remember);
    onClose();
  }, [role, userId, remember, onClose]);

  const applyHole = useCallback((rect: Rect | null) => {
    if (!aliveRef.current) return;
    setTargetRect(rect);
    setHoleRect(rect ? holeFromRect(rect) : null);
  }, []);

  const clearFocusRing = useCallback(() => {
    scrollCleanupRef.current?.();
    scrollCleanupRef.current = null;
    const el = focusedRef.current;
    if (el?.isConnected) {
      el.classList.remove("tour-target-focus");
    }
    focusedRef.current = null;
  }, []);

  const goToStep = useCallback(
    (next: number) => {
      if (busy || next < 0 || next >= steps.length || next === stepIndex) return;
      setBusy(true);
      setContentVisible(false);
      clearFocusRing();

      window.setTimeout(() => {
        if (!aliveRef.current) return;
        const nextStep = steps[next];
        setStepIndex(next);
        applyHole(null);
        setWaiting(Boolean(nextStep && nextStep.target !== TOUR_CENTER));
        setContentVisible(true);
        setBusy(false);
      }, STEP_LEAVE_MS);
    },
    [busy, stepIndex, steps, applyHole, clearFocusRing]
  );

  useEffect(() => {
    aliveRef.current = true;
    document.body.classList.add("tour-active");
    requestAnimationFrame(() => {
      if (aliveRef.current) setMounted(true);
    });
    return () => {
      aliveRef.current = false;
      document.body.classList.remove("tour-active");
      clearFocusRing();
      if (settleTimerRef.current != null) {
        window.clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }
    };
  }, [clearFocusRing]);

  useEffect(() => {
    if (!step?.route) {
      setNavPending(false);
      return;
    }
    if (routeMatchesPath(step.route, location.pathname)) {
      setNavPending(false);
      return;
    }
    setNavPending(true);
    navigate(step.route);
    const t = window.setTimeout(() => setNavPending(false), 8000);
    return () => window.clearTimeout(t);
  }, [step?.route, stepIndex, location.pathname, navigate]);

  useLayoutEffect(() => {
    if (!step || navPending) return;

    const signal = { cancelled: false };

    if (isNavTargetInMoreMenu(role, step.target, isMobile)) {
      onOpenMoreMenu?.();
    }

    if (isCenter) {
      applyHole(null);
      setWaiting(false);
      return () => {
        signal.cancelled = true;
      };
    }

    setWaiting(true);
    waitForTarget(step.target, (rect) => {
      if (signal.cancelled || !aliveRef.current) return;
      if (rect) {
        const el = findTarget(step.target);
        if (el) {
          scrollCleanupRef.current?.();
          scrollCleanupRef.current = scrollTargetIntoView(el, isMobile);
        }
        if (settleTimerRef.current != null) {
          window.clearTimeout(settleTimerRef.current);
        }
        settleTimerRef.current = window.setTimeout(() => {
          settleTimerRef.current = null;
          if (signal.cancelled || !aliveRef.current) return;
          const again = findTarget(step.target);
          applyHole(again ? measure(again) : rect);
          setWaiting(false);
        }, NAV_SETTLE_MS);
      } else {
        applyHole(null);
        setWaiting(false);
      }
    }, signal);

    const sync = () => {
      if (!aliveRef.current) return;
      const el = findTarget(step.target);
      if (el) applyHole(measure(el));
    };
    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, true);

    return () => {
      signal.cancelled = true;
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync, true);
    };
  }, [step, stepIndex, navPending, isCenter, applyHole, role, isMobile, onOpenMoreMenu]);

  useLayoutEffect(() => {
    clearFocusRing();
    if (!step || isCenter || waiting) return;
    const el = findTarget(step.target);
    if (!el) return;
    el.classList.add("tour-target-focus");
    focusedRef.current = el;
    return () => clearFocusRing();
  }, [step, stepIndex, isCenter, waiting, holeRect, clearFocusRing]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (busy || navPending || !step) return;
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight" && !isLast) goToStep(stepIndex + 1);
      if (e.key === "ArrowLeft" && stepIndex > 0) goToStep(stepIndex - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish, goToStep, isLast, navPending, stepIndex, busy, step]);

  if (!steps.length || !step) {
    return null;
  }

  const canAdvance = !busy && !navPending;

  const cardClass = [
    "tour-card",
    isCenter ? "tour-card--center" : "tour-card--dock",
    mounted && contentVisible ? "tour-card--visible" : "tour-card--hidden",
  ].join(" ");

  const ui = (
    <div className={`tour-root ${mounted ? "tour-root--visible" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
    >
      {isCenter || !holeRect ? (
        <div className="tour-shade tour-shade--full" aria-hidden />
      ) : (
        <TourShadePanels hole={holeRect} docked={isDocked} isMobile={isMobile} />
      )}

      {holeRect && !waiting && isDocked && (
        <div
          className="tour-spotlight-ring"
          style={{
            top: holeRect.top,
            left: holeRect.left,
            width: holeRect.width,
            height: holeRect.height,
          }}
          aria-hidden
        />
      )}

      {(waiting || navPending) && isDocked && (
        <div className="tour-status" role="status">
          <span className="tour-status__spinner" aria-hidden />
          {navPending ? "Opening screen…" : "Locating section…"}
        </div>
      )}

      <div
        ref={cardRef}
        className={cardClass}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="tour-card__handle" aria-hidden />

        <header className="tour-card__header">
          <div className="tour-card__header-row">
            <div className="min-w-0 flex-1">
              {step.category && <p className="tour-card__category">{step.category}</p>}
              <p className="tour-card__meta">
                Step {stepIndex + 1} of {steps.length} · {roleLabel(role)}
              </p>
            </div>
            <button type="button" onClick={finish} className="tour-card__close" aria-label="Close tour">
              ×
            </button>
          </div>
          <div className="tour-card__progress" aria-hidden>
            <div className="tour-card__progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
        </header>

        <div className="tour-card__body" key={stepIndex}>
          {isIntro && (
            <div className="tour-card__badge" aria-hidden>
              <span className="text-2xl">✦</span>
            </div>
          )}
          <h2 id="tour-title" className="tour-card__title">
            {step.title}
          </h2>
          <p className="tour-card__text">{step.body}</p>

          {step.tips && step.tips.length > 0 && (
            <ul className="tour-card__tips">
              {step.tips.map((tip, i) => (
                <li key={`${stepIndex}-${i}`}>{tip}</li>
              ))}
            </ul>
          )}

          {isDocked && !waiting && !targetRect && (
            <p className="tour-card__hint">
              {isMobile
                ? "Tip: open More in the bottom bar if this menu item is hidden there."
                : "Tip: check the left sidebar — the highlighted area may be in the menu."}
            </p>
          )}
        </div>

        <footer className="tour-card__footer">
          <label className="tour-card__remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <span>Don&apos;t show on login</span>
          </label>
          <div className="tour-card__actions">
            <Button
              variant="ghost"
              className="!py-2.5 !px-4 shrink-0"
              onClick={() => (stepIndex === 0 ? finish() : goToStep(stepIndex - 1))}
              disabled={busy && stepIndex > 0}
            >
              {stepIndex === 0 ? "Skip" : "Back"}
            </Button>
            {!isLast ? (
              <Button
                className="flex-1 !py-2.5 min-w-0"
                onClick={() => goToStep(stepIndex + 1)}
                disabled={!canAdvance}
              >
                Continue
              </Button>
            ) : (
              <Button className="flex-1 !py-2.5 min-w-0" onClick={finish} disabled={!canAdvance}>
                Done
              </Button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(ui, document.body);
}

function TourShadePanels({
  hole,
  docked,
  isMobile,
}: {
  hole: Rect;
  docked: boolean;
  isMobile: boolean;
}) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const t = hole.top;
  const l = hole.left;
  const r = hole.left + hole.width;
  const b = hole.top + hole.height;

  const dockClearance = docked ? tourDockReservePx(isMobile) : 0;
  const bottomShadeTop = Math.min(b, vh - dockClearance);

  const panelStyle = { transition: "top 0.35s ease, left 0.35s ease, width 0.35s ease, height 0.35s ease" };

  return (
    <div className="tour-shade-panels" aria-hidden>
      <div className="tour-shade" style={{ ...panelStyle, top: 0, left: 0, right: 0, height: Math.max(0, t) }} />
      <div
        className="tour-shade"
        style={{ ...panelStyle, top: t, left: 0, width: Math.max(0, l), height: hole.height }}
      />
      <div
        className="tour-shade"
        style={{ ...panelStyle, top: t, left: r, width: Math.max(0, vw - r), height: hole.height }}
      />
      <div
        className="tour-shade"
        style={{ ...panelStyle, top: bottomShadeTop, left: 0, right: 0, bottom: 0 }}
      />
    </div>
  );
}
