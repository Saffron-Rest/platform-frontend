import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  listItems as listMenuItems,
  listPosIntegrations,
  simulatePosSale,
  type MenuItem,
  type PosIntegration,
  type SimulateSaleResult,
} from "../../api/menu";
import { listStock, type StockItem } from "../../api/stock";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { Spinner } from "../../components/ui/Spinner";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";

/**
 * Admin POS sale simulator.
 *
 * <p>Sends a synthetic receipt through the live ingest path so admins can
 * verify menu↔stock mappings end-to-end without ringing up a real sale on
 * the POS. The "Dry run" toggle is on by default — every mutation (PosSale
 * row, stock movement, on-hand update) is rolled back at the end so the
 * tool is safe to use repeatedly while iterating on a setup.</p>
 *
 * <p>Live mode is the same code path the real Dotypos webhook uses, so a
 * green result here is genuine evidence the integration will work in
 * production.</p>
 */

type LineDraft = {
  /** Stable client-side id so React doesn't reuse a row when the user adds/removes lines. */
  key: string;
  /** Either menuItemId picks a known item, or sku/name fall back to free-form. */
  menuItemId: string;
  sku: string;
  name: string;
  quantity: string;
  unitPrice: string;
};

const PAYMENT_METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "CARD", label: "Card" },
  { value: "PLATFORM", label: "Delivery platform" },
  { value: "OTHER", label: "Other" },
];

const fmtNum = (n: number | null | undefined, unit = "") => {
  if (n === null || n === undefined) return "—";
  const v = Math.abs(n) < 0.001 ? 0 : n;
  const s = Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/\.?0+$/, "");
  return unit ? `${s} ${unit}` : s;
};

const newKey = () =>
  globalThis.crypto?.randomUUID?.() ?? `line-${Math.random().toString(36).slice(2)}`;

const blankLine = (): LineDraft => ({
  key: newKey(),
  menuItemId: "",
  sku: "",
  name: "",
  quantity: "1",
  unitPrice: "",
});

