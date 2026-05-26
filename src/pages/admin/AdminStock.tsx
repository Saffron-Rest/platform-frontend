import { useEffect, useMemo, useState } from "react";
import {
  adjustStock,
  archiveStock,
  deleteStockPermanently,
  createStock,
  listMovements,
  listStock,
  movementTypeLabel,
  revertMovement,
  setOnHand,
  updateStock,
  type AdjustPayload,
  type StockItem,
  type StockItemPayload,
  type StockMovement,
  type StockMovementType,
  type StockStatus,
} from "../../api/stock";
import { listItems as listMenuItems, type MenuItem } from "../../api/menu";
import { getRecipesAffectedByStock, type RecipeRef } from "../../api/recipes";
import { Link } from "react-router-dom";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { Spinner } from "../../components/ui/Spinner";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";

type Tab = "ALL" | "LOW" | "OUT" | "ARCHIVED";

type ItemDraft = {
  id?: string;
  name: string;
  sku: string;
  unit: string;
  menuItemId: string;
  category: string;
  onHand: string;
  lowStockThreshold: string;
  parLevel: string;
  unitCost: string;
  notes: string;
  active: boolean;
};

const blankDraft: ItemDraft = {
  name: "",
  sku: "",
  unit: "pcs",
  menuItemId: "",
  category: "",
  onHand: "",
  lowStockThreshold: "",
  parLevel: "",
  unitCost: "",
  notes: "",
  active: true,
};

const UNIT_OPTIONS = ["pcs", "kg", "g", "l", "ml", "portion", "box", "pack"];

const ADJUSTMENT_TYPES: { value: StockMovementType; label: string; signHint: string }[] = [
  { value: "PURCHASE", label: "Purchase / restock", signHint: "+ adds to stock" },
  { value: "WASTE", label: "Waste / breakage", signHint: "- removes from stock" },
  { value: "INTERNAL_USE", label: "Internal use / staff meal", signHint: "- removes from stock" },
  { value: "TRANSFER", label: "Transfer / used in recipe", signHint: "- removes from stock" },
  { value: "ADJUST", label: "Manual adjustment", signHint: "signed" },
];

const statusBadge = (s: StockStatus): { label: string; cls: string } => {
  switch (s) {
    case "OK":
      return { label: "OK", cls: "bg-emerald-100 text-emerald-800 ring-emerald-200" };
    case "LOW":
      return { label: "Low", cls: "bg-amber-100 text-amber-900 ring-amber-200" };
    case "OUT":
      return { label: "Out of stock", cls: "bg-red-100 text-red-800 ring-red-200" };
    case "ARCHIVED":
      return { label: "Archived", cls: "bg-zinc-100 text-zinc-700 ring-zinc-200" };
  }
};

const fmtNum = (n: number | null | undefined, unit = "") => {
  if (n === null || n === undefined) return "—";
  const v = Math.abs(n) < 0.001 ? 0 : n;
  const s = Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/\.?0+$/, "");
  return unit ? `${s} ${unit}` : s;
};

const fmtMoney = (n: number | null | undefined) => {
  if (n === null || n === undefined) return "—";
  return `${n.toFixed(2)} zł`;
};

