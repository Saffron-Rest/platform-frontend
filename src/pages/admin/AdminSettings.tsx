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
  const [msg, setMsg] = useState<{ text: string; kind: "success" | "error" | "warning" | "info" } | null>(null);
  const [alertBusy, setAlertBusy] = useState<null | "missing" | "telegram" | "delivery" | "platforms">(null);

  const ok = (text: string) => setMsg({ text, kind: "success" });
  const warn = (text: string) => setMsg({ text, kind: "warning" });
  const err = (e: unknown, fallback: string) => {
    const text = e instanceof Error ? e.message : fallback;
    console.error("[AdminSettings]", fallback, e);
    setMsg({ text, kind: "error" });
  };

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
    setAlertBusy("missing");
    setMsg(null);
    try {
      const res = await api<{ missing: string[]; created: number }>("/alerts/check-missing", {
        method: "POST",
      });
      const names = res.missing ?? [];
      if (names.length) {
        warn(`Missing reports: ${names.join(", ")}. Telegram notified if configured.`);
      } else {
        ok("All scheduled cashiers have submitted today.");
      }
      refreshAlerts();
    } catch (e) {
      err(e, "Check failed");
    } finally {
      setAlertBusy(null);
    }
  };

  const checkUnsettledDelivery = async () => {
    setAlertBusy("delivery");
    setMsg(null);
    try {
      const res = await api<{
        platforms: { label: string; projected: number; dayCount: number }[];
        thresholdDays: number;
        totalProjected?: number;
      }>("/alerts/check-unsettled-delivery", { method: "POST" });
      const list = res.platforms ?? [];
      if (!list.length) {
        ok(`No delivery older than ${res.thresholdDays} day(s) is unsettled.`);
      } else {
        const breakdown = list
          .map((p) => `${p.label} ${p.projected.toFixed(2)} PLN (${p.dayCount}d)`)
          .join(" · ");
        warn(`Unsettled delivery > ${res.thresholdDays}d: ${breakdown}. Telegram notified if configured.`);
      }
      refreshAlerts();
    } catch (e) {
      err(e, "Check failed");
    } finally {
      setAlertBusy(null);
    }
  };

  const testTelegram = async () => {
    setAlertBusy("telegram");
    setMsg(null);
    try {
      const res = await api<{ ok: boolean; configured: boolean }>("/alerts/telegram-test", {
        method: "POST",
      });
      if (res.ok) {
        ok("Test message sent to Telegram — check the chat.");
      } else if (!res.configured) {
        warn(
          "Telegram is not configured on the server. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID, then redeploy."
        );
      } else {
        err(new Error("Telegram is configured but sending failed. Check backend logs."), "Telegram test failed");
      }
    } catch (e) {
      err(e, "Telegram test failed");
    } finally {
      setAlertBusy(null);
    }
  };

  const savePlatforms = async () => {
    setAlertBusy("platforms");
    setMsg(null);
    try {
      await api("/settings/platforms", { method: "PUT", body: JSON.stringify(platforms) });
      ok("Platforms saved.");
    } catch (e) {
      err(e, "Save failed");
    } finally {
      setAlertBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Treasury, platforms, alerts, and audit log" />
      {msg && <Alert variant={msg.kind}>{msg.text}</Alert>}

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
            <Button
              variant="secondary"
              className="!py-2 !px-3 text-sm"
              disabled={!!alertBusy}
              onClick={testTelegram}
            >
              {alertBusy === "telegram" ? "Sending…" : "Test Telegram"}
            </Button>
            <Button
              className="!py-2 !px-3 text-sm"
              disabled={!!alertBusy}
              onClick={checkMissing}
            >
              {alertBusy === "missing" ? "Checking…" : "Check missing"}
            </Button>
            <Button
              variant="secondary"
              className="!py-2 !px-3 text-sm"
              disabled={!!alertBusy}
              onClick={checkUnsettledDelivery}
            >
              {alertBusy === "delivery" ? "Scanning…" : "Scan unsettled delivery"}
            </Button>
          </div>
        </div>
        {telegram && !telegram.configured && (
          <Alert variant="warning">
            Telegram is not configured on the server. "Test Telegram" will report
            "not configured" until <code>TELEGRAM_BOT_TOKEN</code> and{" "}
            <code>TELEGRAM_CHAT_ID</code> are set and the backend is redeployed.
          </Alert>
        )}
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
