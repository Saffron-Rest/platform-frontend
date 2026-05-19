import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { AuditRecentList } from "../../components/audit/AuditRecentList";
import { TreasurySettingsCard } from "../../components/admin/TreasurySettingsCard";
import type { AuditLogLike } from "../../lib/auditDisplay";
import type { Platforms } from "../../types";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";

type AlertRow = {
  id: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
};

export function AdminSettings() {
  const navigate = useNavigate();
  const [platforms, setPlatforms] = useState<Platforms>({
    wolt: true,
    bolt: true,
    uberEats: true,
    glovo: true,
    other: true,
  });
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [logs, setLogs] = useState<AuditLogLike[]>([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api<{ platforms: Platforms }>("/settings").then((s) => setPlatforms(s.platforms));
    api<AlertRow[]>("/alerts").then(setAlerts);
    api<AuditLogLike[]>("/audit/recent?limit=8").then(setLogs);
  }, []);

  const savePlatforms = async () => {
    await api("/settings/platforms", { method: "PUT", body: JSON.stringify(platforms) });
    setMsg("Platforms saved");
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Treasury, platforms, alerts, and audit log" />
      {msg && <Alert variant="success">{msg}</Alert>}

      <TreasurySettingsCard />

      <Card className="space-y-3">
        <h3 className="font-semibold">Delivery platforms</h3>
        {(Object.keys(platforms) as (keyof Platforms)[]).map((key) => (
          <label key={key} className="flex items-center gap-3 py-1">
            <input
              type="checkbox"
              checked={platforms[key]}
              onChange={(e) => setPlatforms({ ...platforms, [key]: e.target.checked })}
              className="w-5 h-5"
            />
            <span className="capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
          </label>
        ))}
        <Button onClick={savePlatforms}>Save platforms</Button>
      </Card>

      <Card className="space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold">Alerts</h3>
          <button
            type="button"
            onClick={() => api("/alerts/check-missing", { method: "POST" }).then(() =>
              api<AlertRow[]>("/alerts").then(setAlerts)
            )}
            className="text-sm text-[var(--color-saffron)] font-medium"
          >
            Check missing reports
          </button>
        </div>
        <ul className="space-y-2 max-h-48 overflow-y-auto">
          {alerts.map((a) => (
            <li
              key={a.id}
              className={`p-3 rounded-xl text-sm border ${
                a.read ? "opacity-60" : "bg-amber-50 border-amber-200"
              }`}
            >
              <p className="font-medium">{a.message}</p>
              <p className="text-xs text-[var(--color-muted)] mt-1">
                {new Date(a.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h3 className="font-semibold mb-1">Recent activity</h3>
        <p className="text-xs text-[var(--color-muted)] mb-4">Latest sign-ins, edits, and exports</p>
        <AuditRecentList logs={logs} onSelect={(id) => navigate("/audit", { state: { selectedId: id } })} />
      </Card>
    </div>
  );
}
