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
  /** Adjusted opening = previous raw count − post-count cash out. This is
   * what we pre-fill into the form because it matches the actual physical
   * drawer right now (lines up with Treasury "Cash on hand"). */
  amount: number;
  fromDate: string;
  source?: "PREVIOUS_DAY" | "SAME_DAY_HANDOVER" | "NONE";
  handoverCashierName?: string | null;
  handoverEndTime?: string | null;
  handoverPending?: boolean;
  /** The original raw cash count from the previous shift. Shown only when
   * it differs from the adjusted opening so the user understands why. */
  rawCountedBalance?: number;
  /** Sum of cash that left the drawer after the previous count was locked
   * (post-close expenses + cash salary payouts). */
  postCountCashOut?: number;
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

export type PayRateHistoryEntry = {
  id: string;
  payType: PayType;
  payAmount: number;
  effectiveFrom: string;
  notes?: string;
  createdAt?: string;
};

export type PayrollShiftRow = {
  date: string;
  hours: number;
  hoursLabel: string;
  pay: number;
  payNote?: string;
  payType?: PayType;
  payAmount?: number;
  /** ISO date the per-shift pay rate started — present when honouring a
   * historical PayRateChange row. The frontend uses this to flag rows
   * that don't match the cashier's CURRENT rate. */
  rateEffectiveFrom?: string;
  /** True when the shift was scheduled as "till close" (endTime null)
   * and the system inferred end-of-day from restaurant operating hours
   * instead of measuring it. Frontend should label these as estimated. */
  tillCloseAssumed?: boolean;
};

export type PayrollPaymentRef = {
  id: string;
  userId: string;
  amount: number;
  paidDate: string;
  source: PaymentSource;
  periodFrom?: string;
  periodTo?: string;
  notes?: string;
  /** When true the payment is bookkeeping-only and does NOT affect treasury balances. */
  excludeFromTreasury?: boolean;
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
  /** True when one or more shifts in the period were paid at a rate
   * different from the cashier's current pay (i.e. PayRateChange history
   * applied). The frontend renders a "Rate changed mid-period" badge so
   * the headline rate next to the cashier's name can be trusted. */
  usesPayHistory?: boolean;
  shiftCount: number;
  /** Days worked from the start of the period through today.
   * Equals shiftCount once the period is over. */
  daysWorkedToDate?: number;
  totalHours: number;
  /** Hours accrued through today (shifts on or before today). */
  hoursToDate?: number;
  /** Earned from the cashier's scheduled shifts this period (no
   * clock-in / clock-out tracking is performed yet — see SalaryService
   * in the backend for the algorithm). */
  totalPay: number;
  /** Earned from shifts whose date is on or before today. Equals
   * totalPay for past periods, zero for future periods, and shows
   * progress for the current period. */
  earnedToDate?: number;
  /** Already recorded as paid for this period */
  paidAmount: number;
  /** Still owed for the full period (totalPay − paidAmount) */
  remainingPay: number;
  /** Owed RIGHT NOW = max(0, earnedToDate − paidAmount).
   * Useful when paying partway through the period. */
  owedNow?: number;
  fullyPaid?: boolean;
  payments?: PayrollPaymentRef[];
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
  grandTotalPaid: number;
  grandTotalRemaining: number;
  periodPayments?: PayrollPaymentRef[];
  rules: { payType: string; text: string }[];
};

export type TreasurySettings = {
  initialCashBalance: number;
  initialCardBalance: number;
  cardSalesSettlementRate: number;
  platformSettlementRates: Record<string, number>;
};