const fmtDate = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export function AdminStock() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [tab, setTab] = useState<Tab>("ALL");
  const [search, setSearch] = useState("");

  const [editor, setEditor] = useState<ItemDraft | null>(null);
  const [savingEditor, setSavingEditor] = useState(false);

  const [adjustingFor, setAdjustingFor] = useState<StockItem | null>(null);
  const [historyFor, setHistoryFor] = useState<StockItem | null>(null);
  // Two-step delete: archive first (handled by the regular Archive action),
  // then confirm permanent removal via this modal. We hold the candidate
  // item + a typed-confirmation string here.
  const [deletingItem, setDeletingItem] = useState<StockItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [rows, menu] = await Promise.all([
        listStock(),
        listMenuItems({ includeArchived: false }).catch(() => [] as MenuItem[]),
      ]);
      setItems(rows);
      setMenuItems(menu);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load stock");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const counts = useMemo(() => {
    let ok = 0, low = 0, out = 0, archived = 0, totalValue = 0;
    for (const it of items) {
      if (!it.active) { archived++; continue; }
      if (it.status === "OUT") out++;
      else if (it.status === "LOW") low++;
      else ok++;
      if (it.inventoryValue) totalValue += it.inventoryValue;
    }
    return { ok, low, out, archived, totalValue };
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (tab === "LOW" && !(it.active && it.status === "LOW")) return false;
      if (tab === "OUT" && !(it.active && it.status === "OUT")) return false;
      if (tab === "ARCHIVED" && it.active) return false;
      if (tab === "ALL" && !it.active) return false;
      if (q) {
        const hay = [it.name, it.sku, it.category, it.menuItemName].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, tab, search]);

  const startCreate = () => setEditor({ ...blankDraft });
  const startEdit = (it: StockItem) =>
    setEditor({
      id: it.id,
      name: it.name,
      sku: it.sku ?? "",
      unit: it.unit ?? "pcs",
      menuItemId: it.menuItemId ?? "",
      category: it.category ?? "",
      onHand: String(it.onHand ?? 0),
      lowStockThreshold: it.lowStockThreshold !== null ? String(it.lowStockThreshold) : "",
      parLevel: it.parLevel !== null ? String(it.parLevel) : "",
      unitCost: it.unitCost !== null ? String(it.unitCost) : "",
      notes: it.notes ?? "",
      active: it.active,
    });

  const saveEditor = async () => {
    if (!editor) return;
    if (!editor.name.trim()) {
      setError("Name is required");
      return;
    }
    setSavingEditor(true);
    setError("");
    try {
      const payload: StockItemPayload = {
        name: editor.name.trim(),
        sku: editor.sku.trim() || null,
        unit: editor.unit || "pcs",
        menuItemId: editor.menuItemId || null,
        category: editor.category.trim() || null,
        lowStockThreshold: editor.lowStockThreshold === "" ? null : Number(editor.lowStockThreshold),
        parLevel: editor.parLevel === "" ? null : Number(editor.parLevel),
        unitCost: editor.unitCost === "" ? null : Number(editor.unitCost),
        notes: editor.notes.trim() || null,
        active: editor.active,
      };
      if (editor.id) {
        await updateStock(editor.id, payload);
        setInfo(`Updated ${payload.name}`);
      } else {
        await createStock({ ...payload, onHand: editor.onHand === "" ? 0 : Number(editor.onHand) });
        setInfo(`Added ${payload.name} to inventory`);
      }
      setEditor(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingEditor(false);
    }
  };

  const archive = async (it: StockItem) => {
    if (!confirm(`Archive "${it.name}"? It will be hidden from the active list but history is kept.`)) return;
    try {
      await archiveStock(it.id);
      setInfo(`Archived ${it.name}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Archive failed");
    }
  };

  const openDeleteConfirm = (it: StockItem) => {
    setDeletingItem(it);
    setDeleteConfirm("");
    setDeleteReason("");
    setError("");
  };

  const closeDeleteConfirm = () => {
    setDeletingItem(null);
    setDeleteConfirm("");
    setDeleteReason("");
  };

  /**
   * Wipe the item and its movement ledger after the admin has typed the
   * item's name to confirm. The backend additionally guards against
   * deleting an active item — this UI only exposes the action on the
   * Archived tab, but the server check is the real gate.
   */
  const confirmDeleteItem = async () => {
    if (!deletingItem) return;
    if (deleteConfirm.trim() !== deletingItem.name) {
      setError(`Type the item's name "${deletingItem.name}" to confirm.`);
      return;
    }
    setDeleting(true);
    try {
      await deleteStockPermanently(deletingItem.id, deleteReason.trim() || undefined);
      setInfo(`Permanently deleted "${deletingItem.name}".`);
      closeDeleteConfirm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Operations"
        title="Stock"
        subtitle="Track on-hand inventory; sync automatically when a POS sale comes in."
        action={<Button onClick={startCreate}>+ Add stock item</Button>}
        tabs={[
          { id: "ALL", label: "Active", active: tab === "ALL", onClick: () => setTab("ALL"), badge: counts.ok + counts.low + counts.out },
          { id: "LOW", label: "Low", active: tab === "LOW", onClick: () => setTab("LOW"), badge: counts.low },
          { id: "OUT", label: "Out", active: tab === "OUT", onClick: () => setTab("OUT"), badge: counts.out },
          { id: "ARCHIVED", label: "Archived", active: tab === "ARCHIVED", onClick: () => setTab("ARCHIVED"), badge: counts.archived },
        ]}
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile label="Healthy" value={String(counts.ok)} hint="On-hand above threshold" tone="ok" />
        <KpiTile label="Low stock" value={String(counts.low)} hint="At or below threshold" tone="warn" />
        <KpiTile label="Out of stock" value={String(counts.out)} hint="Zero or negative on-hand" tone="bad" />
        <KpiTile label="Inventory value" value={fmtMoney(counts.totalValue)} hint="Σ on-hand × unit cost" tone="neutral" />
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-end gap-3 mb-4">
          <input
            type="search"
            placeholder="Search by name, SKU, category…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="field-input min-w-[220px] max-w-[320px]"
          />
        </div>

        {loading ? (
          <div className="py-10"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Nothing here yet"
            description={
              tab === "ALL"
                ? "Add your first stock item to start tracking inventory. POS sales linked to a menu item will decrement automatically."
                : "No items match this filter."
            }
            action={tab === "ALL" ? <Button onClick={startCreate}>Add stock item</Button> : undefined}
          />
        ) : (
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-[var(--color-muted)]">
                <tr>
                  <th className="py-2 pr-3">Item</th>
                  <th className="py-2 pr-3">Category</th>
                  <th className="py-2 pr-3 text-right">On hand</th>
                  <th className="py-2 pr-3 text-right">Threshold</th>
                  <th className="py-2 pr-3 text-right">Value</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Last change</th>
                  <th className="py-2 pr-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((it) => {
                  const badge = statusBadge(it.status);
                  return (
                    <tr key={it.id} className="border-t border-black/5">
                      <td className="py-3 pr-3">
                        <div className="font-medium text-[var(--color-ink)]">{it.name}</div>
                        <div className="text-xs text-[var(--color-muted)] flex gap-2 mt-0.5 flex-wrap">
                          {it.sku && <span>SKU: {it.sku}</span>}
                          {it.menuItemName && <span>· Menu: {it.menuItemName}</span>}
                          {!it.menuItemName && it.menuItemId && <span>· Menu link set</span>}
                        </div>
                      </td>
                      <td className="py-3 pr-3 text-[var(--color-muted)]">{it.category || "—"}</td>
                      <td className="py-3 pr-3 text-right font-mono">
                        {fmtNum(it.onHand, it.unit)}
                      </td>
                      <td className="py-3 pr-3 text-right text-[var(--color-muted)] font-mono">
                        {it.lowStockThreshold === null ? "—" : fmtNum(it.lowStockThreshold, it.unit)}
                      </td>
                      <td className="py-3 pr-3 text-right text-[var(--color-muted)] font-mono">
                        {fmtMoney(it.inventoryValue)}
                      </td>
                      <td className="py-3 pr-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs ring-1 ${badge.cls}`}>{badge.label}</span>
                      </td>
                      <td className="py-3 pr-3 text-[var(--color-muted)] text-xs">{fmtDate(it.lastMovementAt)}</td>
                      <td className="py-3 pr-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setAdjustingFor(it)}
                          disabled={!it.active}
                          className="text-sm text-[var(--color-saffron-dark)] hover:underline disabled:opacity-40 disabled:no-underline"
                        >
                          Adjust
                        </button>
                        <span className="text-[var(--color-muted)] mx-2">·</span>
                        <button
                          type="button"
                          onClick={() => setHistoryFor(it)}
                          className="text-sm text-[var(--color-ink)] hover:underline"
                        >
                          History
                        </button>
                        <span className="text-[var(--color-muted)] mx-2">·</span>
                        <button
                          type="button"
                          onClick={() => startEdit(it)}
                          className="text-sm text-[var(--color-ink)] hover:underline"
                        >
                          Edit
                        </button>
                        {it.active ? (
                          <>
                            <span className="text-[var(--color-muted)] mx-2">·</span>
                            <button
                              type="button"
                              onClick={() => archive(it)}
                              className="text-sm text-red-700 hover:underline"
                            >
                              Archive
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="text-[var(--color-muted)] mx-2">·</span>
                            <button
                              type="button"
                              onClick={() => openDeleteConfirm(it)}
                              className="text-sm text-red-700 hover:underline"
                              title="Permanently remove this item and its movement history"
                            >
                              Delete permanently
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editor && (
        <EditorModal
          draft={editor}
          menuItems={menuItems}
          existingItems={items}
          saving={savingEditor}
          onChange={setEditor}
          onCancel={() => setEditor(null)}
          onSave={saveEditor}
        />
      )}

      {adjustingFor && (
        <AdjustModal
          item={adjustingFor}
          onCancel={() => setAdjustingFor(null)}
          onDone={async (msg) => {
            setAdjustingFor(null);
            setInfo(msg);
            await load();
          }}
          onError={setError}
        />
      )}

      {historyFor && (
        <HistoryDrawer
          item={historyFor}
          onClose={() => setHistoryFor(null)}
          onReverted={async (msg) => {
            setInfo(msg);
            await load();
          }}
          onError={setError}
        />
      )}

      {deletingItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="stock-delete-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-red-200 bg-red-50 px-6 py-4 rounded-t-2xl">
              <h2 id="stock-delete-title" className="text-base font-semibold text-red-900">
                Delete permanently?
              </h2>
              <p className="mt-1 text-sm text-red-900/80">
                This removes <strong>{deletingItem.name}</strong> and its entire
                movement history. The action cannot be undone.
              </p>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--color-muted)] mb-1">
                  Type <span className="font-mono text-[var(--color-ink)]">{deletingItem.name}</span> to confirm
                </label>
                <input
                  type="text"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  autoFocus
                  className="w-full rounded-md border border-black/15 px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200"
                  placeholder={deletingItem.name}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-muted)] mb-1">
                  Reason (optional, logged in audit trail)
                </label>
                <input
                  type="text"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  className="w-full rounded-md border border-black/15 px-3 py-2 text-sm focus:border-[var(--color-saffron)] focus:outline-none focus:ring-2 focus:ring-[var(--color-saffron)]/30"
                  placeholder="e.g. duplicate item, created in error"
                />
              </div>
              {error && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {error}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-black/5 px-6 py-3 bg-[var(--color-cream)]/40 rounded-b-2xl">
              <button
                type="button"
                onClick={closeDeleteConfirm}
                disabled={deleting}
                className="rounded-md border border-black/15 bg-white px-3 py-1.5 text-sm hover:bg-black/5 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteItem}
                disabled={deleting || deleteConfirm.trim() !== deletingItem.name}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// KPI Tile
// ============================================================================

function KpiTile({ label, value, hint, tone }: {
  label: string;
  value: string;
  hint?: string;
  tone: "ok" | "warn" | "bad" | "neutral";
}) {
  const toneCls = {
    ok: "border-emerald-200/60 bg-emerald-50/40",
    warn: "border-amber-200/60 bg-amber-50/40",
    bad: "border-red-200/60 bg-red-50/40",
    neutral: "border-black/5 bg-[var(--color-cream)]/60",
  }[tone];
  return (
    <div className={`rounded-xl border ${toneCls} p-3`}>
      <div className="text-xs uppercase tracking-wider text-[var(--color-muted)]">{label}</div>
      <div className="text-2xl font-semibold text-[var(--color-ink)] mt-1">{value}</div>
      {hint && <div className="text-xs text-[var(--color-muted)] mt-1">{hint}</div>}
    </div>
  );
}

// ============================================================================
// Editor modal — Add / Edit
// ============================================================================

function EditorModal({
  draft,
  menuItems,
  existingItems,
  saving,
  onChange,
  onCancel,
  onSave,
}: {
  draft: ItemDraft;
  menuItems: MenuItem[];
  existingItems: StockItem[];
  saving: boolean;
  onChange: (d: ItemDraft) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const isEdit = !!draft.id;
  // Highlight already-linked menu items so the admin doesn't accidentally
  // double-link two stock rows to the same dish.
  const linkedMenuIds = useMemo(
    () => new Set(existingItems.filter((i) => i.menuItemId && i.id !== draft.id).map((i) => i.menuItemId)),
    [existingItems, draft.id]
  );

  // Recipes that consume this stock item — used to warn the admin
  // that changing the unit cost will silently reprice N cost cards.
  // Skipped on the "create" flow since there are no references yet.
  const [affectedRecipes, setAffectedRecipes] = useState<RecipeRef[]>([]);
  useEffect(() => {
    if (!draft.id) {
      setAffectedRecipes([]);
      return;
    }
    let alive = true;
    getRecipesAffectedByStock(draft.id)
      .then((r) => {
        if (alive) setAffectedRecipes(r);
      })
      .catch(() => {
        if (alive) setAffectedRecipes([]);
      });
    return () => {
      alive = false;
    };
  }, [draft.id]);

  return (
    <Modal title={isEdit ? "Edit stock item" : "Add stock item"} onClose={onCancel}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Name *">
            <input
              className="field-input"
              value={draft.name}
              onChange={(e) => onChange({ ...draft, name: e.target.value })}
              placeholder="Lamb shoulder"
            />
          </Field>
          <Field label="SKU / barcode">
            <input
              className="field-input"
              value={draft.sku}
              onChange={(e) => onChange({ ...draft, sku: e.target.value })}
              placeholder="LAMB-SHO"
            />
          </Field>
          <Field label="Unit">
            <select
              className="field-input"
              value={draft.unit}
              onChange={(e) => onChange({ ...draft, unit: e.target.value })}
            >
              {UNIT_OPTIONS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </Field>
          <Field label="Category">
            <input
              className="field-input"
              value={draft.category}
              onChange={(e) => onChange({ ...draft, category: e.target.value })}
              placeholder="Mains, Drinks, Ingredient…"
            />
          </Field>
        </div>

        <Field
          label="Linked menu item"
          hint="When set, every POS sale of this menu item will automatically subtract from on-hand."
        >
          <select
            className="field-input"
            value={draft.menuItemId}
            onChange={(e) => onChange({ ...draft, menuItemId: e.target.value })}
          >
            <option value="">— No menu link (manual only) —</option>
            {menuItems.map((m) => {
              const alreadyLinked = linkedMenuIds.has(m.id);
              return (
                <option key={m.id} value={m.id} disabled={alreadyLinked}>
                  {m.name}{m.sku ? ` (${m.sku})` : ""}{alreadyLinked ? " — already linked" : ""}
                </option>
              );
            })}
          </select>
        </Field>

        {!isEdit && (
          <Field label="Starting on-hand" hint="Recorded as an 'Opening count' movement so it shows in the history.">
            <input
              type="number"
              step="any"
              className="field-input"
              value={draft.onHand}
              onChange={(e) => onChange({ ...draft, onHand: e.target.value })}
              placeholder="0"
            />
          </Field>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Low-stock threshold" hint="UI flags red below this.">
            <input
              type="number"
              step="any"
              className="field-input"
              value={draft.lowStockThreshold}
              onChange={(e) => onChange({ ...draft, lowStockThreshold: e.target.value })}
              placeholder="e.g. 5"
            />
          </Field>
          <Field label="Par level" hint="Target after restock.">
            <input
              type="number"
              step="any"
              className="field-input"
              value={draft.parLevel}
              onChange={(e) => onChange({ ...draft, parLevel: e.target.value })}
              placeholder="e.g. 20"
            />
          </Field>
          <Field label="Unit cost (zł)" hint="For inventory-value calc.">
            <input
              type="number"
              step="any"
              className="field-input"
              value={draft.unitCost}
              onChange={(e) => onChange({ ...draft, unitCost: e.target.value })}
              placeholder="11.50"
            />
          </Field>
        </div>

        {affectedRecipes.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-900">
            <p className="font-medium">
              {affectedRecipes.length === 1
                ? "1 recipe uses this ingredient"
                : `${affectedRecipes.length} recipes use this ingredient`}
              {" — changing the unit cost will reprice them."}
            </p>
            <ul className="mt-1 space-y-0.5">
              {affectedRecipes.slice(0, 6).map((r) => (
                <li key={r.id}>
                  <Link
                    to="/admin/recipes"
                    className="hover:underline text-amber-900"
                  >
                    {r.name}
                  </Link>
                  {!r.active && (
                    <span className="ml-1 text-[10px] uppercase tracking-wider font-semibold opacity-70">
                      archived
                    </span>
                  )}
                </li>
              ))}
              {affectedRecipes.length > 6 && (
                <li className="opacity-70">
                  + {affectedRecipes.length - 6} more…
                </li>
              )}
            </ul>
          </div>
        )}

        <Field label="Notes">
          <textarea
            className="field-input min-h-[80px]"
            value={draft.notes}
            onChange={(e) => onChange({ ...draft, notes: e.target.value })}
            placeholder="Supplier, prep notes, anything that helps…"
          />
        </Field>

        {isEdit && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => onChange({ ...draft, active: e.target.checked })}
            />
            <span>Active (uncheck to archive — POS sales will stop decrementing this item)</span>
          </label>
        )}
      </div>

      <div className="flex justify-end gap-2 mt-6">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : isEdit ? "Save changes" : "Create item"}
        </Button>
      </div>
    </Modal>
  );
}

// ============================================================================
// Adjust modal — purchases / waste / on-hand reset
// ============================================================================

function AdjustModal({
  item,
  onCancel,
  onDone,
  onError,
}: {
  item: StockItem;
  onCancel: () => void;
  onDone: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [mode, setMode] = useState<"delta" | "target">("delta");
  const [type, setType] = useState<StockMovementType>("PURCHASE");
  const [amount, setAmount] = useState("");
  const [target, setTarget] = useState(String(item.onHand));
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const isRemoval = type === "WASTE" || type === "INTERNAL_USE" || type === "TRANSFER";

  const submit = async () => {
    if (!reason.trim()) {
      onError("Please add a reason — it shows up in the audit trail.");
      return;
    }
    setSaving(true);
    try {
      if (mode === "target") {
        const t = Number(target);
        if (isNaN(t)) { onError("Target must be a number"); setSaving(false); return; }
        await setOnHand(item.id, t, reason.trim());
        onDone(`Set ${item.name} to ${t} ${item.unit}`);
      } else {
        const a = Number(amount);
        if (isNaN(a) || a === 0) { onError("Amount must be a non-zero number"); setSaving(false); return; }
        const delta = type === "ADJUST" ? a : isRemoval ? -Math.abs(a) : Math.abs(a);
        const payload: AdjustPayload = { delta, type, reason: reason.trim() };
        await adjustStock(item.id, payload);
        onDone(`Recorded ${movementTypeLabel(type).toLowerCase()}: ${delta > 0 ? "+" : ""}${delta} ${item.unit}`);
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : "Adjustment failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Adjust · ${item.name}`} onClose={onCancel}>
      <div className="space-y-4">
        <div className="rounded-lg bg-[var(--color-cream)]/60 border border-black/5 p-3 text-sm">
          <div className="text-xs uppercase tracking-wider text-[var(--color-muted)]">Current on-hand</div>
          <div className="text-2xl font-semibold text-[var(--color-ink)] mt-1">
            {fmtNum(item.onHand, item.unit)}
          </div>
        </div>

        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setMode("delta")}
            className={`tab-pill ${mode === "delta" ? "tab-pill-active" : "tab-pill-idle"}`}
          >
            Record movement
          </button>
          <button
            type="button"
            onClick={() => setMode("target")}
            className={`tab-pill ${mode === "target" ? "tab-pill-active" : "tab-pill-idle"}`}
          >
            Set to exact value
          </button>
        </div>

        {mode === "delta" ? (
          <>
            <Field label="Type">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {ADJUSTMENT_TYPES.map((t) => {
                  const active = type === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setType(t.value)}
                      className={`text-left rounded-lg border px-3 py-2 text-sm transition ${
                        active
                          ? "border-[var(--color-saffron)] bg-[var(--color-saffron)]/10"
                          : "border-black/10 hover:bg-[var(--color-cream)]"
                      }`}
                    >
                      <div className="font-medium text-[var(--color-ink)]">{t.label}</div>
                      <div className="text-xs text-[var(--color-muted)]">{t.signHint}</div>
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field
              label={type === "ADJUST" ? "Signed delta" : "Quantity"}
              hint={
                type === "ADJUST"
                  ? "Type a positive number to add, negative to subtract."
                  : isRemoval
                  ? "Positive number — the system makes it negative for you."
                  : "Positive number — added to on-hand."
              }
            >
              <input
                type="number"
                step="any"
                autoFocus
                className="field-input"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`e.g. 12 ${item.unit}`}
              />
            </Field>
          </>
        ) : (
          <Field label={`New on-hand value (${item.unit})`} hint="Used after a physical count.">
            <input
              type="number"
              step="any"
              autoFocus
              className="field-input"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </Field>
        )}

        <Field label="Reason *" hint="One line — shows up in the history.">
          <input
            className="field-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={mode === "target" ? "Physical count — Tuesday close" : "Delivery from Hala butcher"}
          />
        </Field>
      </div>

      <div className="flex justify-end gap-2 mt-6">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button onClick={submit} disabled={saving}>
          {saving ? "Saving…" : "Apply"}
        </Button>
      </div>
    </Modal>
  );
}

// ============================================================================
// History drawer with revert
// ============================================================================

function HistoryDrawer({
  item,
  onClose,
  onReverted,
  onError,
}: {
  item: StockItem;
  onClose: () => void;
  onReverted: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [reverting, setReverting] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listMovements(item.id, 200);
      setMovements(data);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [item.id]);

  const revert = async (m: StockMovement) => {
    const reason = window.prompt(
      `Revert this ${movementTypeLabel(m.type).toLowerCase()} (${m.delta > 0 ? "+" : ""}${m.delta} ${item.unit})?\n\nReason:`,
      ""
    );
    if (reason === null) return;
    if (!reason.trim()) {
      onError("Reason is required to revert");
      return;
    }
    setReverting(m.id);
    try {
      await revertMovement(m.id, reason.trim());
      onReverted(`Reverted ${movementTypeLabel(m.type).toLowerCase()} on ${item.name}`);
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Revert failed");
    } finally {
      setReverting(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="bg-white w-full max-w-[520px] h-full overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-black/5 px-5 py-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-ink)]">History · {item.name}</h2>
            <p className="text-xs text-[var(--color-muted)] mt-0.5">
              On-hand {fmtNum(item.onHand, item.unit)} · {movements.length} movement{movements.length === 1 ? "" : "s"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--color-muted)] hover:text-[var(--color-ink)] text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {loading ? (
          <div className="py-10"><Spinner /></div>
        ) : movements.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No movements yet" description="This item hasn't been touched since it was created." />
          </div>
        ) : (
          <ul className="divide-y divide-black/5">
            {movements.map((m) => (
              <li key={m.id} className={`px-5 py-4 ${m.reverted ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full ring-1 ${typeBadge(m.type)}`}>
                        {movementTypeLabel(m.type)}
                      </span>
                      <span className={`font-mono text-sm ${m.delta >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                        {m.delta > 0 ? "+" : ""}{m.delta} {item.unit}
                      </span>
                      <span className="text-xs text-[var(--color-muted)]">
                        → {fmtNum(m.balanceAfter, item.unit)}
                      </span>
                      {m.reverted && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200">
                          Reverted
                        </span>
                      )}
                    </div>
                    {m.reason && <div className="text-sm text-[var(--color-ink)] mt-1">{m.reason}</div>}
                    <div className="text-xs text-[var(--color-muted)] mt-1">
                      {fmtDate(m.createdAt)}
                      {m.referenceType && <span> · source: {m.referenceType.toLowerCase()}</span>}
                    </div>
                  </div>
                  {!m.reverted && m.type !== "REVERT" && (
                    <button
                      type="button"
                      onClick={() => revert(m)}
                      disabled={reverting === m.id}
                      className="text-xs text-red-700 hover:underline disabled:opacity-40 shrink-0"
                    >
                      {reverting === m.id ? "Reverting…" : "Revert"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function typeBadge(t: StockMovementType): string {
  switch (t) {
    case "SALE": return "bg-blue-100 text-blue-800 ring-blue-200";
    case "PURCHASE": return "bg-emerald-100 text-emerald-800 ring-emerald-200";
    case "WASTE": return "bg-red-100 text-red-800 ring-red-200";
    case "TRANSFER":
    case "INTERNAL_USE":
      return "bg-amber-100 text-amber-900 ring-amber-200";
    case "ADJUST":
    case "OPENING_COUNT":
      return "bg-violet-100 text-violet-800 ring-violet-200";
    case "REVERT":
      return "bg-orange-100 text-orange-800 ring-orange-200";
  }
}

// ============================================================================
// Generic modal + field shells (kept local — the rest of the app uses inline
// modals via Card, so we mirror that pattern instead of pulling a new dep).
// ============================================================================

function Modal({ title, onClose, children }: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-black/5 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--color-muted)] hover:text-[var(--color-ink)] text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-xs uppercase tracking-wider text-[var(--color-muted)] mb-1">{label}</div>
      {children}
      {hint && <div className="text-xs text-[var(--color-muted)] mt-1">{hint}</div>}
    </label>
  );
}
