import type { EntryFormData, ExpenseLine } from "../types";
import {
  cashDifference,
  closingBalance,
  expenseTotalBySource,
  totalExpenseLines,
  totalSales,
} from "./calc";
import { fmt } from "./calc";
import { num } from "./numbers";

export type ReportStep = {
  id: string;
  label: string;
  done: boolean;
  hint?: string;
};

export type ValidationIssue = {
  id: string;
  level: "error" | "warning";
  message: string;
  stepId?: string;
};

export function buildReportSteps(
  form: EntryFormData,
  _expenses: ExpenseLine[],
  closingOnly: boolean
): ReportStep[] {
  const opening = num(form.openingBalance);
  const actual = num(form.actualCashCounted);
  const sales =
    num(form.cashSales) +
    num(form.cardSales) +
    num(form.woltSales) +
    num(form.boltSales) +
    num(form.uberEatsSales) +
    num(form.glovoSales) +
    num(form.otherPlatformSales);

  if (closingOnly) {
    return [
      {
        id: "opening",
        label: "Opening",
        done: opening > 0,
        hint: opening > 0 ? undefined : "Enter opening cash",
      },
      {
        id: "closing",
        label: "Cash count",
        done: actual > 0,
        hint: actual > 0 ? undefined : "Enter actual cash counted",
      },
    ];
  }

  return [
    {
      id: "opening",
      label: "Opening",
      done: opening > 0,
      hint: opening > 0 ? undefined : "Enter opening cash",
    },
    {
      id: "sales",
      label: "Sales",
      done: sales > 0,
      hint: sales > 0 ? undefined : "Enter cash, card, or platform sales",
    },
    {
      id: "closing",
      label: "Closing",
      done: actual > 0,
      hint: actual > 0 ? undefined : "Count drawer and enter actual cash",
    },
  ];
}

export function getReportValidationIssues(
  form: EntryFormData,
  expenses: ExpenseLine[],
  closingOnly: boolean
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const opening = num(form.openingBalance);
  const actual = num(form.actualCashCounted);
  const sales =
    num(form.cashSales) +
    num(form.cardSales) +
    num(form.woltSales) +
    num(form.boltSales) +
    num(form.uberEatsSales) +
    num(form.glovoSales) +
    num(form.otherPlatformSales);

  if (opening <= 0) {
    issues.push({
      id: "opening",
      level: "error",
      stepId: "opening",
      message: "Opening cash is required — enter the amount in the drawer at shift start.",
    });
  }

  if (!closingOnly && sales <= 0) {
    issues.push({
      id: "sales",
      level: "error",
      stepId: "sales",
      message: "Record at least one sale (cash, card, or delivery platform).",
    });
  }

  if (actual <= 0) {
    issues.push({
      id: "closing",
      level: "error",
      stepId: "closing",
      message: closingOnly
        ? "Enter the actual cash you counted at end of shift."
        : "Closing step incomplete — count physical cash in the drawer and enter it under Closing.",
    });
  }

  expenses.forEach((line, i) => {
    const amount = num(line.amount);
    const desc = (line.description || "").trim();
    const cat = (line.category || "").trim();
    if (amount > 0 && !desc && !cat) {
      issues.push({
        id: `expense-${i}`,
        level: "warning",
        message: `Expense line ${i + 1}: add a description or category (amount ${fmt(amount)}).`,
      });
    }
    if ((desc || cat) && amount <= 0) {
      issues.push({
        id: `expense-empty-${i}`,
        level: "warning",
        message: `Expense line ${i + 1}: enter an amount or remove the empty line.`,
      });
    }
  });

  if (!closingOnly && actual > 0) {
    const diff = cashDifference(form, expenses);
    if (diff < -0.01) {
      issues.push({
        id: "diff-short",
        level: "warning",
        stepId: "closing",
        message: `Drawer is short by ${fmt(Math.abs(diff))}. Verify the count or add a note before submitting.`,
      });
    } else if (diff > 0.01) {
      issues.push({
        id: "diff-over",
        level: "warning",
        stepId: "closing",
        message: `Drawer is over by ${fmt(diff)}. Double-check the count before submitting.`,
      });
    }
  }

  if (!closingOnly && actual > 0 && totalExpenseLines(expenses) === 0 && sales > 500) {
    issues.push({
      id: "no-expenses",
      level: "warning",
      message: "No expenses recorded — confirm if that is correct for this shift.",
    });
  }

  return issues;
}

export function reportReadyToSubmit(
  form: EntryFormData,
  expenses: ExpenseLine[],
  closingOnly: boolean
): boolean {
  const steps = buildReportSteps(form, expenses, closingOnly);
  const blocking = getReportValidationIssues(form, expenses, closingOnly).filter(
    (i) => i.level === "error"
  );
  return steps.every((s) => s.done) && blocking.length === 0;
}

export function reportSummary(form: EntryFormData, expenses: ExpenseLine[], closingOnly: boolean) {
  const opening = num(form.openingBalance);
  const actual = num(form.actualCashCounted);
  if (closingOnly) {
    const cashExp = expenseTotalBySource(expenses, "CASH");
    return {
      opening,
      sales: 0,
      expected: actual > 0 ? actual - cashExp : opening,
      actual,
      difference: actual - opening,
    };
  }
  return {
    opening,
    sales: totalSales(form),
    expected: closingBalance(form, expenses),
    actual,
    difference: cashDifference(form, expenses),
  };
}
