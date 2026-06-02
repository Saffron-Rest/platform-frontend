import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs } from "../../components/ui/Tabs";
import { PageHeader } from "../../components/ui/PageHeader";
import { AdminTeam } from "./AdminTeam";
import { AdminSalaries } from "./AdminSalaries";
import { AdminPayouts } from "./AdminPayouts";
import { AdminCertifications } from "./AdminCertifications";
import { useAuth } from "../../context/AuthContext";
import { isAdmin } from "../../lib/roles";

type PeopleTab = "team" | "payroll" | "payouts" | "certifications";

export function AdminPeople() {
  const { user, hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const canSeeTeam =
    isAdmin(user?.role) ||
    hasPermission("TEAM_VIEW") ||
    hasPermission("TEAM_MANAGE");

  const canSeePayroll =
    isAdmin(user?.role) ||
    hasPermission("SALARIES_VIEW") ||
    hasPermission("SALARIES_MANAGE") ||
    hasPermission("PAY_RATES_MANAGE");

  const canSeePayouts =
    isAdmin(user?.role) ||
    hasPermission("SALARIES_VIEW") ||
    hasPermission("SALARIES_MANAGE");

  const canSeeCertifications =
    isAdmin(user?.role) ||
    hasPermission("CERTIFICATIONS_VIEW") ||
    hasPermission("CERTIFICATIONS_MANAGE");

  const visibleTabs = useMemo(() => {
    const tabs: Array<{ value: PeopleTab; label: string }> = [];
    if (canSeeTeam) tabs.push({ value: "team", label: "Team" });
    if (canSeePayroll) tabs.push({ value: "payroll", label: "Payroll" });
    if (canSeePayouts) tabs.push({ value: "payouts", label: "Payouts" });
    if (canSeeCertifications) tabs.push({ value: "certifications", label: "Certifications" });
    return tabs;
  }, [canSeeTeam, canSeePayroll, canSeePayouts, canSeeCertifications]);

  const requestedTab = (searchParams.get("tab") as PeopleTab | null) ?? "team";

  const activeTab = useMemo<PeopleTab>(() => {
    const visible = visibleTabs.map((t) => t.value);
    if (visible.includes(requestedTab)) return requestedTab;
    return visible[0] ?? "team";
  }, [requestedTab, visibleTabs]);

  const setTab = (t: PeopleTab) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", t);
        next.delete("add");
        return next;
      },
      { replace: true }
    );
  };

  return (
    <div>
      <PageHeader title="People & Payroll" />
      <Tabs
        items={visibleTabs}
        value={activeTab}
        onChange={setTab}
        ariaLabel="People section"
        className="mb-6"
      />
      {activeTab === "team" && <AdminTeam asTab />}
      {activeTab === "payroll" && <AdminSalaries asTab />}
      {activeTab === "payouts" && <AdminPayouts asTab />}
      {activeTab === "certifications" && <AdminCertifications asTab />}
    </div>
  );
}
