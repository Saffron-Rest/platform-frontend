import { useCallback, useEffect, useLayoutEffect, useState, type CSSProperties } from "react";
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

const PAD = 8;
const TOOLTIP_GAP = 14;
const MAX_WAIT_MS = 4000;

function findTarget(selector: string): Element | null {
  const el = document.querySelector(`[data-tour="${selector}"]`);
  if (el && isVisible(el)) return el;
  return null;
}

function isVisible(el: Element): boolean {
  const r = (el as HTMLElement).getBoundingClientRect();
  if (r.width < 2 && r.height < 2) return false;
  const style = window.getComputedStyle(el);
  return style.visibility !== "hidden" && style.display !== "none" && style.opacity !== "0";
}

function measure(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return {
    top: r.top,
    left: r.left,
    width: r.width,
    height: r.height,
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

export function OnboardingTour({ role, userId, onClose }: Props) {
  const steps = tourStepsForRole(role);
  const navigate = useNavigate();
  const location = useLocation();
  const [stepIndex, setStepIndex] = useState(0);
  const [remember, setRemember] = useState(false);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [waiting, setWaiting] = useState(true);
  const [navPending, setNavPending] = useState(false);

  const step: TourStep = steps[stepIndex];
  const isCenter = step.target === TOUR_CENTER;
  const isLast = stepIndex === steps.length - 1;

  const finish = useCallback(() => {
    dismissQuickGuide(role, userId, remember);
    onClose();
  }, [role, userId, remember, onClose]);

  const goToStep = useCallback(
    (next: number) => {
      if (next < 0 || next >= steps.length) return;
      setStepIndex(next);
      setTargetRect(null);
      setWaiting(true);
    },
    [steps.length]
  );

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
        requestAnimationFrame(() => {
          const again = findTarget(step.target);
          setTargetRect(again ? measure(again) : rect);
        });
      } else {
        setTargetRect(null);
      }
      setWaiting(false);
    }, signal);

    const onResize = () => {
      const el = findTarget(step.target);
      if (el) setTargetRect(measure(el));
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);

    return () => {
      signal.cancelled = true;
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [step.target, stepIndex, navPending, isCenter]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish]);

  const spotlight = targetRect && !isCenter
    ? {
        top: targetRect.top - PAD,
        left: targetRect.left - PAD,
        width: targetRect.width + PAD * 2,
        height: targetRect.height + PAD * 2,
      }
    : null;

  const tooltipStyle = computeTooltipStyle(spotlight, step.placement ?? "auto");

  return (
    <div className="fixed inset-0 z-[200]" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <button
        type="button"
        className="absolute inset-0 bg-[var(--color-ink)]/60 cursor-default"
        aria-label="Close tour"
        onClick={finish}
      />

      {spotlight && (
        <>
          <div
            className="absolute rounded-xl ring-2 ring-[var(--color-saffron)] ring-offset-2 ring-offset-transparent pointer-events-none tour-spotlight-pulse"
            style={{
              top: spotlight.top,
              left: spotlight.left,
              width: spotlight.width,
              height: spotlight.height,
              boxShadow: "0 0 0 9999px rgba(26, 22, 20, 0.62)",
            }}
          />
        </>
      )}

      {!spotlight && !isCenter && !waiting && (
        <div className="absolute inset-0 bg-[var(--color-ink)]/65" aria-hidden />
      )}

      <div
        className={[
          "absolute z-[201] w-[min(calc(100vw-2rem),22rem)] flex flex-col bg-white rounded-2xl shadow-[var(--shadow-card)] border border-black/[0.08] overflow-hidden",
          isCenter || !spotlight ? "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" : "",
        ].join(" ")}
        style={!isCenter && spotlight ? tooltipStyle : undefined}
      >
        <div className="h-1 bg-[var(--color-saffron-light)]" aria-hidden>
          <div
            className="h-full bg-[var(--color-saffron)] transition-all duration-300"
            style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
          />
        </div>

        <div className="p-4 sm:p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-saffron)]">
            Step {stepIndex + 1} of {steps.length} · {roleLabel(role)}
          </p>
          <h2 id="tour-title" className="font-bold text-lg text-[var(--color-ink)] mt-1 leading-snug">
            {step.title}
          </h2>
          <p className="text-sm text-[var(--color-muted)] mt-2 leading-relaxed">{step.body}</p>
          {waiting && !isCenter && (
            <p className="text-xs text-[var(--color-saffron)] mt-2 font-medium">Loading this section…</p>
          )}
          {!waiting && !isCenter && !targetRect && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 mt-2">
              This item isn&apos;t visible on your screen size — use the menu or continue with Next.
            </p>
          )}
        </div>

        <div className="px-4 pb-4 sm:px-5 sm:pb-5 space-y-3 border-t border-black/[0.06] pt-3 bg-[var(--color-cream)]/50">
          <label className="flex items-start gap-2 text-xs text-[var(--color-muted)] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="mt-0.5 rounded border-stone-300 text-[var(--color-saffron)]"
            />
            Don&apos;t start this tour automatically again
          </label>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              className="!py-2.5 !px-3"
              onClick={() => (stepIndex === 0 ? finish() : goToStep(stepIndex - 1))}
              disabled={waiting && navPending}
            >
              {stepIndex === 0 ? "Skip" : "Back"}
            </Button>
            {!isLast ? (
              <Button className="flex-1 !py-2.5" onClick={() => goToStep(stepIndex + 1)} disabled={navPending}>
                Next
              </Button>
            ) : (
              <Button className="flex-1 !py-2.5" onClick={finish}>
                Finish
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function computeTooltipStyle(
  spotlight: { top: number; left: number; width: number; height: number } | null,
  placement: TourStep["placement"]
): CSSProperties {
  if (!spotlight) return {};
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const tw = Math.min(vw - 32, 352);
  let top = spotlight.top + spotlight.height + TOOLTIP_GAP;
  let left = spotlight.left + spotlight.width / 2 - tw / 2;

  const prefer = placement === "auto" ? guessPlacement(spotlight) : placement;

  if (prefer === "top") {
    top = spotlight.top - TOOLTIP_GAP - 200;
  } else if (prefer === "left") {
    left = spotlight.left - tw - TOOLTIP_GAP;
    top = spotlight.top;
  } else if (prefer === "right") {
    left = spotlight.left + spotlight.width + TOOLTIP_GAP;
    top = spotlight.top;
  } else if (prefer === "bottom") {
    top = spotlight.top + spotlight.height + TOOLTIP_GAP;
  }

  left = Math.max(16, Math.min(left, vw - tw - 16));
  top = Math.max(16, Math.min(top, vh - 220));

  return { top, left, width: tw, transform: "none" };
}

function guessPlacement(spotlight: {
  top: number;
  left: number;
  width: number;
  height: number;
}): "top" | "bottom" {
  return spotlight.top > window.innerHeight * 0.45 ? "top" : "bottom";
}
