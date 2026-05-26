import { useEffect, useMemo, useState } from "react";
import {
  applyRecipeToMenu,
  archiveRecipe,
  createRecipe,
  listRecipes,
  previewRecipe,
  updateRecipe,
  type Recipe,
  type RecipeIngredient,
  type RecipePayload,
  type RecipeTotals,
} from "../../api/recipes";
import { listStock, type StockItem } from "../../api/stock";
import { listItems, type MenuItem } from "../../api/menu";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { PageHeader } from "../../components/ui/PageHeader";
import { EmptyState } from "../../components/ui/EmptyState";
import { SkeletonRows } from "../../components/ui/Skeleton";

/** Local-only draft shape — looser typing than {@link RecipePayload} so
 *  the form can hold partially-typed strings while the user edits. */
type LineDraft = {
  stockItemId: string;
  quantity: string;
  unit: string;
  wastePct: string;
  note: string;
};

type Draft = {
  id?: string;
  name: string;
  menuItemId: string;
  yieldQuantity: string;
  yieldUnit: string;
  targetFoodCostPct: string;
  vatRatePct: string;
  wastePct: string;
  notes: string;
  active: boolean;
  ingredients: LineDraft[];
};

const EMPTY_DRAFT: Draft = {
  name: "",
  menuItemId: "",
  yieldQuantity: "1",
  yieldUnit: "piece",
  targetFoodCostPct: "30",
  vatRatePct: "8",
  wastePct: "",
  notes: "",
  active: true,
  ingredients: [],
};

function blankLine(unit = "kg"): LineDraft {
  return { stockItemId: "", quantity: "", unit, wastePct: "", note: "" };
}

/** Translate the draft state into the payload shape the API expects.
 *  Empty strings become null; numbers are parsed defensively. */
function toPayload(draft: Draft): RecipePayload {
  const num = (s: string) => {
    if (s == null || s.trim() === "") return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
  };
  return {
    name: draft.name.trim(),
    menuItemId: draft.menuItemId || null,
    yieldQuantity: num(draft.yieldQuantity) ?? 1,
    yieldUnit: draft.yieldUnit.trim() || "piece",
    targetFoodCostPct: num(draft.targetFoodCostPct) ?? null,
    vatRatePct: num(draft.vatRatePct) ?? 8,
    wastePct: num(draft.wastePct) ?? null,
    notes: draft.notes.trim() || null,
    active: draft.active,
    ingredients: draft.ingredients
      .filter((l) => l.stockItemId && l.quantity)
      .map((l) => ({
        stockItemId: l.stockItemId,
        quantity: Number(l.quantity) || 0,
        unit: l.unit.trim() || "pcs",
        wastePct: num(l.wastePct) ?? null,
        note: l.note.trim() || null,
      })),
  };
}

function recipeToDraft(recipe: Recipe, lines: RecipeIngredient[]): Draft {
  return {
    id: recipe.id,
    name: recipe.name,
    menuItemId: recipe.menuItemId ?? "",
    yieldQuantity: String(recipe.yieldQuantity ?? 1),
    yieldUnit: recipe.yieldUnit ?? "piece",
    targetFoodCostPct: recipe.targetFoodCostPct == null
      ? ""
      : String(recipe.targetFoodCostPct),
    vatRatePct: String(recipe.vatRatePct ?? 8),
    wastePct: recipe.wastePct == null ? "" : String(recipe.wastePct),
    notes: recipe.notes ?? "",
    active: recipe.active,
    ingredients: lines.map((l) => ({
      stockItemId: l.stockItemId,
      quantity: String(l.quantity ?? ""),
      unit: l.unit ?? "kg",
      wastePct: l.wastePct == null ? "" : String(l.wastePct),
      note: l.note ?? "",
    })),
  };
}

