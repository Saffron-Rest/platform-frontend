import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { Role } from "../../types";
import {
  dismissQuickGuide,
  tourStepsForRole,
  type TourStep,
} from "../../lib/onboarding";
import { TOUR_CENTER } from "../../lib/tourTargets";
import { roleLabel } from "../../lib/roles";
import { Button } from "../ui/Button";

type Props = {
  role: Role | string;
  userId: string;
  onClose: () => void;
};

type Rect = { top: number; left: number; width: number; height: number };

const PAD = 12;
const GAP = 20;
const MAX_WAIT_MS = 6000;
const TOOLTIP_MAX_W = 420;
const TOOLTIP_MIN_H = 180;
const STEP_LEAVE_MS = 220;
const NAV_SETTLE_MS = 380;

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

function useIsMobile() {
  const [mobile, setMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 640
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const fn = () => setMobile(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return mobile;
}

export function OnboardingTour({ role, userId, onClose }: Props) {
  const steps = tourStepsForRole(role);
  const navigate = useNavigate();
  const location = useLocation();
  const tooltipRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const [stepIndex, setStepIndex] = useState(0);
  const [remember, setRemember] = useState(false);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [holeRect, setHoleRect] = useState<Rect | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [navPending, setNavPending] = useState(false);
  const [tooltipHeight, setTooltipHeight] = useState(TOOLTIP_MIN_H);
  const [mounted, setMounted] = useState(false);
  const [contentVisible, setContentVisible] = useState(true);
  const [busy, setBusy] = useState(false);

  const step: TourStep = steps[stepIndex];
  const isCenter = step.target === TOUR_CENTER;
  const isLast = stepIndex === steps.length - 1;
  const isIntro = stepIndex === 0 && isCenter;
  const progressPct = ((stepIndex + 1) / steps.length) * 100;

  const finish = useCallback(() => {
    dismissQuickGuide(role, userId, remember);
    onClose();
  }, [role, userId, remember, onClose]);

  const applyHole = useCallback((rect: Rect | null) => {
    setTargetRect(rect);
    setHoleRect(rect ? holeFromRect(rect) : null);
  }, []);

  const goToStep = useCallback(
    (next: number) => {
      if (busy || next < 0 || next >= steps.length || next === stepIndex) return;
      setBusy(true);
      setContentVisible(false);

      window.setTimeout(() => {
        setStepIndex(next);
        applyHole(null);
        setWaiting(!steps[next] || steps[next].target === TOUR_CENTER ? false : true);
        setContentVisible(true);
        setBusy(false);
      }, STEP_LEAVE_MS);
    },
    [busy, stepIndex, steps, applyHole]
  );

  useEffect(() => {
    document.body.classList.add("tour-active");
    requestAnimationFrame(() => setMounted(true));
    return () => document.body.classList.remove("tour-active");
  }, []);

  useEffect(() => {
    if (!step.route) {
      setNavPending(false);
      return;
    }
    const want = step.route.split("?")[0];
    const have = location.pathname;
    if (have === want || have.startsWith(want + "/")) {
      setNavPending(false);
      return;
    }
    setNavPending(true);
    navigate(step.route);
  }, [step.route, stepIndex, location.pathname, navigate]);

  useLayoutEffect(() => {
    if (navPending) return;

    const signal = { cancelled: false };

    if (isCenter) {
      applyHole(null);
      setWaiting(false);
      return () => {
        signal.cancelled = true;
      };
    }

    setWaiting(true);
    waitForTarget(step.target, (rect) => {
      if (signal.cancelled) return;
      if (rect) {
        const el = findTarget(step.target);
        el?.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
        window.setTimeout(() => {
          if (signal.cancelled) return;
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
  }, [step.target, stepIndex, navPending, isCenter, applyHole]);

  useLayoutEffect(() => {
    const el = tooltipRef.current;
    if (!el) return;
    setTooltipHeight(el.offsetHeight || TOOLTIP_MIN_H);
  }, [stepIndex, waiting, step.title, step.body, step.tips?.length, contentVisible]);

  useLayoutEffect(() => {
    if (isCenter || waiting) return;
    const el = findTarget(step.target);
    if (!el) return;
    el.classList.add("tour-target-focus");
    return () => el.classList.remove("tour-target-focus");
  }, [step.target, stepIndex, isCenter, waiting, holeRect]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (busy || navPending) return;
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight" && !isLast) goToStep(stepIndex + 1);
      if (e.key === "ArrowLeft" && stepIndex > 0) goToStep(stepIndex - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish, goToStep, isLast, navPending, stepIndex, busy]);

  const tooltipStyle = computeTooltipStyle(
    holeRect,
    step.placement ?? "auto",
    tooltipHeight,
    isCenter,
    isMobile
  );

  const canAdvance = !busy && !navPending && (!waiting || isCenter);

  return (
    <div
      className={`fixed inset-0 z-[200] tour-root ${mounted ? "tour-root-visible" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
    >
      {isCenter || !holeRect ? (
        <div className="tour-shade tour-shade-full" aria-hidden />
      ) : (
        <TourShadePanels hole={holeRect} />
      )}

      {holeRect && !waiting && !isCenter && (
        <span
          className="tour-spotlight-label"
          style={{
            top: Math.max(12, holeRect.top - 36),
            left: holeRect.left + holeRect.width / 2,
            transform: "translateX(-50%)",
          }}
        >
          ↑ Look here
        </span>
      )}

      {(waiting || navPending) && !isCenter && (
        <div className="tour-status-banner" role="status">
          <span className="tour-status-spinner" aria-hidden />
          {navPending ? "Going to the next screen…" : "Finding this section…"}
        </div>
      )}

      <div
        ref={tooltipRef}
        className={[
          "tour-card",
          isCenter ? "tour-card-center" : isMobile ? "tour-card-sheet" : "tour-card-floating",
          mounted && contentVisible ? "tour-card-visible" : "tour-card-hidden",
        ].join(" ")}
        style={tooltipStyle}
      >
        <header className="tour-card-header">
          <div className="tour-card-header-top">
            <div className="min-w-0">
              {step.category && <p className="tour-category">{step.category}</p>}
              <p className="tour-meta">
                {stepIndex + 1} / {steps.length} · {roleLabel(role)}
              </p>
            </div>
            <button type="button" onClick={finish} className="tour-close" aria-label="Close tour">
              ×
            </button>
          </div>
          <div className="tour-progress-track" aria-hidden>
            <div className="tour-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          {!isMobile && (
            <div className="tour-dots" aria-label={`Step ${stepIndex + 1} of ${steps.length}`}>
              {steps.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={busy}
                  className={[
                    "tour-dot",
                    i === stepIndex ? "tour-dot-active" : i < stepIndex ? "tour-dot-done" : "",
                  ].join(" ")}
                  aria-label={`Step ${i + 1}`}
                  aria-current={i === stepIndex ? "step" : undefined}
                  onClick={() => goToStep(i)}
                />
              ))}
            </div>
          )}
        </header>

        <div className="tour-card-body" key={stepIndex}>
          {isIntro && (
            <div className="tour-welcome-badge" aria-hidden>
              <span className="text-2xl">✦</span>
            </div>
          )}
          <h2 id="tour-title" className="tour-title">
            {step.title}
          </h2>
          <p className="tour-body">{step.body}</p>

          {step.tips && step.tips.length > 0 && (
            <ul className="tour-tips">
              {step.tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          )}

          {!waiting && !isCenter && !targetRect && (
            <div className="tour-miss-hint">
              <strong>Highlight not visible?</strong>
              <span>Try opening More (mobile) or the left menu, then tap Continue again.</span>
            </div>
          )}
        </div>

        <footer className="tour-card-footer">
          <label className="tour-checkbox">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <span>Don&apos;t show on login</span>
          </label>
          <div className="tour-actions">
            <Button
              variant="ghost"
              className="!py-2.5 !px-4"
              onClick={() => (stepIndex === 0 ? finish() : goToStep(stepIndex - 1))}
              disabled={!canAdvance && stepIndex > 0}
            >
              {stepIndex === 0 ? "Skip" : "Back"}
            </Button>
            {!isLast ? (
              <Button
                className="flex-1 !py-2.5 tour-btn-next"
                onClick={() => goToStep(stepIndex + 1)}
                disabled={!canAdvance}
              >
                {waiting || navPending ? "Please wait…" : "Continue"}
              </Button>
            ) : (
              <Button className="flex-1 !py-2.5 tour-btn-next" onClick={finish} disabled={!canAdvance}>
                Done
              </Button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

function computeTooltipStyle(
  hole: Rect | null,
  placement: TourStep["placement"],
  tooltipHeight: number,
  isCenter: boolean,
  isMobile: boolean
): CSSProperties {
  if (isMobile) {
    return {
      left: 0,
      right: 0,
      bottom: 0,
      width: "100%",
      maxHeight: "min(72vh, 520px)",
      transform: "none",
    };
  }

  if (isCenter || !hole) {
    return {
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
      width: `min(calc(100vw - 2rem), ${TOOLTIP_MAX_W}px)`,
    };
  }

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const tw = Math.min(vw - 32, TOOLTIP_MAX_W);
  const th = Math.min(tooltipHeight, vh - 40);
  const prefer = placement === "auto" ? guessPlacement(hole, th) : placement;

  let top = hole.top + hole.height + GAP;
  let left = hole.left + hole.width / 2 - tw / 2;

  if (prefer === "top") top = hole.top - GAP - th;
  else if (prefer === "left") {
    left = hole.left - GAP - tw;
    top = hole.top + hole.height / 2 - th / 2;
  } else if (prefer === "right") {
    left = hole.left + hole.width + GAP;
    top = hole.top + hole.height / 2 - th / 2;
  }

  left = Math.max(16, Math.min(left, vw - tw - 16));
  top = Math.max(16, Math.min(top, vh - th - 16));

  return { top, left, width: tw, transform: "none" };
}

function guessPlacement(hole: Rect, tooltipHeight: number): "top" | "bottom" {
  const spaceBelow = window.innerHeight - (hole.top + hole.height);
  const spaceAbove = hole.top;
  if (spaceBelow >= tooltipHeight + GAP) return "bottom";
  if (spaceAbove >= tooltipHeight + GAP) return "top";
  return hole.top > window.innerHeight * 0.42 ? "top" : "bottom";
}

function TourShadePanels({ hole }: { hole: Rect }) {
  const vw = window.innerWidth;
  const t = hole.top;
  const l = hole.left;
  const r = hole.left + hole.width;
  const b = hole.top + hole.height;

  const panelStyle: CSSProperties = { transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)" };

  return (
    <div className="absolute inset-0 z-[200]" aria-hidden>
      <div className="tour-shade" style={{ ...panelStyle, top: 0, left: 0, right: 0, height: Math.max(0, t) }} />
      <div
        className="tour-shade"
        style={{ ...panelStyle, top: t, left: 0, width: Math.max(0, l), height: hole.height }}
      />
      <div
        className="tour-shade"
        style={{ ...panelStyle, top: t, left: r, width: Math.max(0, vw - r), height: hole.height }}
      />
      <div className="tour-shade" style={{ ...panelStyle, top: b, left: 0, right: 0, bottom: 0 }} />
    </div>
  );
}

