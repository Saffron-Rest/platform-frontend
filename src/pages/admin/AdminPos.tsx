import { useEffect, useState } from "react";
import {
  configureDotykacka,
  createPosIntegration,
  deletePosIntegration,
  listPosIntegrations,
  registerDotyposWebhook,
  rotatePosSecret,
  setPosIntegrationActive,
  syncDotykacka,
  unregisterDotyposWebhook,
  type PosIntegration,
} from "../../api/menu";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { Spinner } from "../../components/ui/Spinner";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";

type Vendor = "generic" | "dotykacka";

export function AdminPos() {
  const [integrations, setIntegrations] = useState<PosIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [vendor, setVendor] = useState<Vendor>("dotykacka");
  const [creating, setCreating] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<{
    integrationId: string;
    secret: string;
  } | null>(null);
  /** Per-integration in-flight state — keyed by id. */
  const [busy, setBusy] = useState<Record<string, string | null>>({});
  /** Per-integration Dotykačka form state. */
  const [dotyForm, setDotyForm] = useState<
    Record<
      string,
      {
        cloudId: string;
        clientId: string;
        clientSecret: string;
        refreshToken: string;
        expanded: boolean;
      }
    >
  >({});

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setIntegrations(await listPosIntegrations());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load integrations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async () => {
    if (!name.trim()) {
      setError("Integration name is required");
      return;
    }
    setCreating(true);
    setError("");
    setMessage("");
    try {
      const created = await createPosIntegration(name.trim(), vendor);
      setMessage(`Integration "${created.name}" created`);
      if (vendor === "generic" && created.webhookSecret) {
        setRevealedSecret({ integrationId: created.id, secret: created.webhookSecret });
      }
      setName("");
      await load();
      if (vendor === "dotykacka") {
        setDotyForm((f) => ({
          ...f,
          [created.id]: {
            cloudId: "",
            clientId: "",
            clientSecret: "",
            refreshToken: "",
            expanded: true,
          },
        }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create integration");
    } finally {
      setCreating(false);
    }
  };

  const setRowBusy = (id: string, label: string | null) =>
    setBusy((b) => ({ ...b, [id]: label }));

  const rotate = async (i: PosIntegration) => {
    if (
      !confirm(
        `Rotate the webhook secret for "${i.name}"? The current secret will stop working immediately.`
      )
    )
      return;
    setRowBusy(i.id, "rotating");
    try {
      const updated = await rotatePosSecret(i.id);
      if (updated.webhookSecret) {
        setRevealedSecret({ integrationId: updated.id, secret: updated.webhookSecret });
      }
      setMessage(`Rotated secret for "${i.name}"`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rotation failed");
    } finally {
      setRowBusy(i.id, null);
    }
  };

  const toggleActive = async (i: PosIntegration) => {
    setRowBusy(i.id, i.active ? "deactivating" : "activating");
    try {
      await setPosIntegrationActive(i.id, !i.active);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update");
    } finally {
      setRowBusy(i.id, null);
    }
  };

  const remove = async (i: PosIntegration) => {
    if (
      !confirm(
        `Delete integration "${i.name}"? This won't remove sales already received.`
      )
    )
      return;
    setRowBusy(i.id, "deleting");
    try {
      await deletePosIntegration(i.id);
      setMessage(`Deleted "${i.name}"`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setRowBusy(i.id, null);
    }
  };

  const saveDotykacka = async (i: PosIntegration) => {
    const f = dotyForm[i.id];
    if (!f) return;
    if (!f.cloudId.trim() || !f.refreshToken.trim()) {
      setError("Cloud ID and refresh token are required");
      return;
    }
    setRowBusy(i.id, "saving");
    setError("");
    setMessage("");
    try {
      await configureDotykacka(i.id, {
        cloudId: f.cloudId.trim(),
        clientId: f.clientId.trim() || undefined,
        clientSecret: f.clientSecret.trim() || undefined,
        refreshToken: f.refreshToken.trim(),
      });
      setMessage(`Dotykačka credentials saved for "${i.name}"`);
      setDotyForm((all) => ({
        ...all,
        [i.id]: { ...f, clientSecret: "", refreshToken: "", expanded: false },
      }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setRowBusy(i.id, null);
    }
  };

  const enableWebhook = async (i: PosIntegration) => {
    let baseUrl: string | undefined = undefined;
    // If the app is running locally, Dotypos won't be able to reach localhost
    // — prompt for a public URL (e.g. an ngrok or production origin).
    if (
      /^https?:\/\/(localhost|127\.|0\.|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(
        window.location.origin,
      )
    ) {
      const entered = window.prompt(
        "Dotypos needs a publicly reachable URL to push receipts to.\nEnter the public origin of this backend (e.g. https://api.yourdomain.com)",
        "",
      );
      if (!entered) return;
      baseUrl = entered.trim();
    }
    setRowBusy(i.id, "registering");
    setError("");
    setMessage("");
    try {
      await registerDotyposWebhook(i.id, baseUrl);
      setMessage(
        `Real-time webhook enabled for "${i.name}". Receipts will arrive within seconds.`,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not enable webhook");
    } finally {
      setRowBusy(i.id, null);
    }
  };

  const disableWebhook = async (i: PosIntegration) => {
    if (
      !confirm(
        `Disable real-time webhook for "${i.name}"? Polling will continue every 5 minutes.`,
      )
    )
      return;
    setRowBusy(i.id, "unregistering");
    setError("");
    setMessage("");
    try {
      await unregisterDotyposWebhook(i.id);
      setMessage(`Webhook removed from "${i.name}"`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not disable webhook");
    } finally {
      setRowBusy(i.id, null);
    }
  };

  const runSync = async (i: PosIntegration) => {
    setRowBusy(i.id, "syncing");
    setError("");
    setMessage("");
    try {
      const r = await syncDotykacka(i.id);
      setMessage(
        `${i.name}: ${r.inserted} new line${r.inserted === 1 ? "" : "s"}, ${r.skipped} skipped, ${r.unmatched} unmatched`
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setRowBusy(i.id, null);
    }
  };

  const toggleDotyForm = (i: PosIntegration) => {
    setDotyForm((f) => {
      const current = f[i.id] ?? {
        cloudId: i.dotykacka?.cloudId ?? "",
        clientId: "",
        clientSecret: "",
        refreshToken: "",
        expanded: false,
      };
      return { ...f, [i.id]: { ...current, expanded: !current.expanded } };
    });
  };

  const updateDotyForm = (
    id: string,
    field: keyof (typeof dotyForm)[string],
    value: string,
  ) => {
    setDotyForm((f) => {
      const current = f[id] ?? {
        cloudId: "",
        clientId: "",
        clientSecret: "",
        refreshToken: "",
        expanded: true,
      };
      return { ...f, [id]: { ...current, [field]: value } };
    });
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage("Copied to clipboard");
    } catch {
      /* clipboard unavailable */
    }
  };

  const baseUrl = window.location.origin;

  return (
    <div className="space-y-6">
      <PageHeader
        title="POS integrations"
        subtitle="Connect your POS so menu analytics and engineering use real receipt data."
      />

      {error && <Alert variant="error">{error}</Alert>}
      {message && <Alert variant="success">{message}</Alert>}

      <Card>
        <h3 className="font-semibold mb-3">New integration</h3>
        <div className="grid gap-3 md:grid-cols-[2fr_1.5fr_auto] items-end">
          <label className="field-label">
            Name
            <input
              className="field-input"
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Front-of-house POS"
            />
          </label>
          <label className="field-label">
            Vendor
            <select
              className="field-input"
              value={vendor}
              onChange={(e) => setVendor(e.target.value as Vendor)}
            >
              <option value="dotykacka">Dotykačka (auto-pull)</option>
              <option value="generic">Generic (HMAC webhook)</option>
            </select>
          </label>
          <div>
            <Button onClick={() => void create()} disabled={creating}>
              {creating ? "Creating…" : "Create"}
            </Button>
          </div>
        </div>
        <p className="text-xs text-[var(--color-muted)] mt-3">
          {vendor === "dotykacka"
            ? "After creating, paste your Dotykačka cloud ID and refresh token below. Receipts will sync every 5 minutes."
            : "Generates a webhook URL and HMAC secret you paste into a custom POS or middleware."}
        </p>
      </Card>

      {revealedSecret && (
        <Card className="border border-amber-300 bg-amber-50">
          <h4 className="font-semibold text-amber-900">Copy this secret now</h4>
          <p className="text-sm text-amber-900/80 mt-1">
            It will not be shown again. Paste it into your POS webhook configuration.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 px-3 py-2 rounded-lg bg-white border border-amber-200 font-mono text-sm break-all">
              {revealedSecret.secret}
            </code>
            <Button variant="secondary" onClick={() => void copy(revealedSecret.secret)}>
              Copy
            </Button>
            <Button variant="ghost" onClick={() => setRevealedSecret(null)}>
              Hide
            </Button>
          </div>
        </Card>
      )}

      <Card>
        <h3 className="font-semibold mb-2">How to connect Dotykačka</h3>
        <ol className="list-decimal pl-5 text-sm space-y-1 text-[var(--color-muted)]">
          <li>
            Request API credentials from Dotykačka (the "Client ID / Client Secret" form
            on their API page). Mention <em>"reading receipts for an external analytics
            tool"</em>.
          </li>
          <li>
            Open in a browser, replacing the placeholders:{" "}
            <code className="font-mono text-xs break-all">
              https://admin.dotykacka.cz/client/connect?client_id=&#123;CLIENT_ID&#125;&client_secret=&#123;CLIENT_SECRET&#125;&scope=*&redirect_uri=https://dotykacka.cz
            </code>
          </li>
          <li>
            Log in, allow access. You'll be redirected to a URL like{" "}
            <code className="font-mono text-xs">…?token=…&cloudid=…</code> — copy both
            the <strong>token</strong> (refresh token) and the <strong>cloudid</strong>.
          </li>
          <li>
            Paste them below and click <strong>Save credentials</strong>. Sync runs
            automatically every 5 minutes, or click <strong>Sync now</strong> to backfill.
          </li>
          <li>
            After credentials are saved, click <strong>Enable webhook</strong> to register a real-time push from Dotypos.
            Receipts will then arrive within seconds instead of waiting for the next poll.
          </li>
        </ol>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner label="Loading integrations…" />
        </div>
      ) : integrations.length === 0 ? (
        <EmptyState
          title="No integrations yet"
          description="Add one above. Dotykačka pulls receipts on a schedule; generic vendors push via webhook."
        />
      ) : (
        <div className="space-y-4">
          {integrations.map((i) => (
            <IntegrationCard
              key={i.id}
              integration={i}
              baseUrl={baseUrl}
              busy={busy[i.id] ?? null}
              dotyForm={
                dotyForm[i.id] ?? {
                  cloudId: i.dotykacka?.cloudId ?? "",
                  clientId: "",
                  clientSecret: "",
                  refreshToken: "",
                  expanded: false,
                }
              }
              onToggleForm={() => toggleDotyForm(i)}
              onChangeField={(field, value) => updateDotyForm(i.id, field, value)}
              onSaveDotykacka={() => void saveDotykacka(i)}
              onSync={() => void runSync(i)}
              onEnableWebhook={() => void enableWebhook(i)}
              onDisableWebhook={() => void disableWebhook(i)}
              onRotate={() => void rotate(i)}
              onToggleActive={() => void toggleActive(i)}
              onDelete={() => void remove(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function IntegrationCard({
  integration: i,
  baseUrl,
  busy,
  dotyForm,
  onToggleForm,
  onChangeField,
  onSaveDotykacka,
  onSync,
  onEnableWebhook,
  onDisableWebhook,
  onRotate,
  onToggleActive,
  onDelete,
}: {
  integration: PosIntegration;
  baseUrl: string;
  busy: string | null;
  dotyForm: {
    cloudId: string;
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    expanded: boolean;
  };
  onToggleForm: () => void;
  onChangeField: (
    field: "cloudId" | "clientId" | "clientSecret" | "refreshToken" | "expanded",
    value: string,
  ) => void;
  onSaveDotykacka: () => void;
  onSync: () => void;
  onEnableWebhook: () => void;
  onDisableWebhook: () => void;
  onRotate: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  const isDotykacka = (i.vendor ?? "").toLowerCase() === "dotykacka";
  const credentialsReady =
    isDotykacka &&
    !!i.dotykacka?.cloudId &&
    !!i.dotykacka?.hasRefreshToken;
  const webhookOn = !!i.dotykacka?.webhookRegistered;

  return (
    <Card>
      <div className="flex flex-wrap items-start gap-4 justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{i.name}</h3>
            <span
              className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                i.active
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-gray-200 text-gray-600"
              }`}
            >
              {i.active ? "Active" : "Inactive"}
            </span>
            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-black/5 text-[var(--color-muted)]">
              {isDotykacka ? "Dotykačka" : i.vendor ?? "Generic"}
            </span>
          </div>
          <p className="text-xs text-[var(--color-muted)] mt-1">
            {isDotykacka
              ? credentialsReady
                ? `Last synced ${i.lastSyncedAt ? new Date(i.lastSyncedAt).toLocaleString() : "never"}`
                : "Credentials not configured"
              : `Last received ${i.lastSeenAt ? new Date(i.lastSeenAt).toLocaleString() : "never"}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isDotykacka ? (
            <>
              <Button
                variant="secondary"
                onClick={onSync}
                disabled={!credentialsReady || busy !== null}
              >
                {busy === "syncing" ? "Syncing…" : "Sync now"}
              </Button>
              <Button variant="ghost" onClick={onToggleForm}>
                {dotyForm.expanded ? "Hide credentials" : credentialsReady ? "Update credentials" : "Add credentials"}
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={onRotate} disabled={busy !== null}>
              {busy === "rotating" ? "Rotating…" : "Rotate secret"}
            </Button>
          )}
          <Button variant="ghost" onClick={onToggleActive} disabled={busy !== null}>
            {i.active ? "Deactivate" : "Activate"}
          </Button>
          <Button variant="ghost" onClick={onDelete} disabled={busy !== null}>
            Delete
          </Button>
        </div>
      </div>

      {!isDotykacka && (
        <div className="mt-3 text-sm">
          <p className="text-[var(--color-muted)]">Webhook URL</p>
          <code className="block mt-1 px-3 py-2 rounded-lg bg-black/5 font-mono text-xs break-all">
            {baseUrl}/api/pos/webhook/{i.id}
          </code>
        </div>
      )}

      {isDotykacka && credentialsReady && (
        <div className="mt-4 border-t border-black/5 pt-4">
          <div className="flex flex-wrap items-start gap-3 justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-sm">Real-time webhook</h4>
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                    webhookOn
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {webhookOn ? "Active" : "Not registered"}
                </span>
              </div>
              <p className="text-xs text-[var(--color-muted)] mt-1 max-w-xl">
                {webhookOn
                  ? "Dotypos pushes new receipts to us within seconds. The 5-minute poll still runs as a safety net."
                  : "Without a webhook, receipts arrive only via the 5-minute background poll. Enable for near-real-time analytics."}
              </p>
            </div>
            <div className="flex gap-2">
              {webhookOn ? (
                <Button
                  variant="ghost"
                  onClick={onDisableWebhook}
                  disabled={busy !== null}
                >
                  {busy === "unregistering" ? "Removing…" : "Disable webhook"}
                </Button>
              ) : (
                <Button
                  onClick={onEnableWebhook}
                  disabled={busy !== null}
                >
                  {busy === "registering" ? "Enabling…" : "Enable webhook"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {isDotykacka && dotyForm.expanded && (
        <div className="mt-4 grid gap-3 md:grid-cols-2 border-t border-black/5 pt-4">
          <label className="field-label">
            Cloud ID
            <input
              className="field-input"
              value={dotyForm.cloudId}
              onChange={(e) => onChangeField("cloudId", e.target.value)}
              placeholder="e.g. 124567"
            />
          </label>
          <label className="field-label">
            Refresh token
            <input
              className="field-input font-mono text-xs"
              value={dotyForm.refreshToken}
              onChange={(e) => onChangeField("refreshToken", e.target.value)}
              placeholder={i.dotykacka?.hasRefreshToken ? "(stored — paste to replace)" : "Paste long token"}
            />
          </label>
          <label className="field-label">
            Client ID (optional, only needed to re-obtain refresh token)
            <input
              className="field-input"
              value={dotyForm.clientId}
              onChange={(e) => onChangeField("clientId", e.target.value)}
              placeholder={i.dotykacka?.hasClientId ? "(stored)" : ""}
            />
          </label>
          <label className="field-label">
            Client secret (optional)
            <input
              className="field-input font-mono text-xs"
              type="password"
              value={dotyForm.clientSecret}
              onChange={(e) => onChangeField("clientSecret", e.target.value)}
              placeholder={i.dotykacka?.hasClientSecret ? "(stored — paste to replace)" : ""}
            />
          </label>
          <div className="md:col-span-2 flex justify-end gap-2">
            <Button onClick={onSaveDotykacka} disabled={busy !== null}>
              {busy === "saving" ? "Saving…" : "Save credentials"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