function fmtMoney(n: number | null | undefined, fallback = "—") {
  if (n == null) return fallback;
  return n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtPct(n: number | null | undefined, fallback = "—") {
  if (n == null) return fallback;
  return `${n.toFixed(1)} %`;
}

export function AdminRecipes() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);

  // Live preview totals — debounced behind a 250ms timer so we don't
  // hammer the backend on every keystroke. Initial render of the modal
  // also seeds these from the freshly-loaded recipe so the numbers are
  // there before the first keystroke.
  const [previewTotals, setPreviewTotals] = useState<RecipeTotals | null>(null);
  const [previewLines, setPreviewLines] = useState<RecipeIngredient[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [r, s, m] = await Promise.all([
        listRecipes(includeInactive),
        listStock(),
        listItems({ includeArchived: false }),
      ]);
      setRecipes(r);
      setStockItems(s);
      setMenuItems(m);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeInactive]);

  // Debounced live preview. We only ping the backend if the draft has
  // at least one ingredient with a stock + quantity — otherwise the
  // result is trivially zero and the round trip is wasted.
  useEffect(() => {
    if (!draft) return;
    const hasContent = draft.ingredients.some((l) => l.stockItemId && l.quantity);
    if (!hasContent) {
      setPreviewTotals({
        totalCost: 0,
        costPerUnit: null,
        suggestedSellPrice: null,
        achievedFoodCostPct: null,
        contributionMargin: null,
        marginPct: null,
        someIngredientsMissingCost: false,
      });
      setPreviewLines([]);
      return;
    }
    setPreviewLoading(true);
    const handle = window.setTimeout(async () => {
      try {
        const result = await previewRecipe(toPayload(draft));
        setPreviewTotals(result.totals);
        setPreviewLines(result.lines);
      } catch {
        // Preview is best-effort — keep the last known good numbers if
        // a request fails (typically transient network blips).
      } finally {
        setPreviewLoading(false);
      }
    }, 250);
    return () => window.clearTimeout(handle);
  }, [draft]);

  const openCreate = () => {
    setErr("");
    setMsg("");
    setDraft({ ...EMPTY_DRAFT, ingredients: [blankLine()] });
    setPreviewTotals(null);
    setPreviewLines([]);
  };

  const openEdit = async (r: Recipe) => {
    setErr("");
    setMsg("");
    try {
      // The list response is "lite" — fetch full detail to get lines.
      const full = await import("../../api/recipes").then((m) => m.getRecipe(r.id));
      const next = recipeToDraft(full, full.lines ?? []);
      setDraft(next);
      setPreviewTotals(full.totals);
      setPreviewLines(full.lines ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to open recipe");
    }
  };

  const closeDraft = () => {
    setDraft(null);
    setPreviewTotals(null);
    setPreviewLines([]);
  };

  const updateDraft = (patch: Partial<Draft>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  };
  const updateLine = (idx: number, patch: Partial<LineDraft>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = [...prev.ingredients];
      next[idx] = { ...next[idx], ...patch };
      return { ...prev, ingredients: next };
    });
  };
  const removeLine = (idx: number) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return { ...prev, ingredients: prev.ingredients.filter((_, i) => i !== idx) };
    });
  };
  const addLine = () => {
    setDraft((prev) => {
      if (!prev) return prev;
      return { ...prev, ingredients: [...prev.ingredients, blankLine()] };
    });
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      setErr("Name is required");
      return;
    }
    const payload = toPayload(draft);
    setSaving(true);
    setErr("");
    try {
      const saved = draft.id
        ? await updateRecipe(draft.id, payload)
        : await createRecipe(payload);
      setMsg(`${saved.name} saved.`);
      closeDraft();
      await loadAll();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const applyToMenu = async (applyPrice: boolean) => {
    if (!draft?.id) return;
    setApplying(true);
    setErr("");
    try {
      const saved = await applyRecipeToMenu(draft.id, applyPrice);
      setMsg(
        applyPrice
          ? `Cost and suggested price pushed to ${saved.menuItemName ?? "menu item"}.`
          : `Food cost pushed to ${saved.menuItemName ?? "menu item"}.`,
      );
      // Refresh the linked menu item snapshot in the open draft.
      setDraft((prev) =>
        prev ? recipeToDraft(saved, saved.lines ?? []) : prev,
      );
      await loadAll();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Apply failed");
    } finally {
      setApplying(false);
    }
  };

  const archive = async (r: Recipe) => {
    if (!confirm(`Archive "${r.name}"? You can still see it by toggling "Include archived".`)) return;
    setErr("");
    try {
      await archiveRecipe(r.id);
      setMsg(`${r.name} archived.`);
      await loadAll();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Archive failed");
    }
  };

  const stockOptions = useMemo(
    () =>
      stockItems
        .filter((s) => s.active)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [stockItems],
  );
  const menuOptions = useMemo(
    () =>
      menuItems
        .filter((m) => m.active)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [menuItems],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Operations"
        title="Recipes"
        subtitle="Build cost cards from your stock items, get suggested sales prices, and push the result onto the menu."
        action={<Button onClick={openCreate}>+ New recipe</Button>}
      />

      <div className="page-toolbar">
        <label className="inline-flex items-center gap-2 text-xs text-[var(--color-muted)]">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
            className="h-4 w-4 rounded border-black/30 text-[var(--color-saffron)] focus:ring-[var(--color-saffron)]"
          />
          Include archived
        </label>
      </div>

      {loadError && <Alert variant="error">{loadError}</Alert>}
      {msg && <Alert variant="success">{msg}</Alert>}
      {err && !draft && <Alert variant="error">{err}</Alert>}

      {loading ? (
        <Card><SkeletonRows count={5} /></Card>
      ) : recipes.length === 0 ? (
        <EmptyState
          title="No recipes yet"
          description="Build your first cost card to see suggested sales prices."
          action={<Button onClick={openCreate}>+ New recipe</Button>}
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--color-muted)] border-b border-black/[0.06]">
                  <th className="py-2 pr-4">Recipe</th>
                  <th className="py-2 pr-4">Yield</th>
                  <th className="py-2 pr-4 text-right">Cost / unit</th>
                  <th className="py-2 pr-4 text-right">Target FC %</th>
                  <th className="py-2 pr-4 text-right">Suggested price</th>
                  <th className="py-2 pr-4 text-right">Margin</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {recipes.map((r) => {
                  const t = r.totals;
                  return (
                    <tr key={r.id} className="border-b border-black/[0.04] hover:bg-[var(--color-cream)]/40">
                      <td className="py-2 pr-4">
                        <div className="font-medium text-[var(--color-ink)] flex items-center gap-2">
                          {r.name}
                          {!r.active && (
                            <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-muted)] bg-black/[0.04] rounded px-1.5 py-0.5">
                              Archived
                            </span>
                          )}
                          {t.someIngredientsMissingCost && (
                            <span
                              className="text-[10px] uppercase tracking-wider font-semibold text-amber-700 bg-amber-100 rounded px-1.5 py-0.5"
                              title="One or more ingredients have no captured unit cost — totals are a lower bound."
                            >
                              Cost incomplete
                            </span>
                          )}
                        </div>
                        {r.menuItemName && (
                          <p className="text-xs text-[var(--color-muted)]">
                            → {r.menuItemName}
                            {r.menuItemSellPrice != null && (
                              <> · current {fmtMoney(r.menuItemSellPrice)} PLN</>
                            )}
                          </p>
                        )}
                      </td>
                      <td className="py-2 pr-4 whitespace-nowrap text-[var(--color-muted)]">
                        {Number(r.yieldQuantity).toLocaleString("pl-PL")} {r.yieldUnit}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {fmtMoney(t.costPerUnit)}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums text-[var(--color-muted)]">
                        {r.targetFoodCostPct == null
                          ? "—"
                          : `${Number(r.targetFoodCostPct).toFixed(1)} %`}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums font-medium">
                        {fmtMoney(t.suggestedSellPrice)}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums text-[var(--color-muted)]">
                        {fmtPct(t.marginPct)}
                      </td>
                      <td className="py-2 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openEdit(r)}
                          className="text-sm text-[var(--color-ink)] hover:underline"
                        >
                          Open
                        </button>
                        {r.active && (
                          <>
                            <span className="text-[var(--color-muted)] mx-2">·</span>
                            <button
                              type="button"
                              onClick={() => archive(r)}
                              className="text-sm text-red-700 hover:underline"
                            >
                              Archive
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
        </Card>
      )}

      {draft && (
        <RecipeEditor
          draft={draft}
          previewTotals={previewTotals}
          previewLines={previewLines}
          previewLoading={previewLoading}
          saving={saving}
          applying={applying}
          stockOptions={stockOptions}
          menuOptions={menuOptions}
          error={err}
          onChange={updateDraft}
          onLineChange={updateLine}
          onLineRemove={removeLine}
          onLineAdd={addLine}
          onSave={save}
          onApplyToMenu={applyToMenu}
          onClose={closeDraft}
        />
      )}
    </div>
  );
}

// ============================================================================
// Editor / preview modal
// ============================================================================

function RecipeEditor({
  draft,
  previewTotals,
  previewLines,
  previewLoading,
  saving,
  applying,
  stockOptions,
  menuOptions,
  error,
  onChange,
  onLineChange,
  onLineRemove,
  onLineAdd,
  onSave,
  onApplyToMenu,
  onClose,
}: {
  draft: Draft;
  previewTotals: RecipeTotals | null;
  previewLines: RecipeIngredient[];
  previewLoading: boolean;
  saving: boolean;
  applying: boolean;
  stockOptions: StockItem[];
  menuOptions: MenuItem[];
  error: string;
  onChange: (patch: Partial<Draft>) => void;
  onLineChange: (idx: number, patch: Partial<LineDraft>) => void;
  onLineRemove: (idx: number) => void;
  onLineAdd: () => void;
  onSave: () => void;
  onApplyToMenu: (applyPrice: boolean) => void;
  onClose: () => void;
}) {
  const linkedMenu = useMemo(
    () => menuOptions.find((m) => m.id === draft.menuItemId) ?? null,
    [menuOptions, draft.menuItemId],
  );

  const stockById = useMemo(() => {
    const map = new Map<string, StockItem>();
    for (const s of stockOptions) map.set(s.id, s);
    return map;
  }, [stockOptions]);

  // Indexed by stockItemId so we can show the live line cost next to
  // each row without making the form reach back into preview state.
  const linePreviewByStock = useMemo(() => {
    const map = new Map<string, RecipeIngredient>();
    for (const p of previewLines) {
      if (p.stockItemId) map.set(p.stockItemId, p);
    }
    return map;
  }, [previewLines]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-stretch justify-center bg-black/50 p-0 md:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white w-full md:max-w-5xl max-h-[100vh] md:max-h-[94vh] overflow-hidden flex flex-col md:rounded-2xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-black/[0.06] bg-white flex items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-saffron-dark)]">
              {draft.id ? "Edit recipe" : "New recipe"}
            </p>
            <input
              value={draft.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="e.g. Lamb saffron dumplings"
              className="text-lg font-semibold bg-transparent border-0 outline-none focus:ring-0 px-0 mt-0.5 w-72"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-[var(--color-cream)] text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_320px] overflow-hidden">
          <div className="overflow-y-auto px-5 py-4 space-y-5">
            {error && <Alert variant="error">{error}</Alert>}

            {/* ── Recipe meta ─────────────────────────── */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Field label="Yield" hint="how many units the recipe produces">
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={draft.yieldQuantity}
                    onChange={(e) => onChange({ yieldQuantity: e.target.value })}
                    className="field-input w-full"
                  />
                  <input
                    value={draft.yieldUnit}
                    onChange={(e) => onChange({ yieldUnit: e.target.value })}
                    className="field-input w-24"
                    placeholder="piece"
                  />
                </div>
              </Field>
              <Field label="Target food cost %" hint="usually 25–35 %">
                <input
                  type="number"
                  min={1}
                  max={99}
                  step={0.5}
                  value={draft.targetFoodCostPct}
                  onChange={(e) => onChange({ targetFoodCostPct: e.target.value })}
                  className="field-input w-full"
                />
              </Field>
              <Field label="VAT %" hint="PL food = 8, drinks = 23">
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={draft.vatRatePct}
                  onChange={(e) => onChange({ vatRatePct: e.target.value })}
                  className="field-input w-full"
                />
              </Field>
              <Field label="Default waste %" hint="optional fallback for all lines">
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  placeholder="—"
                  value={draft.wastePct}
                  onChange={(e) => onChange({ wastePct: e.target.value })}
                  className="field-input w-full"
                />
              </Field>
            </section>

            <Field label="Linked menu item" hint="Optional. Required only to push cost/price to the live menu.">
              <select
                value={draft.menuItemId}
                onChange={(e) => onChange({ menuItemId: e.target.value })}
                className="field-input w-full"
              >
                <option value="">— none —</option>
                {menuOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.sellPrice != null ? ` · ${fmtMoney(m.sellPrice)} PLN` : ""}
                  </option>
                ))}
              </select>
            </Field>

            {/* ── Ingredient list ──────────────────────── */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">
                  Ingredients
                </h4>
                <button
                  type="button"
                  onClick={onLineAdd}
                  className="text-xs font-medium text-[var(--color-saffron-dark)] hover:underline"
                >
                  + Add ingredient
                </button>
              </div>

              {draft.ingredients.length === 0 ? (
                <p className="text-sm text-[var(--color-muted)] py-4 text-center border border-dashed border-black/[0.08] rounded-lg">
                  Add your first ingredient to see the cost breakdown.
                </p>
              ) : (
                <div className="space-y-2">
                  {draft.ingredients.map((line, idx) => {
                    const stock = stockById.get(line.stockItemId);
                    const linePreview = linePreviewByStock.get(line.stockItemId);
                    const missingCost = stock != null && stock.unitCost == null;
                    return (
                      <div
                        key={idx}
                        className={`rounded-lg border px-3 py-2 ${
                          missingCost
                            ? "border-amber-200/70 bg-amber-50/30"
                            : "border-black/[0.06]"
                        }`}
                      >
                        <div className="grid grid-cols-12 gap-2 items-start">
                          <div className="col-span-12 md:col-span-5">
                            <select
                              value={line.stockItemId}
                              onChange={(e) => {
                                const sid = e.target.value;
                                const s = stockById.get(sid);
                                onLineChange(idx, {
                                  stockItemId: sid,
                                  // Default the line unit to the stock
                                  // item's unit so the math is consistent
                                  // out of the gate.
                                  unit: s ? s.unit : line.unit,
                                });
                              }}
                              className="field-input w-full"
                            >
                              <option value="">— pick ingredient —</option>
                              {stockOptions.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                  {s.unitCost != null
                                    ? ` (${fmtMoney(s.unitCost)} / ${s.unit})`
                                    : " (no cost)"}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="col-span-5 md:col-span-2">
                            <input
                              type="number"
                              min={0}
                              step={0.001}
                              value={line.quantity}
                              onChange={(e) => onLineChange(idx, { quantity: e.target.value })}
                              placeholder="qty"
                              className="field-input w-full text-right tabular-nums"
                            />
                          </div>
                          <div className="col-span-3 md:col-span-1">
                            <input
                              value={line.unit}
                              onChange={(e) => onLineChange(idx, { unit: e.target.value })}
                              placeholder="kg"
                              className="field-input w-full"
                            />
                          </div>
                          <div className="col-span-2 md:col-span-2">
                            <input
                              type="number"
                              min={0}
                              step={0.5}
                              value={line.wastePct}
                              onChange={(e) => onLineChange(idx, { wastePct: e.target.value })}
                              placeholder="waste %"
                              className="field-input w-full text-right tabular-nums text-[var(--color-muted)]"
                              title="Optional per-line waste percentage (overrides default)"
                            />
                          </div>
                          <div className="col-span-12 md:col-span-2 flex items-center justify-between gap-2 text-xs">
                            <span className="tabular-nums text-[var(--color-ink)] font-medium">
                              {linePreview?.lineCost != null
                                ? `${fmtMoney(linePreview.lineCost)} PLN`
                                : "—"}
                            </span>
                            <button
                              type="button"
                              onClick={() => onLineRemove(idx)}
                              className="text-red-700 hover:underline text-xs"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                        {(missingCost || linePreview?.shareOfTotalPct != null) && (
                          <p className="text-[11px] text-[var(--color-muted)] mt-1.5">
                            {missingCost && (
                              <span className="text-amber-700 font-medium mr-2">
                                ⚠ No unit cost captured for {stock?.name ?? "this item"}.
                              </span>
                            )}
                            {linePreview?.shareOfTotalPct != null && (
                              <>{linePreview.shareOfTotalPct.toFixed(1)} % of recipe cost</>
                            )}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <Field label="Notes" hint="Prep instructions, allergen call-outs, etc.">
              <textarea
                value={draft.notes}
                onChange={(e) => onChange({ notes: e.target.value })}
                rows={2}
                className="field-input w-full"
              />
            </Field>
          </div>

          {/* ── Live preview sidebar ──────────────────── */}
          <aside className="border-t md:border-t-0 md:border-l border-black/[0.06] bg-[var(--color-cream)]/30 overflow-y-auto">
            <div className="px-5 py-4 space-y-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">
                  Cost breakdown
                </p>
                {previewLoading && (
                  <p className="text-[10px] text-[var(--color-muted)] mt-0.5">Updating…</p>
                )}
              </div>

              <Stat
                label="Total ingredient cost"
                value={previewTotals?.totalCost != null
                  ? `${fmtMoney(previewTotals.totalCost)} PLN`
                  : "—"}
              />
              <Stat
                label={`Cost per ${draft.yieldUnit || "unit"}`}
                value={previewTotals?.costPerUnit != null
                  ? `${fmtMoney(previewTotals.costPerUnit)} PLN`
                  : "—"}
                highlight
              />
              <div className="h-px bg-black/[0.06] my-1" />

              <Stat
                label="Suggested sell price"
                value={previewTotals?.suggestedSellPrice != null
                  ? `${fmtMoney(previewTotals.suggestedSellPrice)} PLN`
                  : "—"}
                highlight
                tone="saffron"
              />
              <Stat
                label="Achieved food cost"
                value={fmtPct(previewTotals?.achievedFoodCostPct)}
              />
              <Stat
                label="Contribution / unit"
                value={previewTotals?.contributionMargin != null
                  ? `${fmtMoney(previewTotals.contributionMargin)} PLN`
                  : "—"}
              />
              <Stat label="Margin %" value={fmtPct(previewTotals?.marginPct)} />

              {previewTotals?.someIngredientsMissingCost && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
                  Some ingredients have no captured unit cost. Totals below are a
                  lower bound — fill in stock costs to make the suggestion accurate.
                </p>
              )}

              {linkedMenu && (
                <div className="border-t border-black/[0.06] pt-3 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">
                    Linked menu item
                  </p>
                  <p className="text-sm font-medium">{linkedMenu.name}</p>
                  <div className="text-xs text-[var(--color-muted)] space-y-0.5">
                    <p>
                      Current price:{" "}
                      <span className="text-[var(--color-ink)] tabular-nums">
                        {fmtMoney(linkedMenu.sellPrice)} PLN
                      </span>
                    </p>
                    <p>
                      Current food cost:{" "}
                      <span className="text-[var(--color-ink)] tabular-nums">
                        {fmtMoney(linkedMenu.foodCost)} PLN
                      </span>
                    </p>
                  </div>
                  {draft.id && (
                    <div className="flex flex-col gap-1.5 pt-1">
                      <Button
                        variant="secondary"
                        className="!py-1.5 !text-xs"
                        disabled={applying}
                        onClick={() => onApplyToMenu(false)}
                      >
                        Push food cost only
                      </Button>
                      <Button
                        className="!py-1.5 !text-xs"
                        disabled={applying || previewTotals?.suggestedSellPrice == null}
                        onClick={() => onApplyToMenu(true)}
                      >
                        {applying ? "Applying…" : "Push cost + suggested price"}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-black/5 px-5 py-3 bg-white">
          <label className="inline-flex items-center gap-2 text-xs text-[var(--color-muted)]">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => onChange({ active: e.target.checked })}
              className="h-4 w-4 rounded border-black/30 text-[var(--color-saffron)]"
            />
            Active
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-md border border-black/15 bg-white px-3 py-1.5 text-sm hover:bg-black/5 disabled:opacity-50"
            >
              Cancel
            </button>
            <Button onClick={onSave} disabled={saving}>
              {saving ? "Saving…" : draft.id ? "Save changes" : "Create recipe"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Tiny presentational helpers (kept in-file so they evolve with the page)
// ============================================================================

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-[var(--color-muted)] mb-1">
        {label}
      </span>
      {children}
      {hint && (
        <span className="block text-[10px] text-[var(--color-muted)] mt-0.5">{hint}</span>
      )}
    </label>
  );
}

function Stat({
  label,
  value,
  highlight,
  tone,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  tone?: "saffron";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-[var(--color-muted)]">{label}</span>
      <span
        className={`tabular-nums ${
          highlight
            ? `text-sm font-semibold ${tone === "saffron" ? "text-[var(--color-saffron-dark)]" : "text-[var(--color-ink)]"}`
            : "text-sm text-[var(--color-ink)]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
