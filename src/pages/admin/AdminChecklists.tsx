import { useEffect, useMemo, useState } from "react";
import {
  archiveTemplate,
  checklistHistory,
  createTemplate,
  listTemplates,
  updateTemplate,
  type ChecklistItem,
  type ChecklistRun,
  type ChecklistTemplate,
  type ChecklistType,
  type TemplatePayload,
} from "../../api/checklists";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { Spinner } from "../../components/ui/Spinner";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";

const TYPE_LABEL: Record<ChecklistType, string> = {
  OPENING: "Opening",
  CLOSING: "Closing",
  PERIODIC: "Periodic",
};

const TYPE_TONE: Record<ChecklistType, string> = {
  OPENING: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  CLOSING: "bg-violet-100 text-violet-800 ring-violet-200",
  PERIODIC: "bg-amber-100 text-amber-900 ring-amber-200",
};

const fmtDate = (iso: string) => {
  const d = new Date(iso.length === 10 ? iso + "T12:00:00" : iso);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
};

const newItem = (): ChecklistItem => ({
  id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
  label: "",
  requiresPhoto: false,
});

const blankDraft = (): TemplatePayload & { id?: string } => ({
  name: "",
  type: "OPENING",
  role: "",
  description: "",
  items: [newItem()],
  active: true,
});

type Tab = "TEMPLATES" | "HISTORY";

