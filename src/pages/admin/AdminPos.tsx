import { useEffect, useState } from "react";
import {
  createPosIntegration,
  deletePosIntegration,
  listPosIntegrations,
  rotatePosSecret,
  setPosIntegrationActive,
  type PosIntegration,
} from "../../api/menu";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { Spinner } from "../../components/ui/Spinner";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";

export function AdminPos() {
  const [integrations, setIntegrations] = useState<PosIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [vendor, setVendor] = useState("");
  const [creating, setCreating] = useState(false);
  /** When we create or rotate, the server returns the secret exactly once.
   *  Keep it visible for a moment so the admin can copy it. */
  const [revealedSecret, setRevealedSecret] = useState<{
    integrationId: string;
    secret: string;
  } | null>(null);

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
      const created = await createPosIntegration(name.trim(), vendor.trim() || undefined);
      setMessage(`Integration "${created.name}" created`);
      if (created.webhookSecret) {
        setRevealedSecret({ integrationId: created.id, secret: created.webhookSecret });
      }
      setName("");
      setVendor("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create integration");
    } finally {
      setCreating(false);
    }
  };

  const rotate = async (i: PosIntegration) => {
    if (
      !confirm(
        `Rotate the webhook secret for "${i.name}"? The current secret will stop working immediately.`
      )
    )
      return;
    try {
      const updated = await rotatePosSecret(i.id);
      if (updated.webhookSecret) {
        setRevealedSecret({ integrationId: updated.id, secret: updated.webhookSecret });
      }
      setMessage(`Rotated secret for "${i.name}"`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rotation failed");
    }
  };

  const toggleActive = async (i: PosIntegration) => {
    try {
      await setPosIntegrationActive(i.id, !i.active);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update");
    }
  };

  const remove = async (i: PosIntegration) => {
    if (
      !confirm(
        `Delete integration "${i.name}"? This won't remove sales already received.`
      )
    )
      return;
    try {
      await deletePosIntegration(i.id);
      setMessage(`Deleted "${i.name}"`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage("Copied to clipboard");
    } catch {
      // Clipboard not available — fall back to inline display.
    }
  };

  const baseUrl = window.location.origin;

  return (
    <div className="space-y-6">
      <PageHeader
        title="POS integrations"
        subtitle="Receive item-level sales from your POS via signed webhooks. Each integration has its own secret."
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
            Vendor (optional)
            <input
              className="field-input"
              maxLength={40}
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="syrve, shoper, …"
            />
          </label>
          <div>
            <Button onClick={() => void create()} disabled={creating}>
              {creating ? "Creating…" : "Create"}
            </Button>
          </div>
        </div>
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
        <h3 className="font-semibold mb-3">How it works</h3>
        <p className="text-sm text-[var(--color-muted)]">
          Your POS sends a <code>POST</code> for every closed receipt to:
        </p>
        <code className="block mt-2 px-3 py-2 rounded-lg bg-black/5 text-sm font-mono break-all">
          {baseUrl}/api/pos/webhook/&#123;integrationId&#125;
        </code>
        <p className="text-sm text-[var(--color-muted)] mt-3">
          The body must be JSON; include header{" "}
          <code className="font-mono">X-Pos-Signature: sha256=&lt;hmac&gt;</code> where the
          HMAC-SHA256 is computed over the raw body using your integration's secret.
        </p>
        <details className="mt-3">
          <summary className="text-sm font-medium cursor-pointer text-[var(--color-saffron-dark)]">
            Example payload
          </summary>
          <pre className="mt-2 p-3 bg-black/5 rounded-lg text-xs overflow-x-auto">
{`{
  "externalId": "order-12345",
  "occurredAt": "2026-05-25T14:32:00Z",
  "paymentMethod": "CARD",
  "items": [
    { "sku": "PLOV-LAMB", "name": "Lamb Plov",
      "quantity": 2, "unitPrice": 38.00, "discount": 0 },
    { "sku": "CHAI-BLK", "name": "Black Tea",
      "quantity": 4, "unitPrice": 8.00 }
  ]
}`}
          </pre>
        </details>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner label="Loading integrations…" />
        </div>
      ) : integrations.length === 0 ? (
        <EmptyState
          title="No integrations yet"
          description="Add one above. You'll get a webhook URL and secret to plug into your POS."
        />
      ) : (
        <Card className="!p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-black/5 text-[var(--color-muted)] text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">Vendor</th>
                <th className="text-left px-4 py-2">Webhook URL</th>
                <th className="text-left px-4 py-2">Last received</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {integrations.map((i) => (
                <tr key={i.id} className="border-t border-black/5">
                  <td className="px-4 py-2 font-medium">{i.name}</td>
                  <td className="px-4 py-2 text-[var(--color-muted)]">{i.vendor ?? "—"}</td>
                  <td className="px-4 py-2 font-mono text-xs break-all">
                    {baseUrl}/api/pos/webhook/{i.id}
                  </td>
                  <td className="px-4 py-2 text-[var(--color-muted)]">
                    {i.lastSeenAt ? new Date(i.lastSeenAt).toLocaleString() : "never"}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        i.active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {i.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <button
                      type="button"
                      className="text-xs font-medium text-[var(--color-saffron-dark)] hover:underline mr-2"
                      onClick={() => void rotate(i)}
                    >
                      Rotate secret
                    </button>
                    <button
                      type="button"
                      className="text-xs font-medium text-[var(--color-muted)] hover:underline mr-2"
                      onClick={() => void toggleActive(i)}
                    >
                      {i.active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      type="button"
                      className="text-xs font-medium text-red-600 hover:underline"
                      onClick={() => void remove(i)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
