import { api } from "./client";

export type MenuCategory = {
  id: string;
  name: string;
  sortOrder: number;
  active: boolean;
  parentId?: string | null;
  itemCount?: number;
};

export type MenuItemVariant = {
  name: string;
  price?: number;  // omitted = inherits item's sellPrice
};

export type MenuItem = {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  longDescription: string | null;
  imagePath: string | null;
  imageUrl: string | null;
  dietaryTags: string | null;
  allergens: string | null;
  featured: boolean;
  categoryId: string;
  categoryName: string | null;
  sellPrice: number;
  foodCost: number | null;
  vatRatePct: number;
  active: boolean;
  /** e.g. "500g", "330ml", "2 pcs" — shown next to the name on the menu */
  portionSize: string | null;
  /** JSON-encoded MenuItemVariant[]. Null when item has no variants. */
  variants: string | null;
  marginAmount?: number;
  marginPct?: number;
  foodCostPct?: number;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type MenuItemPayload = {
  name?: string;
  sku?: string | null;
  description?: string | null;
  longDescription?: string | null;
  dietaryTags?: string | null;
  allergens?: string | null;
  categoryId?: string;
  sellPrice?: number;
  foodCost?: number | null;
  vatRatePct?: number;
  featured?: boolean;
  active?: boolean;
  portionSize?: string | null;
  variants?: string | null;
};

export type CategoryPayload = {
  name?: string;
  sortOrder?: number;
  active?: boolean;
  parentId?: string | null;
};

export type CsvImportResult = {
  created: number;
  updated: number;
  errors: { line: number; error: string }[];
};

export async function listCategories(includeArchived = false) {
  return api<MenuCategory[]>(`/menu/categories?includeArchived=${includeArchived}`);
}

export async function createCategory(payload: CategoryPayload) {
  return api<MenuCategory>("/menu/categories", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCategory(id: string, payload: CategoryPayload) {
  return api<MenuCategory>(`/menu/categories/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteCategory(id: string) {
  return api<void>(`/menu/categories/${id}`, { method: "DELETE" });
}

export async function listItems(opts: { categoryId?: string; includeArchived?: boolean } = {}) {
  const q = new URLSearchParams();
  if (opts.categoryId) q.set("categoryId", opts.categoryId);
  if (opts.includeArchived) q.set("includeArchived", "true");
  const qs = q.toString();
  return api<MenuItem[]>(`/menu/items${qs ? `?${qs}` : ""}`);
}

export async function getItem(id: string) {
  return api<MenuItem>(`/menu/items/${id}`);
}

export async function createItem(payload: MenuItemPayload) {
  return api<MenuItem>("/menu/items", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateItem(id: string, payload: MenuItemPayload) {
  return api<MenuItem>(`/menu/items/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteItem(id: string) {
  return api<void>(`/menu/items/${id}`, { method: "DELETE" });
}

export async function importMenuCsv(file: File) {
  const form = new FormData();
  form.append("file", file);
  return api<CsvImportResult>("/menu/items/import", {
    method: "POST",
    body: form,
  });
}

export async function uploadMenuItemPhoto(id: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  return api<MenuItem>(`/menu/items/${id}/photo`, {
    method: "POST",
    body: form,
  });
}

export async function deleteMenuItemPhoto(id: string) {
  return api<MenuItem>(`/menu/items/${id}/photo`, { method: "DELETE" });
}

export type PrintMenuOptions = {
  layout?: "grid" | "list" | "compact";
  title?: string;
  subtitle?: string;
  showPrices?: boolean;
  language?: "en" | "pl";
  /** Optional title for the "Our story" page (defaults to "Our story"). */
  storyTitle?: string;
  /** Optional editorial body for the "Our story" page. Blank-line-separated
   *  paragraphs render as separate paragraphs. */
  storyBody?: string;
  /** Optional address / phone block rendered on the closing page. */
  contactBlock?: string;
};


/** Fetch the menu PDF as a Blob so we can stuff it into an iframe via a
 *  Blob URL — avoids leaking the JWT in the URL. */
export async function fetchMenuPdfBlob(
  apiBase: string,
  opts: PrintMenuOptions = {},
): Promise<Blob> {
  const q = new URLSearchParams();
  if (opts.layout) q.set("layout", opts.layout);
  if (opts.title) q.set("title", opts.title);
  if (opts.subtitle) q.set("subtitle", opts.subtitle);
  if (opts.showPrices !== undefined) q.set("showPrices", String(opts.showPrices));
  if (opts.language) q.set("language", opts.language);
  if (opts.storyTitle) q.set("storyTitle", opts.storyTitle);
  if (opts.storyBody) q.set("storyBody", opts.storyBody);
  if (opts.contactBlock) q.set("contactBlock", opts.contactBlock);
  const token = localStorage.getItem("token") ?? "";
  const res = await fetch(`${apiBase}/menu/print?${q.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/pdf",
    },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `Menu PDF request failed (${res.status})`);
  }
  return res.blob();
}

// ---------- Analytics + engineering ----------

export type MenuAnalyticsTotals = {
  quantity: number;
  matchedQuantity: number;
  receipts: number;
  revenue: number;
  foodCost: number;
  margin: number;
  marginPct: number;
  foodCostPct: number;
  avgTicket: number;
};

export type MenuAnalyticsItemRow = {
  itemId: string | null;
  name: string;
  sku: string | null;
  categoryId: string | null;
  categoryName: string | null;
  sellPrice: number;
  unitFoodCost: number;
  quantity: number;
  revenue: number;
  foodCost: number;
  margin: number;
  marginPct: number;
  foodCostPct: number;
  share: number;
  unmatched: boolean;
  class?: "STAR" | "PLOWHORSE" | "PUZZLE" | "DOG" | "UNCLASSIFIED";
};

export type CategoryMixRow = {
  categoryId: string;
  name: string;
  revenue: number;
  quantity: number;
  share: number;
};

export type MenuAnalytics = {
  from: string;
  to: string;
  totals: MenuAnalyticsTotals;
  items: MenuAnalyticsItemRow[];
  categoryMix: CategoryMixRow[];
  unmatched: number;
};

export type MenuSuggestion = {
  type: string;
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  itemId: string | null;
  itemName: string | null;
  categoryName: string | null;
};

export type MenuEngineering = MenuAnalytics & {
  medianQty: number;
  medianMarginPct: number;
  classified: {
    star: MenuAnalyticsItemRow[];
    plowhorse: MenuAnalyticsItemRow[];
    puzzle: MenuAnalyticsItemRow[];
    dog: MenuAnalyticsItemRow[];
    unclassified: MenuAnalyticsItemRow[];
  };
  suggestions: MenuSuggestion[];
};

export async function getMenuAnalytics(from: string, to: string) {
  const q = new URLSearchParams({ from, to }).toString();
  return api<MenuAnalytics>(`/menu/analytics?${q}`);
}

export async function getMenuEngineering(from: string, to: string) {
  const q = new URLSearchParams({ from, to }).toString();
  return api<MenuEngineering>(`/menu/analytics/engineering?${q}`);
}

// ---------- POS integrations ----------

export type PosIntegration = {
  id: string;
  name: string;
  vendor: string | null;
  active: boolean;
  lastSeenAt: string | null;
  lastExternalId: string | null;
  lastSyncedAt: string | null;
  /** HMAC webhook URL (advanced; signature required). */
  webhookUrl: string;
  /** Vendor-agnostic push URL with the per-integration token already
   *  embedded — ready to paste into Dotypos Cloud or any POS webhook
   *  config. Pre-fixed with our origin in the UI. */
  pushUrl: string;
  createdAt: string | null;
  webhookSecret?: string;
  dotykacka?: {
    cloudId: string | null;
    hasClientId: boolean;
    hasClientSecret: boolean;
    hasRefreshToken: boolean;
    syncCursor: string | null;
    webhookId: number | null;
    webhookRegistered: boolean;
  };
};

export type DotykackaConfigPayload = {
  cloudId?: string;
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
};

export type DotykackaSyncResult = {
  inserted: number;
  skipped: number;
  unmatched: number;
  pagesFetched: number;
  cursor: string;
};

export async function listPosIntegrations() {
  return api<PosIntegration[]>("/pos/integrations");
}

export async function createPosIntegration(name: string, vendor?: string) {
  return api<PosIntegration>("/pos/integrations", {
    method: "POST",
    body: JSON.stringify({ name, vendor }),
  });
}

export async function rotatePosSecret(id: string) {
  return api<PosIntegration>(`/pos/integrations/${id}/rotate-secret`, {
    method: "POST",
  });
}

export async function setPosIntegrationActive(id: string, active: boolean) {
  return api<PosIntegration>(`/pos/integrations/${id}/${active ? "activate" : "deactivate"}`, {
    method: "POST",
  });
}

export async function deletePosIntegration(id: string) {
  return api<void>(`/pos/integrations/${id}`, { method: "DELETE" });
}

export async function configureDotykacka(id: string, payload: DotykackaConfigPayload) {
  return api<PosIntegration>(`/pos/integrations/${id}/dotykacka`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function syncDotykacka(id: string) {
  return api<DotykackaSyncResult>(`/pos/integrations/${id}/dotykacka/sync`, {
    method: "POST",
  });
}

export async function registerDotyposWebhook(id: string, baseUrl?: string) {
  return api<PosIntegration>(
    `/pos/integrations/${id}/dotykacka/webhook/register`,
    {
      method: "POST",
      body: JSON.stringify(baseUrl ? { baseUrl } : {}),
    },
  );
}

export async function unregisterDotyposWebhook(id: string) {
  return api<PosIntegration>(`/pos/integrations/${id}/dotykacka/webhook`, {
    method: "DELETE",
  });
}

export type PosActivity = {
  totalSales: number;
  lastHour: number;
  last24h: number;
  recent: {
    externalId: string;
    itemName: string | null;
    sku: string | null;
    quantity: number;
    unitPrice: number;
    matched: boolean;
    occurredAt: string | null;
    receivedAt: string | null;
  }[];
};

export async function getPosActivity(id: string) {
  return api<PosActivity>(`/pos/integrations/${id}/activity`);
}

export type WebhookLogItem = {
  name: string | null;
  sku: string | null;
  quantity: number;
  unitPrice: number;
  discount: number | null;
  lineTotal: number;
  matched: boolean;
  menuItemId: string | null;
  categoryId: string | null;
};

export type WebhookReceipt = {
  receiptId: string;
  receivedAt: string | null;
  occurredAt: string | null;
  paymentMethod: string | null;
  itemCount: number;
  total: number;
  hasUnmatched: boolean;
  items: WebhookLogItem[];
  /** Full raw JSON body as received from the POS. Null for old receipts. */
  rawBody: string | null;
};

export async function getWebhookLog(id: string, limit = 200) {
  return api<WebhookReceipt[]>(`/pos/integrations/${id}/webhook-log?limit=${limit}`);
}

export type RawWebhookCall = {
  id: string;
  externalId: string | null;
  receivedAt: string | null;
  inserted: number;
  skipped: number;
  unmatched: number;
  rawBody: string;
};

export async function getRawWebhookCalls(id: string, limit = 50) {
  return api<RawWebhookCall[]>(`/pos/integrations/${id}/raw-calls?limit=${limit}`);
}

export async function sendTestReceipt(id: string) {
  return api<{ ok: boolean; inserted?: number; skipped?: number; unmatched?: number; error?: string }>(
    `/pos/integrations/${id}/test-receipt`,
    { method: "POST" },
  );
}

export type SimulateSaleLine = {
  menuItemId?: string | null;
  sku?: string | null;
  name?: string | null;
  quantity: number;
  unitPrice?: number | null;
};

export type SimulateSalePayload = {
  items: SimulateSaleLine[];
  paymentMethod?: string | null;
  occurredAt?: string | null;
  dryRun?: boolean;
};

export type SimulateSaleResult = {
  ok: boolean;
  externalId: string;
  inserted: number;
  skipped: number;
  unmatched: number;
  dryRun: boolean;
  rolledBack?: boolean;
  stockImpact: {
    stockItemId: string;
    name: string;
    unit: string;
    before: number;
    after: number;
    delta: number;
  }[];
  unlinkedLines: {
    menuItemId: string | null;
    sku: string | null;
    name: string | null;
    quantity: number;
  }[];
};

/**
 * Run an admin-only fake POS sale through the real ingest path. With
 * dryRun=true everything is rolled back at the end, so it's safe to call
 * repeatedly while iterating on menu→stock mappings.
 */
export async function simulatePosSale(id: string, payload: SimulateSalePayload) {
  return api<SimulateSaleResult>(`/pos/integrations/${id}/simulate-sale`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