export function AdminChecklists() {
  const [tab, setTab] = useState<Tab>("TEMPLATES");
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [history, setHistory] = useState<ChecklistRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editor, setEditor] = useState<(TemplatePayload & { id?: string }) | null>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [t, h] = await Promise.all([
        listTemplates(showArchived),
        checklistHistory(14),
      ]);
      setTemplates(t);
      setHistory(h);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load checklists");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [showArchived]);

  const visibleTemplates = useMemo(() => {
    const groups: Record<ChecklistType, ChecklistTemplate[]> = {
      OPENING: [], CLOSING: [], PERIODIC: [],
    };
    for (const t of templates) groups[t.type].push(t);
    return groups;
  }, [templates]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Checklists"
        subtitle="Opening, closing, and periodic tasks — designed for tired-at-23:00 use."
        action={
          <div className="flex gap-2">
            <a
              href="/checklists"
              className="px-3 py-1.5 rounded-lg ring-1 ring-black/10 bg-white text-sm hover:bg-[var(--color-cream)]"
            >
              Today's run ↗
            </a>
            <Button onClick={() => setEditor(blankDraft())}>+ New template</Button>
          </div>
        }
      />

      {error && (
        <Alert variant="error">
          <div className="flex justify-between gap-3">
            <span>{error}</span>
            <button type="button" onClick={() => setError("")} className="opacity-70 hover:opacity-100">×</button>
          </div>
        </Alert>
      )}
      {info && (
        <Alert variant="success">
          <div className="flex justify-between gap-3">
            <span>{info}</span>
            <button type="button" onClick={() => setInfo("")} className="opacity-70 hover:opacity-100">×</button>
          </div>
        </Alert>
      )}

      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => setTab("TEMPLATES")}
          className={`tab-pill ${tab === "TEMPLATES" ? "tab-pill-active" : "tab-pill-idle"}`}
        >
          Templates ({templates.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("HISTORY")}
          className={`tab-pill ${tab === "HISTORY" ? "tab-pill-active" : "tab-pill-idle"}`}
        >
          History
        </button>
      </div>

      {loading ? (
        <Card><div className="py-10"><Spinner /></div></Card>
      ) : tab === "TEMPLATES" ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <label className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              Show archived
            </label>
          </div>
          {templates.length === 0 ? (
            <Card>
              <EmptyState
                title="No checklists yet"
                description="Start with a 'Daily opening' or 'Closing checklist' template. Add 5–10 quick items the team can tick off in two minutes."
                action={<Button onClick={() => setEditor(blankDraft())}>Create first template</Button>}
              />
            </Card>
          ) : (
            (["OPENING", "CLOSING", "PERIODIC"] as ChecklistType[]).map((type) => (
              visibleTemplates[type].length === 0 ? null : (
                <div key={type}>
                  <div className="text-xs uppercase tracking-wider text-[var(--color-muted)] mb-2 px-1">
                    {TYPE_LABEL[type]}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {visibleTemplates[type].map((t) => (
                      <Card key={t.id} className={t.active ? "" : "opacity-60"}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0">
                            <div className="font-semibold text-[var(--color-ink)]">{t.name}</div>
                            <div className="flex items-center gap-2 mt-1 text-xs">
                              <span className={`px-2 py-0.5 rounded-full ring-1 ${TYPE_TONE[t.type]}`}>
                                {TYPE_LABEL[t.type]}
                              </span>
                              {t.role && (
                                <span className="px-2 py-0.5 rounded-full bg-[var(--color-cream)] text-[var(--color-muted)]">
                                  {t.role}
                                </span>
                              )}
                              {!t.active && <span className="text-red-700">Archived</span>}
                            </div>
                          </div>
                        </div>
                        {t.description && (
                          <p className="text-xs text-[var(--color-muted)] mb-2 line-clamp-2">{t.description}</p>
                        )}
                        <div className="text-sm text-[var(--color-ink)]/85 mb-3">
                          {t.items.length} item{t.items.length === 1 ? "" : "s"}
                        </div>
                        <div className="flex justify-between text-xs">
                          <button
                            type="button"
                            onClick={() => setEditor({
                              id: t.id,
                              name: t.name,
                              type: t.type,
                              role: t.role ?? "",
                              description: t.description ?? "",
                              items: t.items.map((i) => ({ ...i })),
                              active: t.active,
                            })}
                            className="text-[var(--color-saffron-dark)] hover:underline"
                          >
                            Edit
                          </button>
                          {t.active && (
                            <button
                              type="button"
                              onClick={async () => {
                                if (!confirm(`Archive "${t.name}"? It can be restored from the archived list.`)) return;
                                try {
                                  await archiveTemplate(t.id);
                                  setInfo("Template archived");
                                  await load();
                                } catch (e) {
                                  setError(e instanceof Error ? e.message : "Archive failed");
                                }
                              }}
                              className="text-red-700 hover:underline"
                            >
                              Archive
                            </button>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )
            ))
          )}
        </div>
      ) : (
        <Card>
          {history.length === 0 ? (
            <EmptyState
              title="No history yet"
              description="Once staff complete a checklist for the day, it shows up here."
            />
          ) : (
            <ul className="divide-y divide-black/5 -mx-4">
              {history.map((r) => {
                const pct = r.totalItems === 0 ? 0 : Math.round((r.completedItems / r.totalItems) * 100);
                const tone = pct === 100 ? "text-emerald-700" : pct >= 50 ? "text-amber-700" : "text-red-700";
                return (
                  <li key={r.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="w-12 text-right">
                      <div className={`font-semibold ${tone}`}>{pct}%</div>
                      <div className="text-[10px] text-[var(--color-muted)]">{r.completedItems}/{r.totalItems}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{r.templateName ?? "Checklist"}</div>
                      <div className="text-xs text-[var(--color-muted)]">
                        {fmtDate(r.runDate)}
                        {r.completedByName ? ` · ${r.completedByName}` : ""}
                        {r.notes ? ` · "${r.notes.length > 60 ? r.notes.slice(0, 60) + "…" : r.notes}"` : ""}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      {editor && (
        <TemplateEditor
          draft={editor}
          onChange={setEditor}
          onCancel={() => setEditor(null)}
          onSaved={async (msg) => {
            setEditor(null);
            setInfo(msg);
            await load();
          }}
          onError={setError}
        />
      )}
    </div>
  );
}

function TemplateEditor({
  draft, onChange, onCancel, onSaved, onError,
}: {
  draft: TemplatePayload & { id?: string };
  onChange: (d: TemplatePayload & { id?: string }) => void;
  onCancel: () => void;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const isEdit = !!draft.id;
  const [saving, setSaving] = useState(false);

  const addItem = () => onChange({ ...draft, items: [...draft.items, newItem()] });
  const updateItem = (idx: number, patch: Partial<ChecklistItem>) =>
    onChange({
      ...draft,
      items: draft.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    });
  const removeItem = (idx: number) =>
    onChange({ ...draft, items: draft.items.filter((_, i) => i !== idx) });
  const moveItem = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= draft.items.length) return;
    const next = [...draft.items];
    const [moved] = next.splice(idx, 1);
    next.splice(target, 0, moved);
    onChange({ ...draft, items: next });
  };

  const save = async () => {
    if (!draft.name.trim()) { onError("Template needs a name"); return; }
    if (draft.items.length === 0) { onError("Add at least one item"); return; }
    if (draft.items.some((i) => !i.label.trim())) { onError("Every item needs a label"); return; }
    setSaving(true);
    try {
      const payload: TemplatePayload = {
        name: draft.name.trim(),
        type: draft.type,
        role: draft.role?.trim() || null,
        description: draft.description?.trim() || null,
        items: draft.items.map((i) => ({
          id: i.id,
          label: i.label.trim(),
          requiresPhoto: !!i.requiresPhoto,
          requiresTemperature: !!i.requiresTemperature,
        })),
        active: draft.active ?? true,
      };
      if (isEdit && draft.id) {
        await updateTemplate(draft.id, payload);
        onSaved(`Template updated`);
      } else {
        await createTemplate(payload);
        onSaved(`Template created`);
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-black/5 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{isEdit ? "Edit template" : "New checklist template"}</h2>
          <button type="button" onClick={onCancel} className="text-2xl leading-none text-[var(--color-muted)]" aria-label="Close">×</button>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Name *">
              <input
                className="field-input"
                value={draft.name}
                onChange={(e) => onChange({ ...draft, name: e.target.value })}
                placeholder="Closing checklist"
                autoFocus
              />
            </Field>
            <Field label="Type">
              <select
                className="field-input"
                value={draft.type}
                onChange={(e) => onChange({ ...draft, type: e.target.value as ChecklistType })}
              >
                <option value="OPENING">Opening</option>
                <option value="CLOSING">Closing</option>
                <option value="PERIODIC">Periodic</option>
              </select>
            </Field>
          </div>
          <Field label="For role" hint="Optional. Just a label — anyone with login can still complete it.">
            <input
              className="field-input"
              value={draft.role ?? ""}
              onChange={(e) => onChange({ ...draft, role: e.target.value })}
              placeholder="Cashier"
            />
          </Field>
          <Field label="Description">
            <textarea
              className="field-input min-h-[60px]"
              value={draft.description ?? ""}
              onChange={(e) => onChange({ ...draft, description: e.target.value })}
              placeholder="When to run, who's responsible, gotchas…"
            />
          </Field>

          <div>
            <div className="flex justify-between items-center mb-2">
              <div className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
                Items ({draft.items.length})
              </div>
              <button
                type="button"
                onClick={addItem}
                className="text-sm text-[var(--color-saffron-dark)] hover:underline"
              >
                + Add item
              </button>
            </div>
            <ul className="space-y-2">
              {draft.items.map((it, idx) => (
                <li key={it.id} className="flex items-start gap-2 p-2 rounded-lg ring-1 ring-black/5 bg-[var(--color-cream)]/30">
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => moveItem(idx, -1)}
                      disabled={idx === 0}
                      className="text-xs text-[var(--color-muted)] disabled:opacity-30 hover:text-[var(--color-ink)]"
                      aria-label="Move up"
                    >↑</button>
                    <button
                      type="button"
                      onClick={() => moveItem(idx, 1)}
                      disabled={idx === draft.items.length - 1}
                      className="text-xs text-[var(--color-muted)] disabled:opacity-30 hover:text-[var(--color-ink)]"
                      aria-label="Move down"
                    >↓</button>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <input
                      className="field-input"
                      value={it.label}
                      onChange={(e) => updateItem(idx, { label: e.target.value })}
                      placeholder="What to check"
                    />
                    <div className="flex gap-3 text-xs text-[var(--color-muted)]">
                      <label className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={!!it.requiresPhoto}
                          onChange={(e) => updateItem(idx, { requiresPhoto: e.target.checked })}
                        />
                        Photo required
                      </label>
                      <label className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={!!it.requiresTemperature}
                          onChange={(e) => updateItem(idx, { requiresTemperature: e.target.checked })}
                        />
                        Temperature note
                      </label>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="text-red-700 text-sm self-center"
                    aria-label="Remove item"
                  >×</button>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="sticky bottom-0 bg-white border-t border-black/5 px-6 py-3 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : isEdit ? "Save changes" : "Create"}</Button>
        </div>
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
