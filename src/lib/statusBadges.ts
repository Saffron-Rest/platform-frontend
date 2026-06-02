/**
 * Centralized domain-status → {@link BadgeTone} mappings. Keeps the UI
 * consistent across pages: an "overdue" payable, an "overdue" salary
 * payout, and an "overdue" reimbursement should all read as
 * {@code danger}, not as three different shades of amber/red.
 *
 * <p>Each helper returns both the {@code tone} (for {@link Badge}) and
 * a {@code label} (so callers can render the exact same wording). Use
 * the {@code icon} via {@link Badge}'s {@code icon} prop when you want
 * to convey status with shape as well as colour (recommended for
 * colour-blind users).</p>
 */

import type { BadgeTone } from "../components/ui/Badge";

export type StatusBadge = {
  tone: BadgeTone;
  label: string;
};

/* ── Daily entries ─────────────────────────────────────────────────── */

export function entryStatus(status: string): StatusBadge {
  switch (status) {
    case "LOCKED":
      return { tone: "success", label: "Submitted" };
    case "DRAFT":
      return { tone: "warning", label: "Draft" };
    default:
      return { tone: "neutral", label: status };
  }
}

/* ── Supplier payables ─────────────────────────────────────────────── */

export type PayableStatusInput = {
  status: string;
  /** Days past due. Positive = overdue, negative/0 = not yet due. */
  daysOverdue?: number | null;
};

export function payableStatus(input: PayableStatusInput): StatusBadge {
  const { status } = input;
  if (status === "VOID") return { tone: "inactive", label: "Voided" };
  if (status === "PAID") return { tone: "success", label: "Paid" };
  if ((input.daysOverdue ?? 0) > 0) {
    const d = input.daysOverdue ?? 0;
    return {
      tone: "danger",
      label: d === 1 ? "1 day overdue" : `${d} days overdue`,
    };
  }
  if (status === "PARTIAL") return { tone: "warning", label: "Partial" };
  if (status === "UNPAID") return { tone: "neutral", label: "Open" };
  return { tone: "neutral", label: status };
}

/** Aging bucket → severity tone. Used by the AdminPayables aging panel
 *  and the FinanceLedger overdue summary. */
export function agingTone(daysOverdue: number): BadgeTone {
  if (daysOverdue <= 0) return "success";
  if (daysOverdue <= 7) return "warning";
  if (daysOverdue <= 30) return "warning";
  if (daysOverdue <= 60) return "danger";
  return "danger";
}

/* ── Owner reimbursements ──────────────────────────────────────────── */

export function ownerExpenseStatus(status: string): StatusBadge {
  switch (status) {
    case "VOID":
      return { tone: "inactive", label: "Cancelled" };
    case "REIMBURSED":
      return { tone: "success", label: "Reimbursed" };
    case "PARTIAL":
      return { tone: "warning", label: "Partial" };
    case "OUTSTANDING":
      return { tone: "neutral", label: "Owed" };
    default:
      return { tone: "neutral", label: status };
  }
}

/* ── Stock movements ───────────────────────────────────────────────── */

export function stockMovementType(type: string): StatusBadge {
  switch (type) {
    case "PURCHASE":
      return { tone: "success", label: "Purchase" };
    case "SALE":
      return { tone: "info", label: "Sale" };
    case "ADJUSTMENT":
      return { tone: "warning", label: "Adjustment" };
    case "REVERT":
      return { tone: "danger", label: "Revert" };
    case "TRANSFER":
      return { tone: "info", label: "Transfer" };
    default:
      return { tone: "neutral", label: type };
  }
}

/* ── Incidents ─────────────────────────────────────────────────────── */

export function incidentSeverity(severity: string): StatusBadge {
  switch (severity) {
    case "CRITICAL":
      return { tone: "danger", label: "Critical" };
    case "HIGH":
      return { tone: "danger", label: "High" };
    case "MEDIUM":
      return { tone: "warning", label: "Medium" };
    case "LOW":
      return { tone: "info", label: "Low" };
    default:
      return { tone: "neutral", label: severity };
  }
}

export function incidentStatus(status: string): StatusBadge {
  switch (status) {
    case "OPEN":
      return { tone: "warning", label: "Open" };
    case "IN_PROGRESS":
      return { tone: "info", label: "In progress" };
    case "RESOLVED":
      return { tone: "success", label: "Resolved" };
    case "CLOSED":
      return { tone: "inactive", label: "Closed" };
    default:
      return { tone: "neutral", label: status };
  }
}

/* ── Treasury / finance ledger ────────────────────────────────────── */

export function treasuryCategory(category: string): StatusBadge {
  switch (category) {
    case "INCOME":
      return { tone: "success", label: "Income" };
    case "SHIFT_EXPENSE":
      return { tone: "neutral", label: "Shift expense" };
    case "STANDALONE_EXPENSE":
      return { tone: "neutral", label: "Expense" };
    case "PAYOUT":
      return { tone: "warning", label: "Payout" };
    case "TRANSFER":
      return { tone: "info", label: "Transfer" };
    case "PAYABLE_PAYMENT":
      return { tone: "info", label: "Payable" };
    default:
      return { tone: "neutral", label: category };
  }
}

/* ── User / account state ──────────────────────────────────────────── */

export function userStatus(active: boolean): StatusBadge {
  return active
    ? { tone: "success", label: "Active" }
    : { tone: "inactive", label: "Inactive" };
}
