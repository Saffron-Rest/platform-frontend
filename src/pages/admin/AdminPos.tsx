import { useEffect, useState } from "react";
import {
  configureDotykacka,
  createPosIntegration,
  deletePosIntegration,
  getPosActivity,
  listPosIntegrations,
  registerDotyposWebhook,
  rotatePosSecret,
  sendTestReceipt,
  setPosIntegrationActive,
  syncDotykacka,
  unregisterDotyposWebhook,
  type PosActivity,
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
  const [vendor, setVendor] = useState<Vendor>("generic");
  const [creating, setCreating] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<{
    integrationId: string;
    secret: string;
  } | null>(null);
  /** Per-integration in-flight state — keyed by id. */
  const [busy, setBusy] = useState<Record<string, string | null>>({});
  /** Per-integration activity snapshot, refreshed every 10s while the card is open. */
  const [activity, setActivity] = useState<Record<string, PosActivity | null>>({});
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

  // Poll the activity snapshot for every integration every 10s. Lets the
  // admin see "Last received" tick over when Dotypos pushes a new receipt
  // without having to refresh the page.
  useEffect(() => {
    if (integrations.length === 0) return;
    let cancelled = false;
    const tick = async () => {
      const next: Record<string, PosActivity | null> = {};
      await Promise.all(
        integrations.map(async (i) => {
          try {
            next[i.id] = await getPosActivity(i.id);
          } catch {
            next[i.id] = null;
          }
        }),
      );
      if (!cancelled) setActivity(next);
    };
    void tick();
    const handle = window.setInterval(() => void tick(), 10000);
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, [integrations]);

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
    const isDoty = (i.vendor ?? "").toLowerCase() === "dotykacka";
    const wasWebhookOn = !!i.dotykacka?.webhookRegistered;
    const warning = isDoty && wasWebhookOn
      ? `Rotate the webhook token for "${i.name}"? The currently registered Dotypos webhook will be re-registered automatically with the new token.`
      : `Rotate the webhook secret for "${i.name}"? The current secret will stop working immediately.`;
    if (!confirm(warning)) return;
    setRowBusy(i.id, "rotating");
    try {
      const updated = await rotatePosSecret(i.id);
      if (updated.webhookSecret) {
        setRevealedSecret({ integrationId: updated.id, secret: updated.webhookSecret });
      }
      // If Dotypos was pushing via webhook before the rotate, re-register
      // immediately so the new token is what Dotypos sends. The endpoint is
      // idempotent — it deletes the stale registration first.
      if (isDoty && wasWebhookOn) {
        try {
          await registerDotyposWebhook(updated.id);
        } catch (e) {
          setError(
            (e instanceof Error ? e.message : "Re-register failed") +
              " — token rotated but webhook is now stale; click Enable webhook to fix.",
          );
        }
      }
      setMessage(`Rotated ${isDoty ? "token" : "secret"} for "${i.name}"`);
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

  const sendTest = async (i: PosIntegration) => {
    setRowBusy(i.id, "testing");
    setError("");
    setMessage("");
    try {
      const r = await sendTestReceipt(i.id);
      if (r.ok) {
        setMessage(
          `Test receipt processed for "${i.name}" — ${r.inserted ?? 0} inserted${
            r.unmatched ? `, ${r.unmatched} unmatched (expected, it isn't on the menu)` : ""
          }. The activity panel should refresh in a few seconds.`,
        );
      } else {
        setError(`Test failed: ${r.error ?? "unknown error"}`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test failed");
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
              <option value="generic">Generic (Dotypos webhook & most POS)</option>
              <option value="dotykacka">Dotykačka (auto-pull via API)</option>
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
            ? "Pulls receipts via Dotykačka's API. Requires their cloud ID + refresh token (one-time OAuth). Best for fully hands-off setup."
            : "Generates a ready-to-paste webhook URL with the token already embedded. Paste it into Dotypos Cloud (or any POS) and receipts start flowing — no headers, no signatures."}
        </p>
      </Card>

      {revealedSecret && (() => {
        const integration = integrations.find((x) => x.id === revealedSecret.integrationId);
        const fullUrl = integration
          ? `${baseUrl}${integration.pushUrl.split("?token=")[0]}?token=${revealedSecret.secret}`
          : null;
        return (
          <Card className="border border-amber-300 bg-amber-50">
            <h4 className="font-semibold text-amber-900">
              {fullUrl ? "Copy this webhook URL now" : "Copy this secret now"}
            </h4>
            <p className="text-sm text-amber-900/80 mt-1">
              {fullUrl
                ? "Paste it into Dotypos Cloud → Cloud settings → Webhook (entity: Realized sales, method: POST)."
                : "It will not be shown again. Paste it into your POS webhook configuration."}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <code className="flex-1 px-3 py-2 rounded-lg bg-white border border-amber-200 font-mono text-sm break-all">
                {fullUrl ?? revealedSecret.secret}
              </code>
              <Button
                variant="secondary"
                onClick={() => void copy(fullUrl ?? revealedSecret.secret)}
              >
                Copy
              </Button>
              <Button variant="ghost" onClick={() => setRevealedSecret(null)}>
                Hide
              </Button>
            </div>
            {fullUrl && (
              <p className="text-xs text-amber-900/70 mt-2">
                Raw token (for advanced HMAC mode):{" "}
                <code className="font-mono break-all">{revealedSecret.secret}</code>
              </p>
            )}
          </Card>
        );
      })()}

      <Card>
        <h3 className="font-semibold mb-2">Easy setup — Dotypos Cloud webhook</h3>
        <ol className="list-decimal pl-5 text-sm space-y-1 text-[var(--color-muted)]">
          <li>
            Create a <strong>Generic</strong> integration above (e.g. name: "Dotypos").
            We auto-generate the token for you.
          </li>
          <li>
            Copy the <strong>Webhook URL</strong> shown on the new card (the token is already in it — nothing else to add).
          </li>
          <li>
            Open{" "}
            <a
              href="https://manual.dotykacka.pl/webhook.html"
              target="_blank"
              rel="noreferrer"
              className="text-[var(--color-primary)] hover:underline"
            >
              Dotypos Cloud → Cloud settings → Webhook
            </a>
            , click <em>Add webhook</em>.
          </li>
          <li>
            Set entity <strong>Realized sales</strong>, method <strong>POST</strong>, paste the URL, save.
          </li>
          <li>Ring up a test order — within seconds it shows up on Menu analytics.</li>
        </ol>
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-semibold">
            Alternative: Dotykačka API (hands-off, auto-registers webhook for you)
          </summary>
          <ol className="list-decimal pl-5 mt-2 space-y-1 text-[var(--color-muted)]">
            <li>Request API credentials (Client ID / Secret) from Dotykačka.</li>
            <li>
              Visit{" "}
              <code className="font-mono text-xs break-all">
                https://admin.dotykacka.cz/client/connect?client_id=&#123;CLIENT_ID&#125;&client_secret=&#123;CLIENT_SECRET&#125;&scope=*&redirect_uri=https://dotykacka.cz
              </code>
              , approve, and copy <strong>token</strong> + <strong>cloudid</strong> from the redirect URL.
            </li>
            <li>Create a <strong>Dotykačka</strong> integration above, paste credentials, save.</li>
            <li>
              Click <strong>Enable webhook</strong> — we register the webhook with Dotypos automatically.
            </li>
          </ol>
        </details>
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
              onSendTest={() => void sendTest(i)}
              onEnableWebhook={() => void enableWebhook(i)}
              onDisableWebhook={() => void disableWebhook(i)}
              onRotate={() => void rotate(i)}
              onToggleActive={() => void toggleActive(i)}
              onDelete={() => void remove(i)}
              onCopy={(text) => void copy(text)}
              activity={activity[i.id] ?? null}
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
  onSendTest,
  onEnableWebhook,
  onDisableWebhook,
  onRotate,
  onToggleActive,
  onDelete,
  onCopy,
  activity,
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
  onSendTest: () => void;
  onEnableWebhook: () => void;
  onDisableWebhook: () => void;
  onRotate: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
  onCopy: (text: string) => void;
  activity: PosActivity | null;
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
          <Button
            variant="secondary"
            onClick={onSendTest}
            disabled={busy !== null}
            title="Inject a fake receipt to confirm ingestion + analytics work end-to-end"
          >
            {busy === "testing" ? "Sending…" : "Send test receipt"}
          </Button>
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
              <Button variant="ghost" onClick={onRotate} disabled={busy !== null}>
                {busy === "rotating" ? "Rotating…" : "Rotate token"}
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

      <ActivityPanel activity={activity} />

      {!isDotykacka && (
        <div className="mt-3 space-y-3 text-sm">
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold">Webhook URL (paste into your POS)</p>
              <button
                type="button"
                className="text-xs text-[var(--color-primary)] hover:underline"
                onClick={() => onCopy(`${baseUrl}${i.pushUrl}`)}
              >
                Copy
              </button>
            </div>
            <code className="block mt-1 px-3 py-2 rounded-lg bg-black/5 font-mono text-xs break-all">
              {baseUrl}{i.pushUrl}
            </code>
            <p className="text-xs text-[var(--color-muted)] mt-1">
              The token is already embedded — no headers required. In{" "}
              <a
                href="https://manual.dotykacka.pl/webhook.html"
                target="_blank"
                rel="noreferrer"
                className="text-[var(--color-primary)] hover:underline"
              >
                Dotypos Cloud → Webhook
              </a>{" "}
              choose entity <strong>Realized sales</strong> and method{" "}
              <strong>POST</strong>.
            </p>
          </div>
          <details className="text-xs text-[var(--color-muted)]">
            <summary className="cursor-pointer hover:text-[var(--color-text)]">
              Advanced: HMAC URL for custom POS systems
            </summary>
            <code className="block mt-2 px-3 py-2 rounded-lg bg-black/5 font-mono break-all">
              {baseUrl}/api/pos/webhook/{i.id}
            </code>
            <p className="mt-1">
              Requires an <code>X-Pos-Signature</code> header (HMAC-SHA256 of the body
              using your rotated secret). Use this only if your POS signs requests.
            </p>
          </details>
        </div>
      )}

      {isDotykacka && credentialsReady && (
        <div className="mt-4 border-t border-black/5 pt-4 space-y-4">
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
                  {webhookOn ? "Active (auto-registered)" : "Not registered"}
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

          <details className="text-xs">
            <summary className="cursor-pointer text-[var(--color-muted)] hover:text-[var(--color-text)]">
              Prefer to register the webhook manually in Dotypos Cloud?
            </summary>
            <div className="mt-2 space-y-2 text-[var(--color-muted)]">
              <p>
                Open <strong>Dotypos Cloud → Cloud settings → Webhook</strong>, click
                <em> Add webhook</em>, choose entity <strong>Realized sales</strong>{" "}
                (<code>ORDERBEAN</code>), method <strong>POST</strong>, and paste the URL
                below.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 rounded-lg bg-black/5 font-mono break-all">
                  {baseUrl}/api/pos/dotypos-webhook/{i.id}?token=&lt;secret&gt;
                </code>
              </div>
              <p>
                Replace <code>&lt;secret&gt;</code> with the per-integration token. To
                view or rotate it, click <strong>Update credentials → Show webhook
                token</strong>. If your backend isn't publicly reachable from Dotypos,
                use your production origin instead of <code>{baseUrl}</code>.
              </p>
            </div>
          </details>
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

/**
 * Live "is this thing receiving anything?" panel. Refreshes every 10s in the
 * parent. Shows three counters (total / last 24h / last hour) and the most
 * recent five payloads with timestamps.
 */
function ActivityPanel({ activity }: { activity: PosActivity | null }) {
  if (!activity) {
    return (
      <div className="mt-3 text-xs text-[var(--color-muted)]">Loading activity…</div>
    );
  }
  const liveDot = activity.lastHour > 0;
  return (
    <div className="mt-3 border-t border-black/5 pt-3 space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className={`inline-block w-2 h-2 rounded-full ${
              liveDot ? "bg-emerald-500 animate-pulse" : "bg-gray-400"
            }`}
          />
          <span className="font-semibold">
            {liveDot ? "Receiving" : "Waiting for first receipt"}
          </span>
        </div>
        <span className="text-[var(--color-muted)]">
          <strong>{activity.lastHour}</strong> in last hour
        </span>
        <span className="text-[var(--color-muted)]">
          <strong>{activity.last24h}</strong> in last 24h
        </span>
        <span className="text-[var(--color-muted)]">
          <strong>{activity.totalSales}</strong> total
        </span>
      </div>

      {activity.recent.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-[var(--color-muted)] hover:text-[var(--color-text)]">
            Last {activity.recent.length} receipt{activity.recent.length === 1 ? "" : "s"}
          </summary>
          <ul className="mt-2 space-y-1">
            {activity.recent.map((r) => (
              <li
                key={r.externalId}
                className="flex flex-wrap items-center gap-2 px-2 py-1 rounded bg-black/5 font-mono"
              >
                <span className="text-[var(--color-muted)]">
                  {r.receivedAt
                    ? new Date(r.receivedAt).toLocaleString()
                    : "—"}
                </span>
                <span className="truncate">{r.itemName ?? r.sku ?? "(no name)"}</span>
                <span>×{r.quantity}</span>
                <span>{r.unitPrice.toFixed(2)} PLN</span>
                {r.matched ? (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                    matched
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                    unmatched
                  </span>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
