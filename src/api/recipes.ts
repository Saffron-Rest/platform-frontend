import { api } from "./client";

/**
 * One ingredient line on a recipe. v2 adds sub-recipe support — each
 * line points at *either* a {@link RecipeIngredient.stockItemId} or a
 * {@link RecipeIngredient.subRecipeId}. The server enforces the
 * exclusive-or; sending both raises 400. Either one resolves to a
 * {@link RecipeIngredient.source} marker ("STOCK" / "RECIPE") on the
 * read path so the UI can render appropriately.
 */
export type RecipeIngredient = {
  id?: string;
  sortOrder?: number;
  /** Stock-backed line. Either this or {@code subRecipeId} is set. */
  stockItemId?: string | null;
  /** Sub-recipe backed line. Either this or {@code stockItemId} is set. */
  subRecipeId?: string | null;
  /** Source kind — server populated. */
  source?: "STOCK" | "RECIPE";
  /** Display name of the source (stock item or sub-recipe). */
  sourceName?: string | null;
  /** Source's native unit (stock unit or sub-recipe yield unit). */
  sourceUnit?: string | null;
  /** Source's per-unit cost (stock unitCost or sub-recipe cost/yield-unit). */
  sourceUnitCost?: number | null;
  /** For stock-backed lines only — current on-hand quantity. */
  stockOnHand?: number | null;
  quantity: number;
  unit: string;
  /** Optional per-line waste % override. Wins over the recipe-level fallback. */
  wastePct?: number | null;
  note?: string | null;
  /** Server-side enrichment — read-only on the client. */
  lineCost?: number | null;
  shareOfTotalPct?: number | null;
  /** Set when the line's unit can't be converted to the source's unit
   *  and we fell back to a 1:1 multiply — UI should warn. */
  conversionWarning?: boolean;
  missingCost?: boolean;
};

/**
 * Aggregate cost / pricing numbers returned alongside a recipe view.
 * v2 layers prime / fully-loaded numbers on top of the food cost.
 * {@code null} fields mean "not enough info to compute".
 */
export type RecipeTotals = {
  /** Total raw food cost (sum of ingredient lines, post-waste). */
  foodCost: number;
  /** Food cost / yield. Same as the legacy {@code costPerUnit}. */
  foodCostPerUnit: number | null;
  laborCostPerUnit: number | null;
  packagingCostPerUnit: number | null;
  /** food + labor + packaging. */
  primeCostPerUnit: number | null;
  overheadCostPerUnit: number | null;
  /** prime + overhead. */
  fullyLoadedCostPerUnit: number | null;
  /** Backwards-compatible alias of {@code foodCostPerUnit}. */
  costPerUnit: number | null;
  suggestedSellPrice: number | null;
  /** Minimum gross price that recovers the fully-loaded cost. */
  breakEvenPrice: number | null;
  achievedFoodCostPct: number | null;
  achievedPrimeCostPct: number | null;
  contributionMargin: number | null;
  marginPct: number | null;
  /** True when at least one ingredient line is missing a unit cost. */
  someIngredientsMissingCost: boolean;
  /** True when at least one unit conversion was missing. */
  someConversionsMissing: boolean;
  /** True when the dependency graph forms a cycle. */
  cycleDetected: boolean;
  /** % of total food cost contributed by the single largest line —
   *  helps surface concentration risk. */
  dominantLineSharePct: number | null;
};

export type RecipeHealthIssue = {
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
};

export type RecipeHealth = {
  status: "GOOD" | "WARNING" | "BAD";
  issues: RecipeHealthIssue[];
};

export type RecipeScenario = {
  targetFoodCostPct: number;
  suggestedSellPrice: number | null;
  achievedFoodCostPct: number | null;
  marginPct: number | null;
  isCurrent: boolean;
};

export type Recipe = {
  id: string;
  name: string;
  menuItemId: string | null;
  yieldQuantity: number;
  yieldUnit: string;
  targetFoodCostPct: number | null;
  targetPrimeCostPct: number | null;
  vatRatePct: number;
  wastePct: number | null;
  laborMinutesPerUnit: number | null;
  laborRatePerHour: number | null;
  packagingCostPerUnit: number | null;
  overheadPct: number | null;
  minMarginPct: number | null;
  notes: string | null;
  active: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
  ingredientCount?: number;
  /** Lines only included on detail / preview responses, not on the list. */
  lines?: RecipeIngredient[];
  totals: RecipeTotals;
  health: RecipeHealth;
  scenarios?: RecipeScenario[];
  menuItemName?: string;
  menuItemSellPrice?: number | null;
  menuItemFoodCost?: number | null;
};

/** Body shape accepted by create/update/preview. */
export type RecipePayload = {
  name?: string;
  menuItemId?: string | null;
  yieldQuantity?: number;
  yieldUnit?: string;
  targetFoodCostPct?: number | null;
  targetPrimeCostPct?: number | null;
  vatRatePct?: number;
  wastePct?: number | null;
  laborMinutesPerUnit?: number | null;
  laborRatePerHour?: number | null;
  packagingCostPerUnit?: number | null;
  overheadPct?: number | null;
  minMarginPct?: number | null;
  notes?: string | null;
  active?: boolean;
  ingredients?: Array<{
    stockItemId?: string | null;
    subRecipeId?: string | null;
    quantity: number;
    unit?: string;
    wastePct?: number | null;
    note?: string | null;
  }>;
};

/** A single row from the cost-snapshot history. */
export type RecipeSnapshot = {
  id: string;
  recipeId: string;
  foodCost: number | null;
  primeCost: number | null;
  fullyLoadedCost: number | null;
  costPerUnit: number | null;
  suggestedPrice: number | null;
  achievedFoodCostPct: number | null;
  marginPct: number | null;
  source: "SAVE" | "APPLY" | "MANUAL";
  note: string | null;
  takenAt: string;
};

/** Light reference returned by the "affected recipes" endpoint. */
export type RecipeRef = {
  id: string;
  name: string;
  menuItemId: string | null;
  active: boolean;
};

export async function listRecipes(includeInactive = false) {
  const qs = includeInactive ? "?includeInactive=true" : "";
  return api<Recipe[]>(`/recipes${qs}`);
}

export async function getRecipe(id: string) {
  return api<Recipe>(`/recipes/${id}`);
}

export async function createRecipe(payload: RecipePayload) {
  return api<Recipe>("/recipes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateRecipe(id: string, payload: RecipePayload) {
  return api<Recipe>(`/recipes/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function archiveRecipe(id: string) {
  return api<{ archived: string }>(`/recipes/${id}`, { method: "DELETE" });
}

/**
 * Live cost / price preview for an in-flight draft. Same payload as
 * {@link createRecipe} / {@link updateRecipe}; nothing is persisted.
 */
export async function previewRecipe(payload: RecipePayload) {
  return api<{
    recipe: Omit<Recipe, "id" | "totals" | "lines" | "health" | "scenarios">;
    lines: RecipeIngredient[];
    totals: RecipeTotals;
    scenarios: RecipeScenario[];
    health: RecipeHealth;
  }>("/recipes/preview", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function applyRecipeToMenu(id: string, applySuggestedPrice: boolean) {
  return api<Recipe>(`/recipes/${id}/apply-to-menu`, {
    method: "POST",
    body: JSON.stringify({ applySuggestedPrice }),
  });
}

export async function getRecipeHistory(id: string) {
  return api<RecipeSnapshot[]>(`/recipes/${id}/history`);
}

export async function getRecipesAffectedByStock(stockItemId: string) {
  return api<RecipeRef[]>(`/recipes/affected-by-stock/${stockItemId}`);
}
