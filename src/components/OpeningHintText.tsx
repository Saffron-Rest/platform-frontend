import type { OpeningHint } from "../types";
import { fmt } from "../lib/calc";

export function OpeningHintText({ hint }: { hint: OpeningHint }) {
  if (hint.handoverPending && hint.handoverCashierName) {
    return (
      <p className="mt-1 text-xs text-amber-700">
        {hint.handoverCashierName} has a report today without an actual cash count yet. Using the
        restaurant&apos;s last locked count until they save theirs.
      </p>
    );
  }
  if (hint.source === "SAME_DAY_HANDOVER") {
    const who = hint.handoverCashierName ? `${hint.handoverCashierName}'s ` : "";
    return (
      <p className="mt-1 text-xs text-[var(--color-muted)]">
        Restaurant drawer — from {who}report today: <strong>actual cash counted</strong>{" "}
        {fmt(hint.amount)}.
      </p>
    );
  }
  const who = hint.handoverCashierName ? ` (${hint.handoverCashierName})` : "";
  return (
    <p className="mt-1 text-xs text-[var(--color-muted)]">
      Restaurant drawer — last close on {hint.fromDate}
      {who}: <strong>actual cash counted</strong> {fmt(hint.amount)}.
    </p>
  );
}
