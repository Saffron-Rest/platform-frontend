import { useEffect, useMemo, useRef, useState } from "react";
import {
  createCategory,
  createItem,
  deleteCategory,
  deleteItem,
  deleteMenuItemPhoto,
  fetchMenuPdfBlob,
  importMenuCsv,
  listCategories,
  listItems,
  updateCategory,
  updateItem,
  uploadMenuItemPhoto,
  type CsvImportResult,
  type MenuCategory,
  type MenuItem,
  type PrintMenuOptions,
} from "../../api/menu";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { Spinner } from "../../components/ui/Spinner";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ||
  "/api";

/** Dietary tag suggestions surfaced as chips in the editor. Stored lowercase. */
const DIETARY_OPTIONS = [
  "vegetarian",
  "vegan",
  "gluten-free",
  "spicy",
  "signature",
] as const;

/** Common menu allergens (matches EU 14-item allergen disclosure list). */
const ALLERGEN_OPTIONS = [
  "gluten",
  "dairy",
  "eggs",
  "nuts",
  "sesame",
  "soy",
  "fish",
  "shellfish",
  "celery",
  "mustard",
  "sulphites",
] as const;

const CSV_TEMPLATE = `name,category,sku,sell_price,food_cost,vat,description
Lamb Plov,Plov & Rice,PLOV-LAMB,38.00,11.50,8,"Classic Azerbaijani lamb plov"
Dovga,Soups,DOVGA-1,18.00,5.50,8,"Yogurt and herb soup"
Chai Black,Drinks,CHAI-BLK,8.00,1.20,23,"Traditional black tea"
`;

type ItemDraft = {
  id?: string;
  name: string;
  sku: string;
  description: string;
  longDescription: string;
  categoryId: string;
  sellPrice: string;
  foodCost: string;
  vatRatePct: string;
  dietaryTags: string[];
  allergens: string[];
  featured: boolean;
  active: boolean;
  imageUrl: string | null;
};

const blankDraft: ItemDraft = {
  name: "",
  sku: "",
  description: "",
  longDescription: "",
  categoryId: "",
  sellPrice: "",
  foodCost: "",
  vatRatePct: "8",
  dietaryTags: [],
  allergens: [],
  featured: false,
  active: true,
  imageUrl: null,
};

