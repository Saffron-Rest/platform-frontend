import type { OpeningHint } from "../types";
import { fmt } from "../lib/calc";

/** True when post-count cash movements lowered the drawer vs. the raw
 * count from the previous shift. We surface the breakdown so the user
 * understands why the suggested opening is smaller than the last count
 * (matches "Cash on hand" in Treasury). */
function postCountDelta(hint: OpeningHint): number {
  const out = hint.postCountCashOut ?? 0;
  return out > 0.005 ? out : 0;
}

export function OpeningHintText({ hint }: { hint: OpeningHint }) {
  if (hint.handoverPending && hint.handoverCashierName) {
    return (
      <p className="mt-1 text-xs text-amber-700">
        {hint.handoverCashierName} has a report today without an actual cash count yet. Using the
        restaurant&apos;s last locked count until they save theirs.
      </p>
    );
  }
  const delta = postCountDelta(hint);
  const breakdown = delta > 0 && hint.rawCountedBalance != null ? (
    <span className="block mt-0.5">
      Last count {fmt(hint.rawCountedBalance)} − cash paid out since {fmt(delta)}
      {" "}= <strong>{fmt(hint.amount)}</strong> in the drawer now.
    </span>
  ) : null;

  if (hint.source === "SAME_DAY_HANDOVER") {
    const who = hint.handoverCashierName ? `${hint.handoverCashierName}'s ` : "";
    return (
      <p className="mt-1 text-xs text-[var(--color-muted)]">
        Restaurant drawer — from {who}report today: <strong>actual cash counted</strong>{" "}
        {fmt(hint.amount)}.
        {breakdown}
      </p>
    );
  }
  const who = hint.handoverCashierName ? ` (${hint.handoverCashierName})` : "";
  return (
    <p className="mt-1 text-xs text-[var(--color-muted)]">
      Restaurant drawer — last close on {hint.fromDate}
      {who}: <strong>actual cash counted</strong> {fmt(hint.amount)}.
      {breakdown}
    </p>
  );
}
