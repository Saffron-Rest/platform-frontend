export type Role = "ADMIN" | "MANAGER" | "CASHIER";
export type PayType = "HOURLY" | "DAILY" | "MONTHLY";
export type EntryStatus = "DRAFT" | "LOCKED";
/** FULL = full daily report; CLOSING = opening + actual cash count only (works till end of shift). */
export type ShiftType = "FULL" | "CLOSING";

export type WorkShiftInfo = {
  userId: string;
  date: string;
  shiftType: ShiftType;
  closingOnly: boolean;
};

export type WorkSchedule = {
  userId: string;
  date: string;
  working: boolean;
  startTime: string | null;
  endTime: string | null;
  tillClose: boolean;
  shiftType: ShiftType;
  closingOnly: boolean;
  /** True when this employee is the single designated closer for the day. */
  designatedCloser?: boolean;
  hoursLabel: string;
  name?: string;
  email?: string;
  id?: string;
};

export type OpeningHint = {
  amount: number;
  fromDate: string;
  source?: "PREVIOUS_DAY" | "SAME_DAY_HANDOVER" | "NONE";
  handoverCashierName?: string | null;
  handoverEndTime?: string | null;
  handoverPending?: boolean;
};

export type ScheduleRow = WorkSchedule & {
  name: string;
  email: string;
};

export type User = {
  id: string;
  username: string;
  email?: string | null;
  name: string;
  role: Role;
  mustChangePassword?: boolean;
  active?: boolean;
  /** Employment start date (YYYY-MM-DD). */
  startDate?: string | null;
  payType?: PayType;
  payAmount?: number | null;
  /** @deprecated use payAmount */
  hourlyRate?: number | null;
};

export type PayrollShiftRow = {
  date: string;
  hours: number;
  hoursLabel: string;
  pay: number;
  payNote?: string;
};

export type PayrollEmployee = {
  userId: string;
  name: string;
  email: string;
  active: boolean;
  payType: PayType;
  payTypeLabel: string;
  payAmount: number;
  payAmountLabel: string;
  calculationSummary: string;
  shiftCount: number;
  totalHours: number;
  totalPay: number;
  shifts: PayrollShiftRow[];
};

export type DayHours = {
  closed: boolean;
  open: string;
  close: string;
};

export type WeeklyHours = Record<string, DayHours>;

export type PayrollReport = {
  from: string;
  to: string;
  calendarDays: number;
  weeklyHours?: WeeklyHours;
  storeCloseTime: string;
  standardDayHours: number;
  currency: string;
  employees: PayrollEmployee[];
  grandTotalHours: number;
  grandTotalPay: number;
  rules: { payType: string; text: string }[];
};

export type ExpenseInvoice = {
  id: string;
  filename: string;
  entryId?: string;
};

export type PaymentSource = "CASH" | "CARD";

export type ExpenseLine = {
  id?: string;
  category: string;
  description: string;
  amount: number;
  paymentSource: PaymentSource;
  invoices?: ExpenseInvoice[];
  /** @deprecated first invoice — use invoices */
  invoice?: ExpenseInvoice;
  pendingFile?: File;
  pendingFiles?: File[];
};

export type DailyEntry = {
  id: string;
  date: string;
  cashierId: string;
  cashier?: { id: string; name: string; email: string };
  status: EntryStatus;
  openingBalance: number;
  cashSales: number;
  cardSales: number;
  woltSales: number;
  boltSales: number;
  uberEatsSales: number;
  glovoSales: number;
  otherPlatformSales: number;
  cashRefunds: number;
  cardRefunds: number;
  platformRefunds: number;
  bankDeposit: number;
  cashWithdrawal: number;
  ownerWithdrawal: number;
  supplierPayments: number;
  pettyCash: number;
  supplies: number;
  staffMeals: number;
  deliveryCosts: number;
  otherExpenses: number;
  expenses?: ExpenseLine[];
  expenseLinesTotal?: number;
  expenseCashTotal?: number;
  expenseCardTotal?: number;
  payoutsTotal?: number;
  cardBalance?: number;
  closingBalance: number;
  actualCashCounted: number;
  difference: number;
  notes?: string;
  submittedAt?: string;
  deleteReason?: string;
  shiftType?: ShiftType;
  closingOnly?: boolean;
  schedule?: WorkSchedule;
};

/** Payout fields + sales/refunds/notes — expense lines are separate */
export type EntryFormData = {
  openingBalance: number;
  cashSales: number;
  cardSales: number;
  woltSales: number;
  boltSales: number;
  uberEatsSales: number;
  glovoSales: number;
  otherPlatformSales: number;
  cashRefunds: number;
  cardRefunds: number;
  platformRefunds: number;
  bankDeposit: number;
  cashWithdrawal: number;
  ownerWithdrawal: number;
  actualCashCounted: number;
  notes?: string;
};

export const emptyEntryForm = (): EntryFormData => ({
  openingBalance: 0,
  cashSales: 0,
  cardSales: 0,
  woltSales: 0,
  boltSales: 0,
  uberEatsSales: 0,
  glovoSales: 0,
  otherPlatformSales: 0,
  cashRefunds: 0,
  cardRefunds: 0,
  platformRefunds: 0,
  bankDeposit: 0,
  cashWithdrawal: 0,
  ownerWithdrawal: 0,
  actualCashCounted: 0,
  notes: "",
});

export const emptyExpenseLine = (): ExpenseLine => ({
  category: "OTHER",
  description: "",
  amount: 0,
  paymentSource: "CASH",
});

export type Platforms = {
  wolt: boolean;
  bolt: boolean;
  uberEats: boolean;
  glovo: boolean;
  other: boolean;
};
