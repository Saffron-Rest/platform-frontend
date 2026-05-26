import { api } from "./client";

/**
 * One ingredient line on a recipe. Quantities are stored as numbers
 * here for convenience — the backend accepts strings or numbers
 * thanks to its tolerant parser.
 */
export type RecipeIngredient = {
  id?: string;
  stockItemId: string;
  /** Filled in by the server on read so the form can show "Beef chuck". */
  stockItemName?: string | null;
  stockItemUnit?: string | null;
  stockOnHand?: number | null;
  quantity: number;
  unit: string;
  /** Optional per-line waste % override. Wins over the recipe-level fallback. */
  wastePct?: number | null;
  note?: string | null;
  /** Server-side enrichment — read-only on the client. */
  unitCost?: number | null;
  effectiveQuantity?: number | null;
  lineCost?: number | null;
  shareOfTotalPct?: number | null;
  missingCost?: boolean;
};

/**
 * Aggregate cost / pricing numbers returned alongside a recipe view.
 * {@code null} fields mean "not enough info to compute" — typically
 * when no target food-cost % is set or all ingredients lack costs.
 */
export type RecipeTotals = {
  totalCost: number;
  costPerUnit: number | null;
  suggestedSellPrice: number | null;
  achievedFoodCostPct: number | null;
  contributionMargin: number | null;
  marginPct: number | null;
  /** True when at least one ingredient line is missing a unit cost — the
   *  computed total is a lower bound in that case. */
  someIngredientsMissingCost: boolean;
};

export type Recipe = {
  id: string;
  name: string;
  menuItemId: string | null;
  yieldQuantity: number;
  yieldUnit: string;
  targetFoodCostPct: number | null;
  vatRatePct: number;
  wastePct: number | null;
  notes: string | null;
  active: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
  ingredientCount?: number;
  /** Lines only included on detail / preview responses, not on the list. */
  lines?: RecipeIngredient[];
  totals: RecipeTotals;
  /** Snapshot of the linked menu item's current price/cost, for the
   *  "apply to menu" comparison. */
  menuItemName?: string;
  menuItemSellPrice?: number | null;
  menuItemFoodCost?: number | null;
};

/** Body shape accepted by create/update/preview. The lines array is
 *  replaced wholesale on save — there's no per-line diffing. */
export type RecipePayload = {
  name?: string;
  menuItemId?: string | null;
  yieldQuantity?: number;
  yieldUnit?: string;
  targetFoodCostPct?: number | null;
  vatRatePct?: number;
  wastePct?: number | null;
  notes?: string | null;
  active?: boolean;
  ingredients?: Array<{
    stockItemId: string;
    quantity: number;
    unit?: string;
    wastePct?: number | null;
    note?: string | null;
  }>;
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
 * The response shape is identical to {@link getRecipe} but the
 * {@code id} is absent.
 */
export async function previewRecipe(payload: RecipePayload) {
  return api<{
    recipe: Omit<Recipe, "id" | "totals" | "lines">;
    lines: RecipeIngredient[];
    totals: RecipeTotals;
  }>("/recipes/preview", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Push the recipe's computed cost (and optionally its suggested
 * sales price) onto the linked menu item.
 */
export async function applyRecipeToMenu(id: string, applySuggestedPrice: boolean) {
  return api<Recipe>(`/recipes/${id}/apply-to-menu`, {
    method: "POST",
    body: JSON.stringify({ applySuggestedPrice }),
  });
}