function parseTagList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function AdminMenu() {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<ItemDraft>(blankDraft);
  const [saving, setSaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<CsvImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [printOpts, setPrintOpts] = useState<PrintMenuOptions>({
    layout: "grid",
    title: "Saffron",
    subtitle: "Authentic Azerbaijani Restaurant",
    showPrices: true,
    language: "en",
  });
  const [printPreviewUrl, setPrintPreviewUrl] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [cats, its] = await Promise.all([
        listCategories(true),
        listItems({ includeArchived: showArchived }),
      ]);
      setCategories(cats);
      setItems(its);
      if (!draft.categoryId && cats.length > 0) {
        setDraft((d) => ({ ...d, categoryId: cats[0].id }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load menu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchived]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (filterCategory && i.categoryId !== filterCategory) return false;
      if (q) {
        return (
          i.name.toLowerCase().includes(q) ||
          (i.sku ?? "").toLowerCase().includes(q) ||
          (i.description ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [items, filterCategory, search]);

  const startEdit = (i: MenuItem) => {
    setDraft({
      id: i.id,
      name: i.name,
      sku: i.sku ?? "",
      description: i.description ?? "",
      longDescription: i.longDescription ?? "",
      categoryId: i.categoryId,
      sellPrice: String(i.sellPrice ?? ""),
      foodCost: i.foodCost != null ? String(i.foodCost) : "",
      vatRatePct: String(i.vatRatePct ?? "8"),
      dietaryTags: parseTagList(i.dietaryTags),
      allergens: parseTagList(i.allergens),
      featured: i.featured,
      active: i.active,
      imageUrl: i.imageUrl,
    });
  };

  const cancelEdit = () => {
    setDraft({ ...blankDraft, categoryId: categories[0]?.id ?? "" });
  };

  const toggleDietary = (tag: string) =>
    setDraft((d) => ({
      ...d,
      dietaryTags: d.dietaryTags.includes(tag)
        ? d.dietaryTags.filter((t) => t !== tag)
        : [...d.dietaryTags, tag],
    }));

  const toggleAllergen = (tag: string) =>
    setDraft((d) => ({
      ...d,
      allergens: d.allergens.includes(tag)
        ? d.allergens.filter((t) => t !== tag)
        : [...d.allergens, tag],
    }));

  const saveItem = async () => {
    if (!draft.name.trim()) {
      setError("Item name is required");
      return;
    }
    if (!draft.categoryId) {
      setError("Pick a category");
      return;
    }
    const sellPriceNum = Number(draft.sellPrice.replace(",", "."));
    if (!Number.isFinite(sellPriceNum) || sellPriceNum < 0) {
      setError("Sell price must be a valid number");
      return;
    }
    const foodCostNum = draft.foodCost.trim()
      ? Number(draft.foodCost.replace(",", "."))
      : null;
    if (foodCostNum != null && !Number.isFinite(foodCostNum)) {
      setError("Food cost must be a valid number");
      return;
    }
    const vatNum = Number(draft.vatRatePct.replace(",", "."));
    if (!Number.isFinite(vatNum) || vatNum < 0) {
      setError("VAT rate must be a number");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        name: draft.name.trim(),
        sku: draft.sku.trim() || null,
        description: draft.description.trim() || null,
        longDescription: draft.longDescription.trim() || null,
        dietaryTags: draft.dietaryTags.join(","),
        allergens: draft.allergens.join(","),
        categoryId: draft.categoryId,
        sellPrice: sellPriceNum,
        foodCost: foodCostNum,
        vatRatePct: vatNum,
        featured: draft.featured,
        active: draft.active,
      };
      if (draft.id) {
        await updateItem(draft.id, payload);
        setMessage(`Updated "${draft.name}"`);
      } else {
        await createItem(payload);
        setMessage(`Added "${draft.name}"`);
      }
      cancelEdit();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save item");
    } finally {
      setSaving(false);
    }
  };

  const removeItem = async (i: MenuItem) => {
    if (!confirm(`Delete "${i.name}" permanently? Archive instead is usually safer.`)) return;
    try {
      await deleteItem(i.id);
      setMessage(`Deleted "${i.name}"`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const toggleActive = async (i: MenuItem) => {
    try {
      await updateItem(i.id, { active: !i.active });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  };

  const addCategory = async () => {
    const name = prompt("New category name?");
    if (!name || !name.trim()) return;
    try {
      await createCategory({ name: name.trim() });
      setMessage(`Category "${name.trim()}" added`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create category");
    }
  };

  const renameCategory = async (c: MenuCategory) => {
    const name = prompt("Rename category", c.name);
    if (!name || !name.trim() || name.trim() === c.name) return;
    try {
      await updateCategory(c.id, { name: name.trim() });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not rename");
    }
  };

  const removeCategory = async (c: MenuCategory) => {
    if (!confirm(`Delete category "${c.name}"? This only works if it has no items.`)) return;
    try {
      await deleteCategory(c.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete category");
    }
  };

  const downloadCsvTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "menu-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const onPhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !draft.id) return;
    setUploadingPhoto(true);
    setError("");
    setMessage("");
    try {
      const updated = await uploadMenuItemPhoto(draft.id, file);
      setDraft((d) => ({ ...d, imageUrl: updated.imageUrl }));
      setMessage(`Photo updated for "${updated.name}"`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo upload failed");
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const removePhoto = async () => {
    if (!draft.id) return;
    if (!confirm("Remove this photo? The item will go back to a placeholder.")) return;
    try {
      const updated = await deleteMenuItemPhoto(draft.id);
      setDraft((d) => ({ ...d, imageUrl: updated.imageUrl }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove photo");
    }
  };

  const generateMenu = async () => {
    setPrinting(true);
    setError("");
    try {
      const blob = await fetchMenuPdfBlob(API_BASE, printOpts);
      const url = URL.createObjectURL(blob);
      if (printPreviewUrl) URL.revokeObjectURL(printPreviewUrl);
      setPrintPreviewUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not build the menu PDF");
    } finally {
      setPrinting(false);
    }
  };

  const downloadMenuPdf = () => {
    if (!printPreviewUrl) return;
    const a = document.createElement("a");
    a.href = printPreviewUrl;
    a.download = `saffron-menu-${new Date().toISOString().slice(0, 10)}.pdf`;
    a.click();
  };

  useEffect(() => {
    return () => {
      if (printPreviewUrl) URL.revokeObjectURL(printPreviewUrl);
    };
  }, [printPreviewUrl]);

  const handleCsvSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setError("");
    setMessage("");
    setImportResult(null);
    try {
      const res = await importMenuCsv(file);
      setImportResult(res);
      await load();
      setMessage(`Import complete: ${res.created} new, ${res.updated} updated`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Menu"
        subtitle="Catalog of dishes with sell price, food cost, and VAT. Drives the P&L analytics, menu engineering, and the printable menu."
        action={
          <Button onClick={() => setPrintOpen(true)}>
            Generate printable menu
          </Button>
        }
      />

      {error && <Alert variant="error">{error}</Alert>}
      {message && <Alert variant="success">{message}</Alert>}

      <Card>
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="search"
              placeholder="Search items, SKUs, descriptions…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="field-input w-72 max-w-full"
            />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="field-input"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              Include archived
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={downloadCsvTemplate}>
              Download CSV template
            </Button>
            <Button
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              {importing ? "Importing…" : "Import CSV"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleCsvSelected}
            />
          </div>
        </div>
      </Card>

      {importResult && (importResult.errors?.length ?? 0) > 0 && (
        <Alert variant="info">
          <strong>Import warnings:</strong>{" "}
          {importResult.errors.length} row{importResult.errors.length === 1 ? "" : "s"} skipped.
          <ul className="mt-1 text-sm list-disc pl-5">
            {importResult.errors.slice(0, 10).map((er, i) => (
              <li key={i}>
                Line {er.line}: {er.error}
              </li>
            ))}
            {importResult.errors.length > 10 && <li>… and {importResult.errors.length - 10} more</li>}
          </ul>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* Categories panel */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Categories</h3>
            <button
              type="button"
              className="text-xs font-medium text-[var(--color-saffron-dark)] hover:underline"
              onClick={() => void addCategory()}
            >
              + Add
            </button>
          </div>
          {categories.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">
              No categories yet. Add one to start.
            </p>
          ) : (
            <ul className="space-y-1">
              {categories.map((c) => {
                const isActive = c.id === filterCategory;
                return (
                  <li
                    key={c.id}
                    className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg ${
                      isActive ? "bg-[var(--color-saffron)]/10" : "hover:bg-black/5"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setFilterCategory(filterCategory === c.id ? "" : c.id)
                      }
                      className="text-left flex-1 min-w-0"
                    >
                      <span className="font-medium truncate">{c.name}</span>
                      <span className="ml-2 text-xs text-[var(--color-muted)]">
                        {c.itemCount ?? 0}
                      </span>
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        className="text-xs text-[var(--color-muted)] hover:text-[var(--color-saffron-dark)]"
                        onClick={() => void renameCategory(c)}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:underline"
                        onClick={() => void removeCategory(c)}
                      >
                        ×
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Item editor + list */}
        <div className="space-y-4">
          <Card>
            <h3 className="font-semibold mb-3">{draft.id ? "Edit item" : "Add item"}</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="field-label">
                Name
                <input
                  className="field-input"
                  value={draft.name}
                  maxLength={160}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder="Lamb Plov"
                />
              </label>
              <label className="field-label">
                Category
                <select
                  className="field-input"
                  value={draft.categoryId}
                  onChange={(e) => setDraft((d) => ({ ...d, categoryId: e.target.value }))}
                >
                  <option value="">— pick —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-label">
                Sell price (PLN, gross)
                <input
                  className="field-input tabular-nums"
                  value={draft.sellPrice}
                  onChange={(e) => setDraft((d) => ({ ...d, sellPrice: e.target.value }))}
                  placeholder="38.00"
                  inputMode="decimal"
                />
              </label>
              <label className="field-label">
                Food cost (PLN, gross)
                <input
                  className="field-input tabular-nums"
                  value={draft.foodCost}
                  onChange={(e) => setDraft((d) => ({ ...d, foodCost: e.target.value }))}
                  placeholder="11.50"
                  inputMode="decimal"
                />
              </label>
              <label className="field-label">
                VAT %
                <input
                  className="field-input tabular-nums"
                  value={draft.vatRatePct}
                  onChange={(e) => setDraft((d) => ({ ...d, vatRatePct: e.target.value }))}
                  placeholder="8"
                  inputMode="decimal"
                />
              </label>
              <label className="field-label">
                SKU (POS matching key)
                <input
                  className="field-input"
                  value={draft.sku}
                  onChange={(e) => setDraft((d) => ({ ...d, sku: e.target.value }))}
                  placeholder="PLOV-LAMB"
                />
              </label>
              <label className="field-label md:col-span-2">
                Short description (analytics + internal use)
                <input
                  className="field-input"
                  value={draft.description}
                  maxLength={500}
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                  placeholder="Short note used on the menu"
                />
              </label>
              <label className="field-label md:col-span-2">
                Long description (shown on the printed menu)
                <textarea
                  className="field-input min-h-[80px]"
                  value={draft.longDescription}
                  maxLength={1000}
                  rows={3}
                  onChange={(e) => setDraft((d) => ({ ...d, longDescription: e.target.value }))}
                  placeholder="Slow-braised lamb shoulder, saffron rice, sour barberries, served with cucumber-mint yogurt."
                />
              </label>

              <div className="field-label md:col-span-2">
                <span>Dietary tags</span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {DIETARY_OPTIONS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleDietary(tag)}
                      className={`px-2 py-1 rounded-full text-xs border transition ${
                        draft.dietaryTags.includes(tag)
                          ? "bg-[var(--color-saffron)] text-white border-[var(--color-saffron)]"
                          : "bg-white text-[var(--color-muted)] border-black/10 hover:border-[var(--color-saffron)]"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field-label md:col-span-2">
                <span>Allergens (printed under the description)</span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {ALLERGEN_OPTIONS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleAllergen(tag)}
                      className={`px-2 py-1 rounded-full text-xs border transition ${
                        draft.allergens.includes(tag)
                          ? "bg-amber-500 text-white border-amber-500"
                          : "bg-white text-[var(--color-muted)] border-black/10 hover:border-amber-400"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div className="md:col-span-2 grid gap-4 md:grid-cols-[160px_1fr] items-start">
                <div>
                  {draft.imageUrl ? (
                    <img
                      src={draft.imageUrl}
                      alt="Item"
                      className="w-40 h-32 object-cover rounded-lg border border-black/10"
                    />
                  ) : (
                    <div className="w-40 h-32 rounded-lg border border-dashed border-black/15 bg-[var(--color-saffron)]/5 flex items-center justify-center text-xs text-[var(--color-muted)]">
                      No photo
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Item photo</p>
                  <p className="text-xs text-[var(--color-muted)]">
                    {draft.id
                      ? "JPG, PNG, or WEBP. Recommended: 1200×900 (4:3), at least 600 KB for a sharp print result."
                      : "Save the item first, then come back here to upload a photo."}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={!draft.id || uploadingPhoto}
                    >
                      {uploadingPhoto
                        ? "Uploading…"
                        : draft.imageUrl
                        ? "Replace photo"
                        : "Upload photo"}
                    </Button>
                    {draft.imageUrl && (
                      <Button variant="ghost" onClick={() => void removePhoto()}>
                        Remove
                      </Button>
                    )}
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={onPhotoSelected}
                    />
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.featured}
                  onChange={(e) => setDraft((d) => ({ ...d, featured: e.target.checked }))}
                />
                Chef's signature (★ badge on the printed menu)
              </label>
              {draft.id && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.active}
                    onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))}
                  />
                  Active
                </label>
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={() => void saveItem()} disabled={saving}>
                {saving ? "Saving…" : draft.id ? "Save changes" : "Add to menu"}
              </Button>
              {draft.id && (
                <Button variant="ghost" onClick={cancelEdit}>
                  Cancel
                </Button>
              )}
            </div>
          </Card>

          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner label="Loading menu…" />
            </div>
          ) : filteredItems.length === 0 ? (
            <EmptyState
              title="No items"
              description="Add items via the form above, or upload a CSV."
            />
          ) : (
            <Card className="!p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-black/5 text-[var(--color-muted)] text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-4 py-2 w-16"></th>
                      <th className="text-left px-4 py-2">Item</th>
                      <th className="text-left px-4 py-2">Category</th>
                      <th className="text-right px-4 py-2">Sell</th>
                      <th className="text-right px-4 py-2">Food cost</th>
                      <th className="text-right px-4 py-2">Margin</th>
                      <th className="text-right px-4 py-2">FC %</th>
                      <th className="text-right px-4 py-2">SKU</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((i) => {
                      const margin = i.foodCost != null ? Number(i.sellPrice) - Number(i.foodCost) : null;
                      const fcPct = i.foodCostPct;
                      const fcColor =
                        fcPct == null
                          ? "text-[var(--color-muted)]"
                          : fcPct > 38
                          ? "text-red-600"
                          : fcPct > 32
                          ? "text-amber-600"
                          : "text-emerald-700";
                      return (
                        <tr
                          key={i.id}
                          className={`border-t border-black/5 ${
                            i.active ? "" : "opacity-50"
                          }`}
                        >
                          <td className="px-4 py-2">
                            {i.imageUrl ? (
                              <img
                                src={i.imageUrl}
                                alt=""
                                className="w-12 h-12 object-cover rounded-md border border-black/5"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-md border border-dashed border-black/15 bg-[var(--color-saffron)]/5" />
                            )}
                          </td>
                          <td className="px-4 py-2">
                            <div className="font-medium flex items-center gap-1">
                              {i.featured && <span className="text-[var(--color-saffron)]">★</span>}
                              {i.name}
                            </div>
                            {i.description && (
                              <div className="text-xs text-[var(--color-muted)] truncate max-w-xs">
                                {i.description}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2 text-[var(--color-muted)]">
                            {i.categoryName ?? "—"}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums">
                            {Number(i.sellPrice).toFixed(2)}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums">
                            {i.foodCost != null ? Number(i.foodCost).toFixed(2) : "—"}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums">
                            {margin != null ? margin.toFixed(2) : "—"}
                          </td>
                          <td className={`px-4 py-2 text-right tabular-nums ${fcColor}`}>
                            {fcPct != null ? `${fcPct.toFixed(1)}%` : "—"}
                          </td>
                          <td className="px-4 py-2 text-right text-xs text-[var(--color-muted)]">
                            {i.sku ?? "—"}
                          </td>
                          <td className="px-4 py-2 text-right whitespace-nowrap">
                            <button
                              type="button"
                              className="text-xs font-medium text-[var(--color-saffron-dark)] hover:underline mr-2"
                              onClick={() => startEdit(i)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="text-xs font-medium text-[var(--color-muted)] hover:underline mr-2"
                              onClick={() => void toggleActive(i)}
                            >
                              {i.active ? "Archive" : "Restore"}
                            </button>
                            <button
                              type="button"
                              className="text-xs font-medium text-red-600 hover:underline"
                              onClick={() => void removeItem(i)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </div>

      {printOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setPrintOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-black/5">
              <div>
                <h3 className="font-semibold text-lg">Printable menu</h3>
                <p className="text-xs text-[var(--color-muted)]">
                  Generates a designer-style PDF using your menu items, photos, descriptions, and dietary tags.
                </p>
              </div>
              <button
                type="button"
                className="text-[var(--color-muted)] hover:text-black text-xl leading-none"
                onClick={() => setPrintOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="grid lg:grid-cols-[320px_1fr] gap-0 flex-1 min-h-0">
              <div className="p-6 space-y-4 border-r border-black/5 overflow-y-auto">
                <label className="field-label">
                  Layout
                  <select
                    className="field-input"
                    value={printOpts.layout ?? "grid"}
                    onChange={(e) =>
                      setPrintOpts((o) => ({ ...o, layout: e.target.value as PrintMenuOptions["layout"] }))
                    }
                  >
                    <option value="grid">Grid — 2-column photo cards (default)</option>
                    <option value="list">List — single column with thumbnails</option>
                    <option value="compact">Compact — 2-column text only, no photos</option>
                  </select>
                </label>

                <label className="field-label">
                  Restaurant name (cover)
                  <input
                    className="field-input"
                    value={printOpts.title ?? ""}
                    onChange={(e) => setPrintOpts((o) => ({ ...o, title: e.target.value }))}
                  />
                </label>

                <label className="field-label">
                  Tagline / subtitle
                  <input
                    className="field-input"
                    value={printOpts.subtitle ?? ""}
                    onChange={(e) => setPrintOpts((o) => ({ ...o, subtitle: e.target.value }))}
                  />
                </label>

                <label className="field-label">
                  Price format
                  <select
                    className="field-input"
                    value={printOpts.language ?? "en"}
                    onChange={(e) => setPrintOpts((o) => ({ ...o, language: e.target.value as "en" | "pl" }))}
                  >
                    <option value="en">English (32.00 zł)</option>
                    <option value="pl">Polish (32,00 zł)</option>
                  </select>
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={printOpts.showPrices ?? true}
                    onChange={(e) => setPrintOpts((o) => ({ ...o, showPrices: e.target.checked }))}
                  />
                  Show prices on the menu
                </label>

                <div className="pt-4 space-y-2 border-t border-black/5">
                  <Button
                    onClick={() => void generateMenu()}
                    disabled={printing}
                    className="w-full"
                  >
                    {printing ? "Building PDF…" : printPreviewUrl ? "Regenerate preview" : "Generate preview"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={downloadMenuPdf}
                    disabled={!printPreviewUrl}
                    className="w-full"
                  >
                    Download PDF
                  </Button>
                  <p className="text-xs text-[var(--color-muted)] mt-3">
                    Tip: Print to A4, single-sided, no margins. For a glossy in-house menu, use 170 gsm matte or silk stock.
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 flex items-stretch min-h-[60vh]">
                {printPreviewUrl ? (
                  <iframe
                    title="Menu preview"
                    src={printPreviewUrl}
                    className="w-full h-full border-0"
                  />
                ) : (
                  <div className="flex-1 flex items-center justify-center text-sm text-[var(--color-muted)]">
                    {printing
                      ? "Generating…"
                      : "Click \"Generate preview\" to see your menu."}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