export function AdminPosSimulator() {
  const [integrations, setIntegrations] = useState<PosIntegration[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [integrationId, setIntegrationId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [dryRun, setDryRun] = useState(true);
  const [lines, setLines] = useState<LineDraft[]>([blankLine()]);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SimulateSaleResult | null>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [ints, menu, stock] = await Promise.all([
        listPosIntegrations(),
        listMenuItems({ includeArchived: false }).catch(() => [] as MenuItem[]),
        listStock().catch(() => [] as StockItem[]),
      ]);
      setIntegrations(ints);
      setMenuItems(menu);
      setStockItems(stock);
      // Default to the first active integration so the form is usable
      // without making the admin pick from a list of one.
      const active = ints.find((i) => i.active) ?? ints[0];
      if (active) setIntegrationId(active.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  // Index stock items by menu and by SKU so the live "projected on-hand"
  // hint can show the admin which stock row will move before they submit.
  const stockByMenuId = useMemo(() => {
    const m = new Map<string, StockItem>();
    for (const s of stockItems) {
      if (s.active && s.menuItemId) m.set(s.menuItemId, s);
    }
    return m;
  }, [stockItems]);

  const stockBySku = useMemo(() => {
    const m = new Map<string, StockItem>();
    for (const s of stockItems) {
      if (s.active && s.sku) m.set(s.sku.toLowerCase(), s);
    }
    return m;
  }, [stockItems]);

  const updateLine = (key: string, patch: Partial<LineDraft>) =>
    setLines((all) => all.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const addLine = () => setLines((all) => [...all, blankLine()]);
  const removeLine = (key: string) =>
    setLines((all) => (all.length === 1 ? all : all.filter((l) => l.key !== key)));

  /**
   * Pre-flight resolution that mirrors the backend's matching strategy
   * exactly. Lets the form preview which stock item *will* be touched
   * before the user submits.
   */
  const previewStockFor = (line: LineDraft): StockItem | null => {
    if (line.menuItemId) {
      const hit = stockByMenuId.get(line.menuItemId);
      if (hit) return hit;
    }
    if (line.sku.trim()) {
      const hit = stockBySku.get(line.sku.trim().toLowerCase());
      if (hit) return hit;
    }
    return null;
  };

  const previewMenuFor = (line: LineDraft): MenuItem | null => {
    if (line.menuItemId) {
      return menuItems.find((m) => m.id === line.menuItemId) ?? null;
    }
    if (line.sku.trim()) {
      return (
        menuItems.find(
          (m) => m.sku && m.sku.toLowerCase() === line.sku.trim().toLowerCase(),
        ) ?? null
      );
    }
    return null;
  };

  const submit = async () => {
    if (!integrationId) {
      setError("Pick an integration first");
      return;
    }
    const built = lines.map((l) => ({
      menuItemId: l.menuItemId || null,
      sku: l.sku.trim() || null,
      name: l.name.trim() || null,
      quantity: Number(l.quantity),
      unitPrice: l.unitPrice.trim() === "" ? null : Number(l.unitPrice),
    }));
    for (const l of built) {
      if (!l.menuItemId && !l.sku && !l.name) {
        setError("Each line needs a menu item, SKU, or name");
        return;
      }
      if (!l.quantity || l.quantity <= 0 || Number.isNaN(l.quantity)) {
        setError("Each line needs a positive quantity");
        return;
      }
    }
    setSubmitting(true);
    setError("");
    setInfo("");
    setResult(null);
    try {
      const r = await simulatePosSale(integrationId, {
        items: built,
        paymentMethod,
        dryRun,
      });
      setResult(r);
      const action = r.dryRun ? "Dry-run completed (rolled back)" : "Sale recorded";
      setInfo(
        `${action}: ${r.inserted} line${r.inserted === 1 ? "" : "s"} inserted, ${r.unmatched} unmatched, ${r.stockImpact.length} stock item${r.stockImpact.length === 1 ? "" : "s"} affected.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Simulation failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner label="Loading simulator…" />
      </div>
    );
  }

  if (integrations.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          kicker="Settings"
          title="POS sale simulator"
          subtitle="Synthesize a fake receipt to verify menu and stock mappings end-to-end."
        />
        <EmptyState
          title="No POS integrations"
          description="Create an integration on the POS settings page first — the simulator runs against an active integration."
          action={
            <Link to="/admin/pos">
              <Button>Open POS settings</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Settings"
        title="POS sale simulator"
        subtitle="Test menu→stock mapping end-to-end without ringing up a real sale."
      />

      {error && (
        <Alert variant="error">
          <div className="flex items-start justify-between gap-3">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError("")}
              className="text-sm text-current opacity-70 hover:opacity-100"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </Alert>
      )}
      {info && (
        <Alert variant="success">
          <div className="flex items-start justify-between gap-3">
            <span>{info}</span>
            <button
              type="button"
              onClick={() => setInfo("")}
              className="text-sm text-current opacity-70 hover:opacity-100"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </Alert>
      )}

      <Card>
        <h3 className="font-semibold mb-3">Receipt</h3>
        <div className="grid gap-3 md:grid-cols-3 mb-4">
          <label className="field-label">
            Integration
            <select
              className="field-input"
              value={integrationId}
              onChange={(e) => setIntegrationId(e.target.value)}
            >
              {integrations.map((i) => (
                <option key={i.id} value={i.id} disabled={!i.active}>
                  {i.name}
                  {!i.active ? " — inactive" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Payment method
            <select
              className="field-input"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              {PAYMENT_METHODS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 self-end pb-2">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
            />
            <span className="text-sm">
              Dry run <span className="text-[var(--color-muted)]">(roll back at the end — safe to repeat)</span>
            </span>
          </label>
        </div>

        <div className="space-y-3">
          {lines.map((line, idx) => {
            const previewMenu = previewMenuFor(line);
            const previewStock = previewStockFor(line);
            const qty = Number(line.quantity);
            const projected =
              previewStock && !Number.isNaN(qty) && qty > 0
                ? previewStock.onHand - qty
                : null;
            return (
              <div
                key={line.key}
                className="rounded-lg border border-black/10 p-3 space-y-3 bg-[var(--color-cream)]/30"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
                    Line {idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeLine(line.key)}
                    disabled={lines.length === 1}
                    className="text-xs text-red-700 hover:underline disabled:opacity-30 disabled:no-underline"
                  >
                    Remove
                  </button>
                </div>

                <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_1fr]">
                  <label className="field-label">
                    Menu item
                    <select
                      className="field-input"
                      value={line.menuItemId}
                      onChange={(e) => {
                        const mid = e.target.value;
                        const mi = menuItems.find((m) => m.id === mid);
                        updateLine(line.key, {
                          menuItemId: mid,
                          // Auto-fill name + SKU + price from the picked item
                          // so the admin doesn't have to retype known values.
                          // The user can still override any of them below.
                          name: mi?.name ?? line.name,
                          sku: mi?.sku ?? line.sku,
                          unitPrice:
                            mi != null
                              ? String(mi.sellPrice)
                              : line.unitPrice,
                        });
                      }}
                    >
                      <option value="">— Pick a menu item —</option>
                      {menuItems.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                          {m.sku ? ` (${m.sku})` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field-label">
                    SKU (optional override)
                    <input
                      className="field-input"
                      value={line.sku}
                      onChange={(e) => updateLine(line.key, { sku: e.target.value })}
                      placeholder="COKE-033"
                    />
                  </label>
                  <label className="field-label">
                    Quantity
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="field-input"
                      value={line.quantity}
                      onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                    />
                  </label>
                  <label className="field-label">
                    Unit price (zł)
                    <input
                      type="number"
                      step="any"
                      className="field-input"
                      value={line.unitPrice}
                      onChange={(e) => updateLine(line.key, { unitPrice: e.target.value })}
                      placeholder={previewMenu ? String(previewMenu.sellPrice) : "10.00"}
                    />
                  </label>
                </div>

                {(line.menuItemId || line.sku.trim()) && (
                  <div className="text-xs">
                    {previewStock ? (
                      <div className="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-emerald-900">
                        <strong>Will decrement</strong>{" "}
                        <span className="font-mono">{previewStock.name}</span>:{" "}
                        <span className="font-mono">
                          {fmtNum(previewStock.onHand, previewStock.unit)}
                        </span>{" "}
                        →{" "}
                        <span className="font-mono">
                          {projected !== null
                            ? fmtNum(projected, previewStock.unit)
                            : "?"}
                        </span>
                        {projected !== null && projected < 0 && (
                          <span className="ml-2 text-red-700 font-semibold">(would go negative)</span>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-amber-900">
                        <strong>No linked stock</strong> — POS sale will be
                        recorded but no inventory will move. To fix, link a
                        stock item to this menu item on the{" "}
                        <Link to="/admin/stock" className="underline">
                          Stock page
                        </Link>
                        .
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" onClick={addLine}>
            + Add line
          </Button>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setLines([blankLine()]);
                setResult(null);
                setInfo("");
              }}
              disabled={submitting}
            >
              Reset
            </Button>
            <Button onClick={() => void submit()} disabled={submitting}>
              {submitting
                ? "Running…"
                : dryRun
                ? "Run dry-run simulation"
                : "Submit live sale"}
            </Button>
          </div>
        </div>
      </Card>

      {result && <ResultPanel result={result} />}

      <Card>
        <h3 className="font-semibold mb-2">How this works</h3>
        <ul className="list-disc pl-5 text-sm space-y-1 text-[var(--color-muted)]">
          <li>
            The simulator builds a synthetic receipt and runs it through the
            same backend path the live Dotypos webhook uses — including the
            stock-decrement post-handler.
          </li>
          <li>
            <strong>Dry run</strong> (default): every mutation — POS sale row,
            stock movement, on-hand update — is rolled back just before the
            response is returned. Nothing persists, so it's safe to iterate.
          </li>
          <li>
            <strong>Live mode</strong>: a real <code>POS_SALE</code> stock
            movement is recorded and on-hand drops. You can revert it later
            from the stock item's history panel — every movement is reversible.
          </li>
          <li>
            Matching strategy mirrors production exactly: menu item id first,
            then SKU. Lines without either are recorded as "Unmatched" (no
            stock impact).
          </li>
        </ul>
      </Card>
    </div>
  );
}

function ResultPanel({ result }: { result: SimulateSaleResult }) {
  return (
    <Card
      className={
        result.dryRun
          ? "border border-blue-200 bg-blue-50/40"
          : "border border-emerald-200 bg-emerald-50/40"
      }
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-semibold">
            {result.dryRun ? "Dry-run result" : "Live sale recorded"}
          </h3>
          <p className="text-xs text-[var(--color-muted)] mt-0.5">
            External id:{" "}
            <code className="font-mono">{result.externalId}</code>
          </p>
        </div>
        <span
          className={`px-2 py-0.5 rounded-full text-xs ring-1 ${
            result.dryRun
              ? "bg-blue-100 text-blue-800 ring-blue-200"
              : "bg-emerald-100 text-emerald-800 ring-emerald-200"
          }`}
        >
          {result.dryRun ? "Rolled back" : "Persisted"}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm mb-4">
        <Stat label="Lines inserted" value={String(result.inserted)} />
        <Stat label="Skipped (idempotent)" value={String(result.skipped)} />
        <Stat
          label="Unmatched"
          value={String(result.unmatched)}
          warn={result.unmatched > 0}
        />
      </div>

      {result.stockImpact.length > 0 ? (
        <div className="mb-4">
          <h4 className="text-sm font-semibold mb-2">Stock impact</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-[var(--color-muted)]">
                <tr>
                  <th className="py-1 pr-3">Item</th>
                  <th className="py-1 pr-3 text-right">Before</th>
                  <th className="py-1 pr-3 text-right">After</th>
                  <th className="py-1 pr-3 text-right">Δ</th>
                </tr>
              </thead>
              <tbody>
                {result.stockImpact.map((s) => (
                  <tr key={s.stockItemId} className="border-t border-black/5">
                    <td className="py-1.5 pr-3">{s.name}</td>
                    <td className="py-1.5 pr-3 text-right font-mono">
                      {fmtNum(s.before, s.unit)}
                    </td>
                    <td className="py-1.5 pr-3 text-right font-mono">
                      {fmtNum(s.after, s.unit)}
                    </td>
                    <td
                      className={`py-1.5 pr-3 text-right font-mono ${
                        s.delta < 0
                          ? "text-red-700"
                          : s.delta > 0
                          ? "text-emerald-700"
                          : ""
                      }`}
                    >
                      {s.delta > 0 ? "+" : ""}
                      {fmtNum(s.delta, s.unit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="mb-4 text-sm rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-amber-900">
          No stock items moved — none of the simulated lines resolve to a
          linked stock row. Verify your menu→stock mappings on the{" "}
          <Link to="/admin/stock" className="underline">
            Stock page
          </Link>
          .
        </div>
      )}

      {result.unlinkedLines.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-[var(--color-muted)] hover:text-[var(--color-text)]">
            {result.unlinkedLines.length} line
            {result.unlinkedLines.length === 1 ? "" : "s"} without linked stock
          </summary>
          <ul className="mt-2 space-y-1 text-xs">
            {result.unlinkedLines.map((l, i) => (
              <li key={i} className="font-mono">
                {l.name ?? l.sku ?? l.menuItemId ?? "(unnamed)"} × {l.quantity}
              </li>
            ))}
          </ul>
        </details>
      )}

      {!result.dryRun && (
        <p className="text-xs text-[var(--color-muted)] mt-3">
          Each stock change above is a real <code>POS_SALE</code> movement —
          you can revert any of them from the stock item's{" "}
          <Link to="/admin/stock" className="underline">
            history drawer
          </Link>
          .
        </p>
      )}
    </Card>
  );
}

function Stat({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 ${
        warn
          ? "border-amber-200 bg-amber-50/60"
          : "border-black/10 bg-white"
      }`}
    >
      <div className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </div>
      <div className="text-xl font-semibold text-[var(--color-ink)]">{value}</div>
    </div>
  );
}
