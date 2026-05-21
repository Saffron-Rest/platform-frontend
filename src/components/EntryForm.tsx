import { MoneyInput } from "./MoneyInput";
import { ExpenseLines } from "./ExpenseLines";
import { OpeningBalanceField } from "./OpeningBalanceField";
import { CollapsibleSection } from "./report/CollapsibleSection";
import { PosReportUploader } from "./report/PosReportUploader";
import type {
  EntryFile,
  EntryFormData,
  ExpenseLine,
  OpeningHint,
  Platforms,
  TreasurySettings,
} from "../types";
import {
  cardBalance,
  cashDifference,
  closingBalance,
  expenseTotalBySource,
  fmt,
  totalPayouts,
  totalSales,
} from "../lib/calc";
import { treasuryCardNet, totalDeliverySettledToCard } from "../lib/treasuryCalc";
import { num } from "../lib/numbers";
import { DeliverySettlementFields } from "./report/DeliverySettlementFields";

type Props = {
  data: EntryFormData;
  expenses: ExpenseLine[];
  onChange: (d: EntryFormData) => void;
  onExpensesChange: (e: ExpenseLine[]) => void;
  disabled?: boolean;
  invoicesEditable?: boolean;
  openingEditable?: boolean;
  platforms: Platforms;
  openingHint?: OpeningHint | null;
  treasurySettings?: Pick<TreasurySettings, "cardSalesSettlementRate" | "platformSettlementRates">;
  /** POS report files attached to this entry (already uploaded). */
  posReportFiles?: EntryFile[];
  /** POS report files staged for upload after the entry is created. */
  pendingPosReports?: File[];
  /** The ID of the entry — required for immediate upload; missing means new draft. */
  entryId?: string;
  /** Receives uploader changes (uploaded files + pending files). */
  onPosReportChange?: (patch: { files?: EntryFile[]; pendingFiles?: File[] }) => void;
};

