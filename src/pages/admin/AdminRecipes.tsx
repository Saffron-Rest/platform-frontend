import { useEffect, useMemo, useState } from "react";
import {
  applyRecipeToMenu,
  archiveRecipe,
  createRecipe,
  getRecipe,
  getRecipeHistory,
  listRecipes,
  previewRecipe,
  updateRecipe,
  type Recipe,
  type RecipeHealth,
  type RecipeIngredient,
  type RecipePayload,
  type RecipeScenario,
  type RecipeSnapshot,
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

/* ---------------------------------------------------------------- */
/* Draft state — looser typing than the API payload so the form can */
/* hold partially-typed strings while the user edits.               */
/* ---------------------------------------------------------------- */

type LineSource = "STOCK" | "RECIPE";

type LineDraft = {
  source: LineSource;
  /** Filled when {@code source === "STOCK"}. */
  stockItemId: string;
  /** Filled when {@code source === "RECIPE"}. */
  subRecipeId: string;
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
  targetPrimeCostPct: string;
  vatRatePct: string;
  wastePct: string;
  laborMinutesPerUnit: string;
  laborRatePerHour: string;
  packagingCostPerUnit: string;
  overheadPct: string;
  minMarginPct: string;
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
  targetPrimeCostPct: "",
  vatRatePct: "8",
  wastePct: "",
  laborMinutesPerUnit: "",
  laborRatePerHour: "",
  packagingCostPerUnit: "",
  overheadPct: "",
  minMarginPct: "",
  notes: "",
  active: true,
  ingredients: [],
};

function blankLine(unit = "kg"): LineDraft {
  return {
    source: "STOCK",
    stockItemId: "",
    subRecipeId: "",
    quantity: "",
    unit,
    wastePct: "",
    note: "",
  };
}

const num = (s: string): number | undefined => {
  if (s == null || s.trim() === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};

/** Build the API payload from a draft. Empty inputs become null, except
 *  for {@code yieldQuantity} / {@code yieldUnit} which carry a sensible
 *  default so the math never divides by zero. */
function toPayload(draft: Draft): RecipePayload {
  return {
    name: draft.name.trim(),
    menuItemId: draft.menuItemId || null,
    yieldQuantity: num(draft.yieldQuantity) ?? 1,
    yieldUnit: draft.yieldUnit.trim() || "piece",
    targetFoodCostPct: num(draft.targetFoodCostPct) ?? null,
    targetPrimeCostPct: num(draft.targetPrimeCostPct) ?? null,
    vatRatePct: num(draft.vatRatePct) ?? 8,
    wastePct: num(draft.wastePct) ?? null,
    laborMinutesPerUnit: num(draft.laborMinutesPerUnit) ?? null,
    laborRatePerHour: num(draft.laborRatePerHour) ?? null,
    packagingCostPerUnit: num(draft.packagingCostPerUnit) ?? null,
    overheadPct: num(draft.overheadPct) ?? null,
    minMarginPct: num(draft.minMarginPct) ?? null,
    notes: draft.notes.trim() || null,
    active: draft.active,
    ingredients: draft.ingredients
      .filter((l) =>
        l.source === "STOCK" ? !!l.stockItemId : !!l.subRecipeId,
      )
      .map((l) => ({
        stockItemId: l.source === "STOCK" ? l.stockItemId : null,
        subRecipeId: l.source === "RECIPE" ? l.subRecipeId : null,
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
    targetFoodCostPct:
      recipe.targetFoodCostPct == null ? "" : String(recipe.targetFoodCostPct),
    targetPrimeCostPct:
      recipe.targetPrimeCostPct == null ? "" : String(recipe.targetPrimeCostPct),
    vatRatePct: String(recipe.vatRatePct ?? 8),
    wastePct: recipe.wastePct == null ? "" : String(recipe.wastePct),
    laborMinutesPerUnit:
      recipe.laborMinutesPerUnit == null ? "" : String(recipe.laborMinutesPerUnit),
    laborRatePerHour:
      recipe.laborRatePerHour == null ? "" : String(recipe.laborRatePerHour),
    packagingCostPerUnit:
      recipe.packagingCostPerUnit == null ? "" : String(recipe.packagingCostPerUnit),
    overheadPct: recipe.overheadPct == null ? "" : String(recipe.overheadPct),
    minMarginPct: recipe.minMarginPct == null ? "" : String(recipe.minMarginPct),
    notes: recipe.notes ?? "",
    active: recipe.active,
    ingredients: lines.map((l) => ({
      source: l.subRecipeId ? "RECIPE" : "STOCK",
      stockItemId: l.stockItemId ?? "",
      subRecipeId: l.subRecipeId ?? "",
      quantity: String(l.quantity ?? ""),
      unit: l.unit ?? "kg",
      wastePct: l.wastePct == null ? "" : String(l.wastePct),
      note: l.note ?? "",
    })),
  };
}

function fmtMoney(n: number | null | undefined, fallback = "—") {
  if (n == null) return fallback;
  return n.toLocaleString("pl-PL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
function fmtPct(n: number | null | undefined, fallback = "—") {
  if (n == null) return fallback;
  return `${Number(n).toFixed(1)} %`;
}
function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pl-PL", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const EMPTY_TOTALS: RecipeTotals = {
  foodCost: 0,
  foodCostPerUnit: null,
  laborCostPerUnit: null,
  packagingCostPerUnit: null,
  primeCostPerUnit: null,
  overheadCostPerUnit: null,
  fullyLoadedCostPerUnit: null,
  costPerUnit: null,
  suggestedSellPrice: null,
  breakEvenPrice: null,
  achievedFoodCostPct: null,
  achievedPrimeCostPct: null,
  contributionMargin: null,
  marginPct: null,
  someIngredientsMissingCost: false,
  someConversionsMissing: false,
  cycleDetected: false,
  dominantLineSharePct: null,
};
const EMPTY_HEALTH: RecipeHealth = {
  status: "GOOD",
  issues: [{ severity: "info", code: "empty", message: "Start adding ingredients." }],
};

/* ---------------------------------------------------------------- */
/* Page                                                             */
/* ---------------------------------------------------------------- */

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

  const [previewTotals, setPreviewTotals] = useState<RecipeTotals | null>(null);
  const [previewLines, setPreviewLines] = useState<RecipeIngredient[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewScenarios, setPreviewScenarios] = useState<RecipeScenario[]>([]);
  const [previewHealth, setPreviewHealth] = useState<RecipeHealth | null>(null);

  const [history, setHistory] = useState<RecipeSnapshot[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

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

  /* Debounced preview — only round-trips when the draft has at least
   * one line with a source picked, otherwise the result is trivially
   * zero. */
  useEffect(() => {
    if (!draft) return;
    const hasContent = draft.ingredients.some((l) =>
      l.source === "STOCK" ? !!l.stockItemId : !!l.subRecipeId,
    );
    if (!hasContent) {
      setPreviewTotals(EMPTY_TOTALS);
      setPreviewLines([]);
      setPreviewScenarios([]);
      setPreviewHealth(EMPTY_HEALTH);
      return;
    }
    setPreviewLoading(true);
    const handle = window.setTimeout(async () => {
      try {
        const result = await previewRecipe(toPayload(draft));
        setPreviewTotals(result.totals);
        setPreviewLines(result.lines);
        setPreviewScenarios(result.scenarios ?? []);
        setPreviewHealth(result.health ?? null);
      } catch {
        /* Best effort — keep the last known good numbers. */
      } finally {
        setPreviewLoading(false);
      }
    }, 250);
    return () => window.clearTimeout(handle);
  }, [draft]);

  /* History fetch — only when an existing recipe is opened, refreshed
   * on each save. */
  const refreshHistory = async (id: string) => {
    setHistoryLoading(true);
    try {
      setHistory(await getRecipeHistory(id));
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const openCreate = () => {
    setErr("");
    setMsg("");
    setDraft({ ...EMPTY_DRAFT, ingredients: [blankLine()] });
    setPreviewTotals(null);
    setPreviewLines([]);
    setHistory([]);
  };

  const openEdit = async (r: Recipe) => {
    setErr("");
    setMsg("");
    try {
      const full = await getRecipe(r.id);
      const next = recipeToDraft(full, full.lines ?? []);
      setDraft(next);
      setPreviewTotals(full.totals);
      setPreviewLines(full.lines ?? []);
      setPreviewScenarios(full.scenarios ?? []);
      setPreviewHealth(full.health ?? null);
      refreshHistory(full.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to open recipe");
    }
  };

  const closeDraft = () => {
    setDraft(null);
    setPreviewTotals(null);
    setPreviewLines([]);
    setPreviewScenarios([]);
    setPreviewHealth(null);
    setHistory([]);
  };

  const updateDraft = (patch: Partial<Draft>) =>
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));

  const updateLine = (idx: number, patch: Partial<LineDraft>) =>
    setDraft((prev) => {
      if (!prev) return prev;
      const next = [...prev.ingredients];
      next[idx] = { ...next[idx], ...patch };
      return { ...prev, ingredients: next };
    });

  const removeLine = (idx: number) =>
    setDraft((prev) =>
      !prev
        ? prev
        : { ...prev, ingredients: prev.ingredients.filter((_, i) => i !== idx) },
    );

  const addLine = (source: LineSource = "STOCK") =>
    setDraft((prev) => {
      if (!prev) return prev;
      const fresh = blankLine();
      fresh.source = source;
      return { ...prev, ingredients: [...prev.ingredients, fresh] };
    });

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
      // Re-load history with the new snapshot row.
      refreshHistory(saved.id);
      // Keep the modal open with the persisted version so the user
      // can immediately see the new history & confirm.
      setDraft(recipeToDraft(saved, saved.lines ?? []));
      setPreviewTotals(saved.totals);
      setPreviewLines(saved.lines ?? []);
      setPreviewScenarios(saved.scenarios ?? []);
      setPreviewHealth(saved.health ?? null);
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
      setDraft(recipeToDraft(saved, saved.lines ?? []));
      setPreviewTotals(saved.totals);
      setPreviewLines(saved.lines ?? []);
      setPreviewScenarios(saved.scenarios ?? []);
      setPreviewHealth(saved.health ?? null);
      refreshHistory(saved.id);
      await loadAll();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Apply failed");
    } finally {
      setApplying(false);
    }
  };

  const archive = async (r: Recipe) => {
    if (
      !confirm(
        `Archive "${r.name}"? You can still see it by toggling "Include archived".`,
      )
    )
      return;
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
  const recipeOptions = useMemo(
    () =>
      recipes
        .filter((r) => r.active && (!draft?.id || r.id !== draft.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [recipes, draft?.id],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Operations"
        title="Recipes"
        subtitle="Cost cards with sub-recipes, labor, packaging, scenarios and price history. Build once, see the impact everywhere."
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
        <Card>
          <SkeletonRows count={5} />
        </Card>
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
                  <th className="py-2 pr-4 text-right">Food / unit</th>
                  <th className="py-2 pr-4 text-right">Prime / unit</th>
                  <th className="py-2 pr-4 text-right">Suggested</th>
                  <th className="py-2 pr-4 text-right">Margin</th>
                  <th className="py-2 pr-4">Health</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {recipes.map((r) => {
                  const t = r.totals;
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-black/[0.04] hover:bg-[var(--color-cream)]/40"
                    >
                      <td className="py-2 pr-4">
                        <div className="font-medium text-[var(--color-ink)] flex items-center gap-2">
                          {r.name}
                          {!r.active && (
                            <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-muted)] bg-black/[0.04] rounded px-1.5 py-0.5">
                              Archived
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
                        {Number(r.yieldQuantity).toLocaleString("pl-PL")}{" "}
                        {r.yieldUnit}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {fmtMoney(t.foodCostPerUnit)}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums text-[var(--color-muted)]">
                        {fmtMoney(t.primeCostPerUnit)}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums font-medium">
                        {fmtMoney(t.suggestedSellPrice)}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums text-[var(--color-muted)]">
                        {fmtPct(t.marginPct)}
                      </td>
                      <td className="py-2 pr-4">
                        <HealthDot status={r.health?.status ?? "GOOD"} compact />
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
          previewScenarios={previewScenarios}
          previewHealth={previewHealth}
          previewLoading={previewLoading}
          history={history}
          historyLoading={historyLoading}
          saving={saving}
          applying={applying}
          stockOptions={stockOptions}
          menuOptions={menuOptions}
          recipeOptions={recipeOptions}
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

/* ---------------------------------------------------------------- */
/* Editor / preview modal                                           */
/* ---------------------------------------------------------------- */

function RecipeEditor({
  draft,
  previewTotals,
  previewLines,
  previewScenarios,
  previewHealth,
  previewLoading,
  history,
  historyLoading,
  saving,
  applying,
  stockOptions,
  menuOptions,
  recipeOptions,
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
  previewScenarios: RecipeScenario[];
  previewHealth: RecipeHealth | null;
  previewLoading: boolean;
  history: RecipeSnapshot[];
  historyLoading: boolean;
  saving: boolean;
  applying: boolean;
  stockOptions: StockItem[];
  menuOptions: MenuItem[];
  recipeOptions: Recipe[];
  error: string;
  onChange: (patch: Partial<Draft>) => void;
  onLineChange: (idx: number, patch: Partial<LineDraft>) => void;
  onLineRemove: (idx: number) => void;
  onLineAdd: (source?: LineSource) => void;
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

  const recipeById = useMemo(() => {
    const map = new Map<string, Recipe>();
    for (const r of recipeOptions) map.set(r.id, r);
    return map;
  }, [recipeOptions]);

  // The server returns preview lines in the same order as the draft;
  // we therefore align them by index — much more robust than keying
  // by stockItemId now that sub-recipe lines exist.
  const previewByIdx = useMemo(() => {
    const map = new Map<number, RecipeIngredient>();
    previewLines.forEach((p, i) => map.set(i, p));
    return map;
  }, [previewLines]);

  const [rightTab, setRightTab] = useState<"breakdown" | "scenarios" | "history">(
    "breakdown",
  );

  return (
    <div
      className="fixed inset-0 z-[70] flex items-stretch justify-center bg-black/50 p-0 md:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white w-full md:max-w-6xl max-h-[100vh] md:max-h-[94vh] overflow-hidden flex flex-col md:rounded-2xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-black/[0.06] bg-white flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-saffron-dark)]">
              {draft.id ? "Edit recipe" : "New recipe"}
            </p>
            <input
              value={draft.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="e.g. Lamb saffron dumplings"
              className="text-lg font-semibold bg-transparent border-0 outline-none focus:ring-0 px-0 mt-0.5 w-72 max-w-full"
            />
          </div>
          {previewHealth && (
            <div className="hidden md:block">
              <HealthDot status={previewHealth.status} />
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-[var(--color-cream)] text-xl leading-none shrink-0"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_360px] overflow-hidden">
          <div className="overflow-y-auto px-5 py-4 space-y-5">
            {error && <Alert variant="error">{error}</Alert>}

            {/* ── Yield & targets ──────────────────────── */}
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
                  onChange={(e) =>
                    onChange({ targetFoodCostPct: e.target.value })
                  }
                  className="field-input w-full"
                />
              </Field>
              <Field
                label="Target prime cost %"
                hint="optional — overrides food cost target"
              >
                <input
                  type="number"
                  min={0}
                  max={99}
                  step={0.5}
                  value={draft.targetPrimeCostPct}
                  onChange={(e) =>
                    onChange({ targetPrimeCostPct: e.target.value })
                  }
                  placeholder="—"
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
            </section>

            <Field
              label="Linked menu item"
              hint="Optional. Required only to push cost/price to the live menu."
            >
              <select
                value={draft.menuItemId}
                onChange={(e) => onChange({ menuItemId: e.target.value })}
                className="field-input w-full"
              >
                <option value="">— none (prep / sub-recipe) —</option>
                {menuOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.sellPrice != null
                      ? ` · ${fmtMoney(m.sellPrice)} PLN`
                      : ""}
                  </option>
                ))}
              </select>
            </Field>

            {/* ── Labor / packaging / overhead ──────────── */}
            <details className="rounded-lg border border-black/[0.06] bg-[var(--color-cream)]/30">
              <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">
                Labor, packaging & overhead (optional)
              </summary>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 px-3 py-3">
                <Field label="Labor min / unit" hint="minutes of labor per yield unit">
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={draft.laborMinutesPerUnit}
                    onChange={(e) =>
                      onChange({ laborMinutesPerUnit: e.target.value })
                    }
                    placeholder="—"
                    className="field-input w-full"
                  />
                </Field>
                <Field
                  label="Labor rate / hour"
                  hint="PLN per labor-hour at this station"
                >
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={draft.laborRatePerHour}
                    onChange={(e) =>
                      onChange({ laborRatePerHour: e.target.value })
                    }
                    placeholder="—"
                    className="field-input w-full"
                  />
                </Field>
                <Field label="Packaging / unit" hint="disposable containers, lids, etc.">
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={draft.packagingCostPerUnit}
                    onChange={(e) =>
                      onChange({ packagingCostPerUnit: e.target.value })
                    }
                    placeholder="—"
                    className="field-input w-full"
                  />
                </Field>
                <Field label="Overhead %" hint="applied to prime cost (rent, utilities, …)">
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={draft.overheadPct}
                    onChange={(e) => onChange({ overheadPct: e.target.value })}
                    placeholder="—"
                    className="field-input w-full"
                  />
                </Field>
                <Field label="Min margin %" hint="health flag when projected margin drops below">
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={draft.minMarginPct}
                    onChange={(e) => onChange({ minMarginPct: e.target.value })}
                    placeholder="60"
                    className="field-input w-full"
                  />
                </Field>
                <Field label="Default waste %" hint="fallback for all lines">
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
              </div>
            </details>

            {/* ── Ingredient list ──────────────────────── */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">
                  Ingredients
                </h4>
                <div className="flex items-center gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => onLineAdd("STOCK")}
                    className="font-medium text-[var(--color-saffron-dark)] hover:underline"
                  >
                    + Stock item
                  </button>
                  <button
                    type="button"
                    onClick={() => onLineAdd("RECIPE")}
                    className="font-medium text-[var(--color-saffron-dark)] hover:underline disabled:opacity-50 disabled:no-underline"
                    disabled={recipeOptions.length === 0}
                    title={
                      recipeOptions.length === 0
                        ? "Create at least one other recipe first to nest it as a prep component."
                        : undefined
                    }
                  >
                    + Sub-recipe
                  </button>
                </div>
              </div>

              {draft.ingredients.length === 0 ? (
                <p className="text-sm text-[var(--color-muted)] py-4 text-center border border-dashed border-black/[0.08] rounded-lg">
                  Add your first ingredient to see the cost breakdown.
                </p>
              ) : (
                <div className="space-y-2">
                  {draft.ingredients.map((line, idx) => {
                    const linePreview = previewByIdx.get(idx);
                    const isStock = line.source === "STOCK";
                    const stock = isStock
                      ? stockById.get(line.stockItemId)
                      : undefined;
                    const sub = !isStock
                      ? recipeById.get(line.subRecipeId)
                      : undefined;
                    const missingCost =
                      linePreview?.missingCost ||
                      (isStock && stock != null && stock.unitCost == null);
                    const conversionWarn = linePreview?.conversionWarning;
                    return (
                      <div
                        key={idx}
                        className={`rounded-lg border px-3 py-2 ${
                          missingCost
                            ? "border-amber-200/70 bg-amber-50/30"
                            : conversionWarn
                              ? "border-orange-200/70 bg-orange-50/30"
                              : "border-black/[0.06]"
                        }`}
                      >
                        <div className="grid grid-cols-12 gap-2 items-start">
                          {/* Source toggle */}
                          <div className="col-span-12 md:col-span-2">
                            <div className="inline-flex rounded-md border border-black/[0.08] text-[11px] font-medium bg-white">
                              <button
                                type="button"
                                onClick={() =>
                                  onLineChange(idx, {
                                    source: "STOCK",
                                    subRecipeId: "",
                                  })
                                }
                                className={`px-2 py-1 ${
                                  isStock
                                    ? "bg-[var(--color-saffron)]/20 text-[var(--color-saffron-dark)]"
                                    : "text-[var(--color-muted)]"
                                }`}
                              >
                                Stock
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onLineChange(idx, {
                                    source: "RECIPE",
                                    stockItemId: "",
                                  })
                                }
                                className={`px-2 py-1 ${
                                  !isStock
                                    ? "bg-[var(--color-saffron)]/20 text-[var(--color-saffron-dark)]"
                                    : "text-[var(--color-muted)]"
                                }`}
                              >
                                Recipe
                              </button>
                            </div>
                          </div>
                          {/* Source picker */}
                          <div className="col-span-12 md:col-span-4">
                            {isStock ? (
                              <select
                                value={line.stockItemId}
                                onChange={(e) => {
                                  const sid = e.target.value;
                                  const s = stockById.get(sid);
                                  onLineChange(idx, {
                                    stockItemId: sid,
                                    unit: s ? s.unit : line.unit,
                                  });
                                }}
                                className="field-input w-full"
                              >
                                <option value="">— pick stock item —</option>
                                {stockOptions.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                    {s.unitCost != null
                                      ? ` (${fmtMoney(s.unitCost)} / ${s.unit})`
                                      : " (no cost)"}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <select
                                value={line.subRecipeId}
                                onChange={(e) => {
                                  const rid = e.target.value;
                                  const r = recipeById.get(rid);
                                  onLineChange(idx, {
                                    subRecipeId: rid,
                                    unit: r ? r.yieldUnit : line.unit,
                                  });
                                }}
                                className="field-input w-full"
                              >
                                <option value="">— pick sub-recipe —</option>
                                {recipeOptions.map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.name} ·{" "}
                                    {fmtMoney(r.totals?.foodCostPerUnit)} / {r.yieldUnit}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                          <div className="col-span-5 md:col-span-2">
                            <input
                              type="number"
                              min={0}
                              step={0.001}
                              value={line.quantity}
                              onChange={(e) =>
                                onLineChange(idx, { quantity: e.target.value })
                              }
                              placeholder="qty"
                              className="field-input w-full text-right tabular-nums"
                            />
                          </div>
                          <div className="col-span-3 md:col-span-1">
                            <input
                              value={line.unit}
                              onChange={(e) =>
                                onLineChange(idx, { unit: e.target.value })
                              }
                              placeholder="kg"
                              className="field-input w-full"
                            />
                          </div>
                          <div className="col-span-2 md:col-span-1">
                            <input
                              type="number"
                              min={0}
                              step={0.5}
                              value={line.wastePct}
                              onChange={(e) =>
                                onLineChange(idx, { wastePct: e.target.value })
                              }
                              placeholder="waste %"
                              className="field-input w-full text-right tabular-nums text-[var(--color-muted)]"
                              title="Per-line waste — overrides default"
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
                        {(missingCost ||
                          conversionWarn ||
                          linePreview?.shareOfTotalPct != null) && (
                          <p className="text-[11px] text-[var(--color-muted)] mt-1.5 space-y-0.5">
                            {missingCost && (
                              <span className="text-amber-700 font-medium mr-2">
                                ⚠ Missing cost
                                {isStock && stock
                                  ? ` for ${stock.name}.`
                                  : !isStock && sub
                                    ? ` — "${sub.name}" has no computed cost yet.`
                                    : "."}
                              </span>
                            )}
                            {conversionWarn && (
                              <span className="text-orange-700 font-medium mr-2">
                                ⚠ Couldn't convert {line.unit} →{" "}
                                {linePreview?.sourceUnit ?? "source unit"}; used
                                1:1 fallback.
                              </span>
                            )}
                            {linePreview?.shareOfTotalPct != null && (
                              <>{linePreview.shareOfTotalPct.toFixed(1)} % of food cost</>
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

          {/* ── Right pane: tabs ──────────────────── */}
          <aside className="border-t md:border-t-0 md:border-l border-black/[0.06] bg-[var(--color-cream)]/30 overflow-y-auto flex flex-col">
            <div className="flex border-b border-black/[0.06] bg-white">
              <RightTab
                active={rightTab === "breakdown"}
                onClick={() => setRightTab("breakdown")}
              >
                Breakdown
              </RightTab>
              <RightTab
                active={rightTab === "scenarios"}
                onClick={() => setRightTab("scenarios")}
              >
                Scenarios
              </RightTab>
              <RightTab
                active={rightTab === "history"}
                onClick={() => setRightTab("history")}
                disabled={!draft.id}
              >
                History
              </RightTab>
            </div>

            <div className="px-5 py-4 space-y-4 flex-1">
              {rightTab === "breakdown" && (
                <BreakdownPane
                  totals={previewTotals}
                  health={previewHealth}
                  yieldUnit={draft.yieldUnit}
                  loading={previewLoading}
                  linkedMenu={linkedMenu}
                  hasId={!!draft.id}
                  applying={applying}
                  onApplyToMenu={onApplyToMenu}
                />
              )}
              {rightTab === "scenarios" && (
                <ScenariosPane
                  scenarios={previewScenarios}
                  totals={previewTotals}
                />
              )}
              {rightTab === "history" && (
                <HistoryPane history={history} loading={historyLoading} />
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

/* ---------------------------------------------------------------- */
/* Right-pane panels                                                */
/* ---------------------------------------------------------------- */

function BreakdownPane({
  totals,
  health,
  yieldUnit,
  loading,
  linkedMenu,
  hasId,
  applying,
  onApplyToMenu,
}: {
  totals: RecipeTotals | null;
  health: RecipeHealth | null;
  yieldUnit: string;
  loading: boolean;
  linkedMenu: MenuItem | null;
  hasId: boolean;
  applying: boolean;
  onApplyToMenu: (applyPrice: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">
          Cost breakdown
        </p>
        {loading && (
          <p className="text-[10px] text-[var(--color-muted)] mt-0.5">Updating…</p>
        )}
      </div>

      <Stat
        label="Total food cost"
        value={
          totals?.foodCost != null ? `${fmtMoney(totals.foodCost)} PLN` : "—"
        }
      />
      <Stat
        label={`Food cost per ${yieldUnit || "unit"}`}
        value={
          totals?.foodCostPerUnit != null
            ? `${fmtMoney(totals.foodCostPerUnit)} PLN`
            : "—"
        }
        highlight
      />
      {(totals?.laborCostPerUnit ?? 0) > 0 && (
        <Stat
          label="Labor per unit"
          value={`${fmtMoney(totals?.laborCostPerUnit)} PLN`}
        />
      )}
      {(totals?.packagingCostPerUnit ?? 0) > 0 && (
        <Stat
          label="Packaging per unit"
          value={`${fmtMoney(totals?.packagingCostPerUnit)} PLN`}
        />
      )}
      {totals?.primeCostPerUnit != null &&
        ((totals.laborCostPerUnit ?? 0) > 0 ||
          (totals.packagingCostPerUnit ?? 0) > 0) && (
          <Stat
            label="Prime cost / unit"
            value={`${fmtMoney(totals.primeCostPerUnit)} PLN`}
            highlight
          />
        )}
      {(totals?.overheadCostPerUnit ?? 0) > 0 && (
        <Stat
          label="Overhead allocation"
          value={`${fmtMoney(totals?.overheadCostPerUnit)} PLN`}
        />
      )}
      {totals?.fullyLoadedCostPerUnit != null &&
        (totals.overheadCostPerUnit ?? 0) > 0 && (
          <Stat
            label="Fully loaded / unit"
            value={`${fmtMoney(totals.fullyLoadedCostPerUnit)} PLN`}
          />
        )}

      <div className="h-px bg-black/[0.06] my-1" />

      <Stat
        label="Suggested sell price"
        value={
          totals?.suggestedSellPrice != null
            ? `${fmtMoney(totals.suggestedSellPrice)} PLN`
            : "—"
        }
        highlight
        tone="saffron"
      />
      {totals?.breakEvenPrice != null && (
        <Stat
          label="Break-even price"
          value={`${fmtMoney(totals.breakEvenPrice)} PLN`}
        />
      )}
      <Stat label="Achieved food cost" value={fmtPct(totals?.achievedFoodCostPct)} />
      {totals?.achievedPrimeCostPct != null && (
        <Stat
          label="Achieved prime cost"
          value={fmtPct(totals.achievedPrimeCostPct)}
        />
      )}
      <Stat
        label="Contribution / unit"
        value={
          totals?.contributionMargin != null
            ? `${fmtMoney(totals.contributionMargin)} PLN`
            : "—"
        }
      />
      <Stat label="Margin %" value={fmtPct(totals?.marginPct)} />

      {/* ── Health issues ──────────────────────── */}
      {health && health.issues && health.issues.length > 0 && (
        <div className="rounded-lg border border-black/[0.06] bg-white p-3 space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">
            Diagnostics
          </p>
          {health.issues.map((issue, i) => (
            <p
              key={i}
              className={`text-[11px] leading-snug ${
                issue.severity === "error"
                  ? "text-red-700"
                  : issue.severity === "warning"
                    ? "text-amber-700"
                    : "text-[var(--color-muted)]"
              }`}
            >
              {issue.severity === "error"
                ? "✗ "
                : issue.severity === "warning"
                  ? "⚠ "
                  : "✓ "}
              {issue.message}
            </p>
          ))}
        </div>
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
            {totals?.suggestedSellPrice != null &&
              linkedMenu.sellPrice != null && (
                <p className="pt-1">
                  Suggested change:{" "}
                  <span
                    className={`tabular-nums font-medium ${
                      totals.suggestedSellPrice > linkedMenu.sellPrice
                        ? "text-emerald-700"
                        : totals.suggestedSellPrice < linkedMenu.sellPrice
                          ? "text-red-700"
                          : "text-[var(--color-muted)]"
                    }`}
                  >
                    {totals.suggestedSellPrice > linkedMenu.sellPrice
                      ? "+"
                      : ""}
                    {fmtMoney(
                      totals.suggestedSellPrice - linkedMenu.sellPrice,
                    )}{" "}
                    PLN
                  </span>
                </p>
              )}
          </div>
          {hasId && (
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
                disabled={applying || totals?.suggestedSellPrice == null}
                onClick={() => onApplyToMenu(true)}
              >
                {applying ? "Applying…" : "Push cost + suggested price"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ScenariosPane({
  scenarios,
  totals,
}: {
  scenarios: RecipeScenario[];
  totals: RecipeTotals | null;
}) {
  if (!scenarios || scenarios.length === 0) {
    return (
      <p className="text-sm text-[var(--color-muted)]">
        Pick at least one ingredient with a known cost to see price scenarios.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">
          Suggested price at different targets
        </p>
        <p className="text-[11px] text-[var(--color-muted)] mt-0.5">
          Based on food cost per unit of{" "}
          <span className="tabular-nums text-[var(--color-ink)]">
            {fmtMoney(totals?.foodCostPerUnit)} PLN
          </span>
          .
        </p>
      </div>
      <table className="w-full text-xs">
        <thead className="text-[var(--color-muted)]">
          <tr className="border-b border-black/[0.06]">
            <th className="py-1.5 text-left font-medium">Target FC %</th>
            <th className="py-1.5 text-right font-medium">Sell price</th>
            <th className="py-1.5 text-right font-medium">Margin</th>
          </tr>
        </thead>
        <tbody>
          {scenarios.map((s) => (
            <tr
              key={String(s.targetFoodCostPct)}
              className={`border-b border-black/[0.04] ${
                s.isCurrent ? "bg-[var(--color-saffron)]/10" : ""
              }`}
            >
              <td className="py-1.5">
                {Number(s.targetFoodCostPct).toFixed(0)} %
                {s.isCurrent && (
                  <span className="ml-1 text-[10px] uppercase tracking-wider font-semibold text-[var(--color-saffron-dark)]">
                    current
                  </span>
                )}
              </td>
              <td className="py-1.5 text-right tabular-nums">
                {s.suggestedSellPrice != null
                  ? `${fmtMoney(s.suggestedSellPrice)} PLN`
                  : "—"}
              </td>
              <td className="py-1.5 text-right tabular-nums text-[var(--color-muted)]">
                {fmtPct(s.marginPct)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HistoryPane({
  history,
  loading,
}: {
  history: RecipeSnapshot[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <p className="text-sm text-[var(--color-muted)]">Loading history…</p>
    );
  }
  if (!history || history.length === 0) {
    return (
      <p className="text-sm text-[var(--color-muted)]">
        No snapshots yet. Each save and each "apply to menu" appends one row
        here so you can track cost drift over time.
      </p>
    );
  }
  return (
    <div className="space-y-2 text-xs">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">
        Cost & price snapshots
      </p>
      <table className="w-full">
        <thead className="text-[var(--color-muted)]">
          <tr className="border-b border-black/[0.06]">
            <th className="py-1.5 text-left font-medium">When</th>
            <th className="py-1.5 text-left font-medium">Source</th>
            <th className="py-1.5 text-right font-medium">Cost/unit</th>
            <th className="py-1.5 text-right font-medium">Price</th>
          </tr>
        </thead>
        <tbody>
          {history.map((row) => (
            <tr key={row.id} className="border-b border-black/[0.04]">
              <td className="py-1.5 align-top whitespace-nowrap">
                {fmtDate(row.takenAt)}
                {row.note && (
                  <p className="text-[10px] text-[var(--color-muted)]">
                    {row.note}
                  </p>
                )}
              </td>
              <td className="py-1.5 align-top">
                <span
                  className={`text-[10px] uppercase tracking-wider font-semibold rounded px-1.5 py-0.5 ${
                    row.source === "APPLY"
                      ? "text-[var(--color-saffron-dark)] bg-[var(--color-saffron)]/15"
                      : "text-[var(--color-muted)] bg-black/[0.04]"
                  }`}
                >
                  {row.source}
                </span>
              </td>
              <td className="py-1.5 align-top text-right tabular-nums">
                {row.costPerUnit != null
                  ? `${fmtMoney(row.costPerUnit)} PLN`
                  : "—"}
              </td>
              <td className="py-1.5 align-top text-right tabular-nums">
                {row.suggestedPrice != null
                  ? `${fmtMoney(row.suggestedPrice)} PLN`
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Tiny presentational helpers                                      */
/* ---------------------------------------------------------------- */

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
        <span className="block text-[10px] text-[var(--color-muted)] mt-0.5">
          {hint}
        </span>
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
            ? `text-sm font-semibold ${
                tone === "saffron"
                  ? "text-[var(--color-saffron-dark)]"
                  : "text-[var(--color-ink)]"
              }`
            : "text-sm text-[var(--color-ink)]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function HealthDot({
  status,
  compact,
}: {
  status: "GOOD" | "WARNING" | "BAD";
  compact?: boolean;
}) {
  const tone =
    status === "BAD"
      ? "bg-red-100 text-red-800 border-red-200"
      : status === "WARNING"
        ? "bg-amber-100 text-amber-800 border-amber-200"
        : "bg-emerald-100 text-emerald-800 border-emerald-200";
  const label =
    status === "BAD" ? "Needs attention" : status === "WARNING" ? "Check" : "Healthy";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tone}`}
    >
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          status === "BAD"
            ? "bg-red-600"
            : status === "WARNING"
              ? "bg-amber-500"
              : "bg-emerald-600"
        }`}
      />
      {compact ? status.toLowerCase() : label}
    </span>
  );
}

function RightTab({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`flex-1 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] transition ${
        active
          ? "text-[var(--color-saffron-dark)] border-b-2 border-[var(--color-saffron)]"
          : "text-[var(--color-muted)] border-b-2 border-transparent"
      } ${disabled ? "opacity-40 cursor-not-allowed" : "hover:text-[var(--color-ink)]"}`}
    >
      {children}
    </button>
  );
}
