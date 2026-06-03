import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs } from "../../components/ui/Tabs";
import { PageHeader } from "../../components/ui/PageHeader";
import { AdminSettings } from "./AdminSettings";
import { AdminRestaurantHours } from "./AdminRestaurantHours";
import { AdminTagLibrary } from "./AdminTagLibrary";
import { AdminPos } from "./AdminPos";
import { AdminSecurity } from "./AdminSecurity";
import { AdminAudit } from "./AdminAudit";
import { useAuth } from "../../context/AuthContext";
import { isAdmin } from "../../lib/roles";

type SettingsTab = "treasury" | "hours" | "tags" | "pos" | "audit" | "security";

const ALL_TABS = [
  { value: "treasury", label: "Treasury" },
  { value: "hours",    label: "Hours" },
  { value: "tags",     label: "Tags" },
  { value: "pos",      label: "POS & Integrations" },
  { value: "audit",    label: "Audit log" },
  { value: "security", label: "Security" },
] satisfies { value: SettingsTab; label: string }[];

export function AdminSettingsHub() {
  const { user, hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const canSeeTreasury =
    isAdmin(user?.role) ||
    hasPermission("SETTINGS_VIEW") ||
    hasPermission("SETTINGS_MANAGE") ||
    hasPermission("TREASURY_VIEW") ||
    hasPermission("TREASURY_MANAGE");

  const canSeeHours =
    isAdmin(user?.role) ||
    hasPermission("SETTINGS_VIEW") ||
    hasPermission("SETTINGS_MANAGE");

  const canSeeTags =
    isAdmin(user?.role) ||
    hasPermission("TAGS_MANAGE");

  const canSeePos =
    isAdmin(user?.role) ||
    hasPermission("POS_INTEGRATION_VIEW") ||
    hasPermission("POS_INTEGRATION_MANAGE");

  const canSeeSecurity = isAdmin(user?.role);
  const canSeeAudit =
    isAdmin(user?.role) || hasPermission("AUDIT_VIEW");

  const visibleTabs = useMemo(() => {
    const tabs: Array<{ value: SettingsTab; label: string }> = [];
    ALL_TABS.forEach((t) => {
      if (t.value === "treasury"  && canSeeTreasury)  tabs.push(t);
      if (t.value === "hours"     && canSeeHours)      tabs.push(t);
      if (t.value === "tags"      && canSeeTags)       tabs.push(t);
      if (t.value === "pos"       && canSeePos)        tabs.push(t);
      if (t.value === "audit"     && canSeeAudit)      tabs.push(t);
      if (t.value === "security"  && canSeeSecurity)   tabs.push(t);
    });
    return tabs;
  }, [canSeeTreasury, canSeeHours, canSeeTags, canSeePos, canSeeAudit, canSeeSecurity]);

  const requestedTab = (searchParams.get("tab") as SettingsTab | null) ?? "treasury";

  const activeTab = useMemo<SettingsTab>(() => {
    const visible = visibleTabs.map((t) => t.value);
    if (visible.includes(requestedTab)) return requestedTab;
    return visible[0] ?? "treasury";
  }, [requestedTab, visibleTabs]);

  const setTab = (t: SettingsTab) => {
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
      <PageHeader title="Settings" />
      <Tabs
        items={visibleTabs}
        value={activeTab}
        onChange={setTab}
        ariaLabel="Settings section"
        className="mb-6"
      />
      {activeTab === "treasury" && <AdminSettings asTab />}
      {activeTab === "hours"    && <AdminRestaurantHours asTab />}
      {activeTab === "tags"     && <AdminTagLibrary asTab />}
      {activeTab === "pos"      && <AdminPos asTab />}
      {activeTab === "audit"    && <AdminAudit asTab />}
      {activeTab === "security" && <AdminSecurity asTab />}
    </div>
  );
}