export type TreasuryOverview = {
  settings: TreasurySettings;
  /** Cash in the drawer — latest locked actual count MINUS standalone cash
   *  expenses AND salaries paid after that count (so the displayed balance
   *  always reflects post-count outflows). Falls back to the initial balance
   *  when no locked report exists yet. */
  cashBalance: number;
  /** Cumulative card / bank balance, salaries already subtracted. */
  cardBalance: number;
  /** Same as cashBalance but WITHOUT subtracting salaries — still subtracts
   *  any post-count standalone cash expenses. */
  cashBalanceBeforeSalary?: number;
  /** Same as cardBalance but without subtracting salary payouts. */
  cardBalanceBeforeSalary?: number;
  /** Raw drawer count from the latest locked report (no post-count
   *  adjustments). */
  cashRawCount?: number;
  /** Where `cashBalance` came from. */
  cashSource?: "LATEST_COUNT" | "INITIAL";
  cashLatestCountDate?: string;
  cashLatestCountCashierName?: string;
  cashLatestCountSubmittedAt?: string;
  /** Cumulative cash balance derived from initial + all reports − salaries
   *  − standalone cash expenses. Useful for cross-check vs the physical count. */
  cashComputedBalance?: number;
  /** Net of standalone expenses (kept for backward compatibility) */
  cashFromEntries: number;
  cardFromEntries: number;
  /** Raw components so the UI breakdown adds up cleanly */
  cashFromShiftReports?: number;
  cardFromShiftReports?: number;
  cardFromManualDelivery?: number;
  cardFromManualSettlement?: number;
  cardFromBankDeposits?: number;
  standaloneCashExpenses?: number;
  /** Subset of standaloneCashExpenses with effectiveDate AFTER the latest
   *  locked cash count — i.e. drawer outflows not yet reflected in any count. */
  standaloneCashExpensesPostCount?: number;
  standaloneCardExpenses?: number;
  salaryPaidFromCash: number;
  /** Subset of salaryPaidFromCash that has not yet been reflected in a
   *  physical cash count (i.e. paid after the latest locked count). */
  salaryPaidFromCashPostCount?: number;
  salaryPaidFromCard: number;
  /** Salary cash/card payments flagged "exclude from treasury" — tracked for
   *  transparency but NOT subtracted from the displayed balances. */
  salaryPaidFromCashExcluded?: number;
  salaryPaidFromCardExcluded?: number;
  currency: string;
};

export type SalaryPaymentRecord = {
  id: string;
  userId: string;
  employeeName: string;
  amount: number;
  paidDate: string;
  source: PaymentSource;
  periodFrom?: string;
  periodTo?: string;
  notes?: string;
  /** When true the payment is bookkeeping-only and does NOT affect treasury balances. */
  excludeFromTreasury?: boolean;
  createdAt: string;
};

export type ExpenseInvoice = {
  id: string;
  filename: string;
  entryId?: string;
};

/** File attached to a shift entry (e.g. POS card sales report). */
export type EntryFile = {
  id: string;
  filename: string;
  category?: string;
  entryId?: string;
  createdAt?: string;
};

/** Category constant for the POS card sales report uploads. */
export const POS_REPORT_CATEGORY = "pos-report";

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

export type ManualDeliveryIncome = {
  id: string;
  effectiveDate: string;
  platform: string;
  platformLabel: string;
  grossAmount: number;
  settledToCard: number;
  settledOverridden?: boolean;
  notes?: string;
  createdAt?: string;
};

/** Manual reconciliation of POS card sales: how much was rung up vs how much the bank credited.
 *  The `delta` (settled − gross) is added to the card / bank treasury balance. */
export type CardSettlement = {
  id: string;
  effectiveDate: string;
  grossAmount: number;
  settledAmount: number;
  /** settledAmount − grossAmount (can be negative). */
  delta: number;
  notes?: string;
  createdAt?: string;
};

/** A single bank credit that reconciles one or more source rows (multi-day batches). */
export type BankDepositLink = {
  id: string;
  linkedKind: string;
  linkedRefId: string;
  linkedDate: string;
  grossAmount: number;
  /** Pro-rata share of totalSettled this link absorbs. */
  share: number;
};

export type BankDeposit = {
  id: string;
  bankDate: string;
  totalSettled: number;
  totalGross: number;
  variance: number;
  linkCount: number;
  notes?: string;
  createdAt?: string;
  links: BankDepositLink[];
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
  /** Manual override — how much of delivery sales counts toward card/bank (null = use Settings %). */
  woltSettledToCard?: number | null;
  boltSettledToCard?: number | null;
  uberEatsSettledToCard?: number | null;
  glovoSettledToCard?: number | null;
  otherSettledToCard?: number | null;
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
  /** Delivery platforms credited to card for this shift (treasury settlement). */
  deliveryToCard?: number;
  /** Manual delivery income for this date (restaurant-wide, managers only). */
  manualDeliveryToCard?: number;
  closingBalance: number;
  actualCashCounted: number;
  difference: number;
  notes?: string;
  submittedAt?: string;
  deleteReason?: string;
  shiftType?: ShiftType;
  closingOnly?: boolean;
  schedule?: WorkSchedule;
  /** Files attached directly to this entry (e.g. POS card sales report). */
  files?: EntryFile[];
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
  /** Manual override — how much of delivery sales counts toward card/bank (null = use Settings %). */
  woltSettledToCard?: number | null;
  boltSettledToCard?: number | null;
  uberEatsSettledToCard?: number | null;
  glovoSettledToCard?: number | null;
  otherSettledToCard?: number | null;
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
