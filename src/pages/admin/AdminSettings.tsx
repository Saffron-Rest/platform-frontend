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

type TelegramStatus = {
  enabled: boolean;
  configured: boolean;
  chatIdSet: boolean;
  unreadAlerts: number;
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
  const [telegram, setTelegram] = useState<TelegramStatus | null>(null);
  const [logs, setLogs] = useState<AuditLogLike[]>([]);
  const [msg, setMsg] = useState("");
  const [alertBusy, setAlertBusy] = useState(false);

  useEffect(() => {
    api<{ platforms: Platforms }>("/settings").then((s) => setPlatforms(s.platforms));
    api<AlertRow[]>("/alerts").then(setAlerts);
    api<TelegramStatus>("/alerts/telegram-status").then(setTelegram).catch(() => setTelegram(null));
    api<AuditLogLike[]>("/audit/recent?limit=8").then(setLogs);
  }, []);

  const refreshAlerts = () => {
    api<AlertRow[]>("/alerts").then(setAlerts);
    api<TelegramStatus>("/alerts/telegram-status").then(setTelegram).catch(() => setTelegram(null));
  };

  const checkMissing = async () => {
    setAlertBusy(true);
    setMsg("");
    try {
      const res = await api<{ missing: string[]; created: number }>("/alerts/check-missing", {
        method: "POST",
      });
      const names = res.missing ?? [];
      setMsg(
        names.length
          ? `Missing reports: ${names.join(", ")}. Telegram notified if configured.`
          : "All scheduled cashiers have submitted today."
      );
      refreshAlerts();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Check failed");
    } finally {
      setAlertBusy(false);
    }
  };

  const testTelegram = async () => {
    setAlertBusy(true);
    try {
      const res = await api<{ ok: boolean; configured: boolean }>("/alerts/telegram-test", {
        method: "POST",
      });
      setMsg(res.ok ? "Test message sent to Telegram." : "Telegram is not configured on the server.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Telegram test failed");
    } finally {
      setAlertBusy(false);
    }
  };

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
        <div className="flex flex-wrap justify-between items-start gap-3">
          <div>
            <h3 className="font-semibold">Alerts & Telegram</h3>
            <p className="text-xs text-[var(--color-muted)] mt-1">
              {telegram?.configured
                ? `Telegram connected · ${telegram.unreadAlerts} unread in app`
                : "Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID on the server, then redeploy."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" className="!py-2 !px-3 text-sm" disabled={alertBusy} onClick={testTelegram}>
              Test Telegram
            </Button>
            <Button className="!py-2 !px-3 text-sm" disabled={alertBusy} onClick={checkMissing}>
              {alertBusy ? "Checking…" : "Check missing"}
            </Button>
          </div>
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
