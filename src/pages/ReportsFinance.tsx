import { useSearchParams } from "react-router-dom";
import { Tabs } from "../components/ui/Tabs";
import { PageHeader } from "../components/ui/PageHeader";
import { ShiftReports } from "./ShiftReports";
import { FinanceLedger } from "./FinanceLedger";
import { ProfitLoss } from "./ProfitLoss";
import { Reports } from "./Reports";

type ReportsTab = "shift-reports" | "expenses" | "pl" | "export";

const TABS = [
  { value: "shift-reports" as ReportsTab, label: "Shift reports" },
  { value: "expenses" as ReportsTab, label: "Expenses & Income" },
  { value: "pl" as ReportsTab, label: "Profit & Loss" },
  { value: "export" as ReportsTab, label: "Export" },
];

export function ReportsFinance() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get("tab") as ReportsTab | null) ?? "shift-reports";

  const setTab = (t: ReportsTab) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", t);
        // Drop tab-specific params so the new tab starts clean
        next.delete("add");
        next.delete("view");
        return next;
      },
      { replace: true }
    );
  };

  return (
    <div className="space-y-0">
      <PageHeader title="Reports & Finance" />
      <Tabs
        items={TABS}
        value={tab}
        onChange={setTab}
        ariaLabel="Reports section"
        className="mb-6"
      />
      <div className="pt-6">
        {tab === "shift-reports" && <ShiftReports asTab />}
        {tab === "expenses" && <FinanceLedger asTab />}
        {tab === "pl" && <ProfitLoss asTab />}
        {tab === "export" && <Reports asTab />}
      </div>
    </div>
  );
}
