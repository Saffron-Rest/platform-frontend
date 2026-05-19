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

const PAD = 10;
const GAP = 16;
const MAX_WAIT_MS = 5000;
const TOOLTIP_MAX_W = 400;
const TOOLTIP_MIN_H = 200;

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

export function OnboardingTour({ role, userId, onClose }: Props) {
  const steps = tourStepsForRole(role);
  const navigate = useNavigate();
  const location = useLocation();
  const tooltipRef = useRef<HTMLDivElement>(null);

  const [stepIndex, setStepIndex] = useState(0);
  const [remember, setRemember] = useState(false);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [waiting, setWaiting] = useState(true);
  const [navPending, setNavPending] = useState(false);
  const [tooltipHeight, setTooltipHeight] = useState(TOOLTIP_MIN_H);
  const [entered, setEntered] = useState(false);

  const step: TourStep = steps[stepIndex];
  const isCenter = step.target === TOUR_CENTER;
  const isLast = stepIndex === steps.length - 1;
  const isIntro = stepIndex === 0 && isCenter;

  const finish = useCallback(() => {
    dismissQuickGuide(role, userId, remember);
    onClose();
  }, [role, userId, remember, onClose]);

  const goToStep = useCallback(
    (next: number) => {
      if (next < 0 || next >= steps.length) return;
      setEntered(false);
      setStepIndex(next);
      setTargetRect(null);
      setWaiting(true);
    },
    [steps.length]
  );

  useEffect(() => {
    document.body.classList.add("tour-active");
    const t = requestAnimationFrame(() => setEntered(true));
    return () => {
      document.body.classList.remove("tour-active");
      cancelAnimationFrame(t);
    };
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => setEntered(true));
  }, [stepIndex]);

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
      setTargetRect(null);
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
          setTargetRect(again ? measure(again) : rect);
          setWaiting(false);
        }, 320);
      } else {
        setTargetRect(null);
        setWaiting(false);
      }
    }, signal);

    const sync = () => {
      const el = findTarget(step.target);
      if (el) setTargetRect(measure(el));
    };
    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, true);

    return () => {
      signal.cancelled = true;
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync, true);
    };
  }, [step.target, stepIndex, navPending, isCenter]);

  useLayoutEffect(() => {
    const el = tooltipRef.current;
    if (!el) return;
    setTooltipHeight(el.offsetHeight || TOOLTIP_MIN_H);
  }, [stepIndex, waiting, step.title, step.body, step.tips?.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight" && !isLast && !navPending) goToStep(stepIndex + 1);
      if (e.key === "ArrowLeft" && stepIndex > 0 && !navPending) goToStep(stepIndex - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish, goToStep, isLast, navPending, stepIndex]);

  const spotlight =
    targetRect && !isCenter
      ? {
          top: targetRect.top - PAD,
          left: targetRect.left - PAD,
          width: targetRect.width + PAD * 2,
          height: targetRect.height + PAD * 2,
        }
      : null;

  const tooltipStyle = computeTooltipStyle(
    spotlight,
    step.placement ?? "auto",
    tooltipHeight,
    isCenter
  );

  const progressPct = ((stepIndex + 1) / steps.length) * 100;

  return (
    <div
      className={`fixed inset-0 z-[200] tour-root ${entered ? "tour-root-visible" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
    >
      <div className="absolute inset-0 tour-backdrop" aria-hidden />

      {spotlight && (
        <div
          className="absolute pointer-events-none tour-spotlight"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
          }}
        >
          <span className="tour-spotlight-label">Look here</span>
        </div>
      )}

      {waiting && !isCenter && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[201]">
          <div className="tour-loading-pill">
            <span className="tour-loading-dot" />
            <span className="tour-loading-dot tour-loading-dot-2" />
            <span className="tour-loading-dot tour-loading-dot-3" />
            <span className="text-sm font-medium text-white/90 ml-2">Opening this page…</span>
          </div>
        </div>
      )}

      <div
        ref={tooltipRef}
        className={[
          "tour-card absolute z-[202] flex flex-col overflow-hidden",
          isCenter ? "tour-card-center" : "tour-card-anchored",
          entered ? "tour-card-visible" : "",
        ].join(" ")}
        style={tooltipStyle}
      >
        <div className="tour-card-header">
          <div className="tour-card-header-top">
            <div className="min-w-0">
              {step.category && <p className="tour-category">{step.category}</p>}
              <p className="tour-meta">
                Step {stepIndex + 1} of {steps.length} · {roleLabel(role)}
              </p>
            </div>
            <button
              type="button"
              onClick={finish}
              className="tour-close"
              aria-label="Close tour"
            >
              ×
            </button>
          </div>
          <div className="tour-progress-track" aria-hidden>
            <div
              className="tour-progress-fill"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="tour-dots" aria-label={`Step ${stepIndex + 1} of ${steps.length}`}>
            {steps.map((_, i) => (
              <button
                key={i}
                type="button"
                className={[
                  "tour-dot",
                  i === stepIndex ? "tour-dot-active" : i < stepIndex ? "tour-dot-done" : "",
                ].join(" ")}
                aria-label={`Go to step ${i + 1}`}
                aria-current={i === stepIndex ? "step" : undefined}
                onClick={() => goToStep(i)}
              />
            ))}
          </div>
        </div>

        <div className="tour-card-body">
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
              <strong>Can&apos;t see the highlight?</strong>
              <span>
                On a small screen, open the menu (More) or use the sidebar, then tap Next again.
              </span>
            </div>
          )}

          {!isCenter && targetRect && (
            <p className="tour-pointer-hint">
              <span className="tour-pointer-arrow" aria-hidden>
                ↑
              </span>
              Highlighted on your screen
            </p>
          )}
        </div>

        <div className="tour-card-footer">
          <label className="tour-checkbox">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <span>Don&apos;t show automatically on login</span>
          </label>
          <div className="tour-actions">
            <Button
              variant="ghost"
              className="!py-2.5 !px-4"
              onClick={() => (stepIndex === 0 ? finish() : goToStep(stepIndex - 1))}
              disabled={navPending}
            >
              {stepIndex === 0 ? "Skip tour" : "Back"}
            </Button>
            {!isLast ? (
              <Button
                className="flex-1 !py-2.5 tour-btn-next"
                onClick={() => goToStep(stepIndex + 1)}
                disabled={navPending}
              >
                Continue
              </Button>
            ) : (
              <Button className="flex-1 !py-2.5 tour-btn-next" onClick={finish}>
                Start using Saffron
              </Button>
            )}
          </div>
          <p className="tour-kbd-hint">Tip: use ← → arrow keys</p>
        </div>
      </div>
    </div>
  );
}

function computeTooltipStyle(
  spotlight: { top: number; left: number; width: number; height: number } | null,
  placement: TourStep["placement"],
  tooltipHeight: number,
  isCenter: boolean
): CSSProperties {
  if (isCenter || !spotlight) {
    return {
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
      width: `min(calc(100vw - 2rem), ${TOOLTIP_MAX_W}px)`,
    };
  }

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const tw = Math.min(vw - 24, TOOLTIP_MAX_W);
  const th = Math.min(tooltipHeight, vh - 32);
  const prefer = placement === "auto" ? guessPlacement(spotlight, th) : placement;

  let top = spotlight.top + spotlight.height + GAP;
  let left = spotlight.left + spotlight.width / 2 - tw / 2;

  if (prefer === "top") {
    top = spotlight.top - GAP - th;
  } else if (prefer === "left") {
    left = spotlight.left - GAP - tw;
    top = spotlight.top + spotlight.height / 2 - th / 2;
  } else if (prefer === "right") {
    left = spotlight.left + spotlight.width + GAP;
    top = spotlight.top + spotlight.height / 2 - th / 2;
  }

  if (vw < 640) {
    top = Math.min(vh - th - 16, Math.max(16, spotlight.top + spotlight.height + GAP));
    left = 12;
    return { top, left, width: vw - 24, transform: "none" };
  }

  left = Math.max(12, Math.min(left, vw - tw - 12));
  top = Math.max(12, Math.min(top, vh - th - 12));

  return { top, left, width: tw, transform: "none" };
}

function guessPlacement(
  spotlight: { top: number; left: number; width: number; height: number },
  tooltipHeight: number
): "top" | "bottom" {
  const spaceBelow = window.innerHeight - (spotlight.top + spotlight.height);
  const spaceAbove = spotlight.top;
  if (spaceBelow >= tooltipHeight + GAP) return "bottom";
  if (spaceAbove >= tooltipHeight + GAP) return "top";
  return spotlight.top > window.innerHeight * 0.4 ? "top" : "bottom";
}

