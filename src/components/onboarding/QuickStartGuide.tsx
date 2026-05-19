import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Role } from "../../types";
import {
  dismissQuickGuide,
  quickGuideForRole,
  type GuideStep,
} from "../../lib/onboarding";
import { roleLabel } from "../../lib/roles";
import { Button } from "../ui/Button";

type Props = {
  role: Role | string;
  userId: string;
  onClose: () => void;
};

export function QuickStartGuide({ role, userId, onClose }: Props) {
  const guide = quickGuideForRole(role);
  const [step, setStep] = useState(0);
  const [remember, setRemember] = useState(false);

  const finish = useCallback(() => {
    dismissQuickGuide(role, userId, remember);
    onClose();
  }, [role, userId, remember, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish]);

  const current = guide.steps[step];
  const isLast = step === guide.steps.length - 1;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-guide-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[var(--color-ink)]/55 backdrop-blur-[2px]"
        aria-label="Close guide"
        onClick={finish}
      />
      <div
        className="relative w-full sm:max-w-lg max-h-[92vh] sm:max-h-[88vh] flex flex-col bg-[var(--color-surface)] rounded-t-2xl sm:rounded-2xl shadow-[var(--shadow-card)] overflow-hidden"
      >
        <div className="h-1.5 shrink-0 bg-[var(--color-saffron-light)]" aria-hidden>
          <div
            className="h-full bg-[var(--color-saffron)] transition-all duration-300 ease-out"
            style={{ width: `${((step + 1) / guide.steps.length) * 100}%` }}
          />
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-saffron)]">
            Quick start · {roleLabel(role)}
          </p>
          <h2
            id="quick-guide-title"
            className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl text-[var(--color-ink)] mt-1 tracking-tight"
          >
            {step === 0 ? guide.title : current.title}
          </h2>
          {step === 0 && (
            <p className="text-sm text-[var(--color-muted)] mt-3 leading-relaxed">{guide.intro}</p>
          )}

          <StepCard step={current} showTitle={step === 0} />

          <div className="flex justify-center gap-1.5 mt-6" aria-label="Step progress">
            {guide.steps.map((_, i) => (
              <span
                key={i}
                className={[
                  "h-1.5 rounded-full transition-all",
                  i === step ? "w-6 bg-[var(--color-saffron)]" : "w-1.5 bg-black/10",
                ].join(" ")}
              />
            ))}
          </div>
        </div>

        <div className="shrink-0 border-t border-black/[0.06] p-4 sm:p-5 space-y-3 bg-[var(--color-cream)]/80">
          <label className="flex items-start gap-2.5 text-sm text-[var(--color-muted)] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="mt-0.5 rounded border-stone-300 text-[var(--color-saffron)] focus:ring-[var(--color-saffron)]"
            />
            Don&apos;t show this automatically again
          </label>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="ghost" className="flex-1" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            )}
            {!isLast ? (
              <Button className="flex-1" onClick={() => setStep((s) => s + 1)}>
                Next
              </Button>
            ) : (
              <Button className="flex-1" onClick={finish}>
                Got it
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepCard({ step, showTitle }: { step: GuideStep; showTitle: boolean }) {
  return (
    <div
      className={[
        "p-4 rounded-xl border border-black/[0.06] bg-[var(--color-cream)]/60",
        showTitle ? "mt-5" : "mt-6",
      ].join(" ")}
    >
      {showTitle && <h3 className="font-semibold text-[var(--color-ink)] mb-2">{step.title}</h3>}
      <p className="text-sm text-[var(--color-ink)]/85 leading-relaxed">{step.body}</p>
      {step.to && step.linkLabel && (
        <Link
          to={step.to}
          className="inline-flex items-center gap-1 mt-4 text-sm font-semibold text-[var(--color-saffron)] hover:underline"
        >
          {step.linkLabel}
          <span aria-hidden>→</span>
        </Link>
      )}
    </div>
  );
}
