export const EXPENSE_CATEGORIES = [
  { value: "SUPPLIER", label: "Supplier" },
  { value: "SUPPLIES", label: "Supplies" },
  { value: "STAFF_MEALS", label: "Staff meals" },
  { value: "DELIVERY", label: "Delivery" },
  { value: "PETTY_CASH", label: "Petty cash" },
  { value: "UTILITIES", label: "Utilities" },
  { value: "CLEANING", label: "Cleaning" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "MARKETING", label: "Marketing" },
  { value: "OTHER", label: "Other" },
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]["value"];