export function EntryForm({
  data,
  expenses,
  onChange,
  onExpensesChange,
  disabled,
  invoicesEditable,
  openingEditable = true,
  platforms,
  openingHint,
  treasurySettings,
  posReportFiles = [],
  pendingPosReports = [],
  entryId,
  onPosReportChange,
}: Props) {
  const set = (key: keyof EntryFormData, value: number | string) =>
    onChange({ ...data, [key]: value });

  const closing = closingBalance(data, expenses);
  const diff = cashDifference(data, expenses);
  const cashExpenses = expenseTotalBySource(expenses, "CASH");
  const cardExpenses = expenseTotalBySource(expenses, "CARD");
  const cardNetBasic = cardBalance(data, expenses);
  const cardNetTreasury = treasurySettings
    ? treasuryCardNet(data, cardExpenses, treasurySettings)
    : cardNetBasic;
  const deliveryToCard = treasurySettings
    ? totalDeliverySettledToCard(data, treasurySettings.platformSettlementRates)
    : 0;
  const salesTotal = totalSales(data);

  return (
    <div>
      <CollapsibleSection
        sectionId="opening"
        done={num(data.openingBalance) > 0}
        title="Opening"
        summary={openingHint ? `Suggested ${fmt(data.openingBalance)}` : undefined}
        defaultOpen
      >
        <OpeningBalanceField
          value={data.openingBalance}
          onChange={(v) => set("openingBalance", v)}
          disabled={disabled}
          editable={openingEditable}
          openingHint={openingHint}
        />
      </CollapsibleSection>

      <CollapsibleSection
        sectionId="sales"
        done={salesTotal > 0}
        title="Sales"
        summary={`Total ${fmt(salesTotal)}`}
        defaultOpen
      >
        <MoneyInput
          label="Cash sales"
          value={data.cashSales}
          onChange={(v) => set("cashSales", v)}
          disabled={disabled}
        />
        <MoneyInput
          label="Card sales"
          value={data.cardSales}
          onChange={(v) => set("cardSales", v)}
          disabled={disabled}
        />
        {onPosReportChange && (
          <PosReportUploader
            files={posReportFiles}
            pendingFiles={pendingPosReports}
            entryId={entryId}
            editable={!disabled}
            required={num(data.cardSales) > 0}
            onChange={onPosReportChange}
          />
        )}
        {platforms.wolt && (
          <MoneyInput label="Wolt" value={data.woltSales} onChange={(v) => set("woltSales", v)} disabled={disabled} />
        )}
        {platforms.bolt && (
          <MoneyInput
            label="Bolt Food"
            value={data.boltSales}
            onChange={(v) => set("boltSales", v)}
            disabled={disabled}
          />
        )}
        {platforms.uberEats && (
          <MoneyInput
            label="Uber Eats"
            value={data.uberEatsSales}
            onChange={(v) => set("uberEatsSales", v)}
            disabled={disabled}
          />
        )}
        {platforms.glovo && (
          <MoneyInput label="Glovo" value={data.glovoSales} onChange={(v) => set("glovoSales", v)} disabled={disabled} />
        )}
        {platforms.other && (
          <MoneyInput
            label="Other platforms"
            value={data.otherPlatformSales}
            onChange={(v) => set("otherPlatformSales", v)}
            disabled={disabled}
          />
        )}
        {treasurySettings && (
          <DeliverySettlementFields
            data={data}
            onChange={onChange}
            disabled={disabled}
            platforms={platforms}
            treasurySettings={treasurySettings}
          />
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Returns & refunds" summary="Optional" defaultOpen={false}>
        <MoneyInput
          label="Cash refunds"
          value={data.cashRefunds}
          onChange={(v) => set("cashRefunds", v)}
          disabled={disabled}
        />
        <MoneyInput
          label="Card refunds"
          value={data.cardRefunds}
          onChange={(v) => set("cardRefunds", v)}
          disabled={disabled}
        />
        <MoneyInput
          label="Platform refunds"
          value={data.platformRefunds}
          onChange={(v) => set("platformRefunds", v)}
          disabled={disabled}
        />
      </CollapsibleSection>

      <CollapsibleSection title="Payouts & deposits" summary={`Total ${fmt(totalPayouts(data))}`} defaultOpen={false}>
        <MoneyInput
          label="Bank deposit"
          value={data.bankDeposit}
          onChange={(v) => set("bankDeposit", v)}
          disabled={disabled}
        />
        <MoneyInput
          label="Cash withdrawal"
          value={data.cashWithdrawal}
          onChange={(v) => set("cashWithdrawal", v)}
          disabled={disabled}
        />
        <MoneyInput
          label="Owner withdrawal"
          value={data.ownerWithdrawal}
          onChange={(v) => set("ownerWithdrawal", v)}
          disabled={disabled}
        />
      </CollapsibleSection>

      <ExpenseLines
        expenses={expenses}
        onChange={onExpensesChange}
        disabled={disabled}
        invoicesEditable={invoicesEditable}
      />

      <section
        id="report-section-closing"
        className="report-section-anchor bg-[var(--color-ink)] text-white rounded-2xl p-5 mb-4 shadow-md"
      >
        <h3 className="font-semibold text-lg mb-1">Closing — count the drawer</h3>
        <p className="text-white/60 text-sm mb-4">
          Count physical cash and enter it below. Difference updates as you type.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-white/5 p-3 border border-white/10">
            <p className="text-white/70 text-xs uppercase tracking-wide">Expected cash</p>
            <p className="text-2xl font-bold tabular-nums mt-1">{fmt(closing)}</p>
            <p className="text-white/50 text-[11px] mt-2 leading-snug">
              Cash at start + cash sales ({fmt(data.cashSales)}) − cash refunds ({fmt(data.cashRefunds)})
              − cash expenses ({fmt(cashExpenses)}) − payouts from drawer ({fmt(totalPayouts(data))})
            </p>
          </div>
          <div className="rounded-xl bg-white/5 p-3 border border-white/10">
            <p className="text-white/70 text-xs uppercase tracking-wide">Card / bank (treasury)</p>
            <p className="text-2xl font-bold tabular-nums mt-1">{fmt(cardNetTreasury)}</p>
            <p className="text-white/50 text-[11px] mt-2 leading-snug">
              {treasurySettings ? (
                <>
                  Card sales + delivery to card ({fmt(deliveryToCard)}) − refunds − card expenses (
                  {fmt(cardExpenses)})
                </>
              ) : (
                <>Card sales − refunds − card expenses ({fmt(cardExpenses)})</>
              )}
            </p>
          </div>
          <div className="sm:col-span-2">
            <MoneyInput
              label="Actual cash counted"
              value={data.actualCashCounted}
              onChange={(v) => set("actualCashCounted", v)}
              disabled={disabled}
              variant="dark"
            />
          </div>
        </div>
        <div
          className={`mt-4 p-4 rounded-xl text-center font-semibold text-lg ${
            diff < -0.01
              ? "bg-[var(--color-danger)]/25 text-red-100 ring-1 ring-red-300/30"
              : diff > 0.01
                ? "bg-emerald-500/25 text-emerald-100 ring-1 ring-emerald-300/30"
                : "bg-white/10 ring-1 ring-white/20"
          }`}
        >
          <p className="text-white/70 text-xs font-normal uppercase tracking-wide mb-1">Difference</p>
          {fmt(diff)}
          {diff < -0.01 && <span className="block text-sm font-medium mt-1">Shortage</span>}
          {diff > 0.01 && <span className="block text-sm font-medium mt-1">Overage</span>}
          {Math.abs(diff) <= 0.01 && data.actualCashCounted > 0 && (
            <span className="block text-sm font-medium mt-1 text-emerald-200">Balanced</span>
          )}
        </div>
      </section>

      <label className="block mb-4">
        <span className="field-label">Notes (optional)</span>
        <textarea
          disabled={disabled}
          value={data.notes || ""}
          onChange={(e) => set("notes", e.target.value)}
          rows={2}
          placeholder="Anything unusual today — refunds, safe drop, handover…"
          className="field-input resize-none"
        />
      </label>
    </div>
  );
}
