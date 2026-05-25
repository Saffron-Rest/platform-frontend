import { useEffect, useState } from "react";
import {
  createTag,
  deleteTag,
  listTags,
  updateTag,
  type Tag,
  type TagPayload,
} from "../../api/tags";
import { invalidateTagLibrary } from "../../components/tags/TagPicker";
import { TagChip } from "../../components/tags/TagChip";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { Spinner } from "../../components/ui/Spinner";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";

/** Curated colour palette so admins don't have to think about hex codes.
 *  Same colours TagChip's fallback uses, plus a few extras. */
const COLOR_PRESETS = [
  "#E07A5F", "#3D5A80", "#81B29A", "#F2CC8F",
  "#A37774", "#6D597A", "#B56576", "#355070",
  "#2F80ED", "#27AE60", "#EB5757", "#F2994A",
];

type FormState = {
  id?: string;
  name: string;
  color: string | null;
  description: string;
};

const blank: FormState = { name: "", color: null, description: "" };

/** Admin-only library for the tag system. Tags created here are then
 *  selectable from the inline TagPicker on every list page. */
export function AdminTagLibrary() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState<FormState>(blank);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setTags(await listTags());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tags");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const startCreate = () => setForm(blank);

  const startEdit = (t: Tag) =>
    setForm({
      id: t.id,
      name: t.name,
      color: t.color ?? null,
      description: t.description ?? "",
    });

  const save = async () => {
    if (!form.name.trim()) {
      setError("Tag name is required");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload: TagPayload = {
        name: form.name.trim(),
        color: form.color,
        description: form.description.trim() || null,
      };
      if (form.id) {
        await updateTag(form.id, payload);
        setMessage(`Tag "${form.name}" updated`);
      } else {
        await createTag(payload);
        setMessage(`Tag "${form.name}" created`);
      }
      setForm(blank);
      invalidateTagLibrary();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save tag");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (t: Tag) => {
    const usage = t.usageCount ?? 0;
    const detail =
      usage > 0
        ? `\n\nThis tag is currently on ${usage} record${usage === 1 ? "" : "s"}. Those records will lose the tag.`
        : "";
    if (!confirm(`Delete tag "${t.name}"?${detail}`)) return;
    try {
      await deleteTag(t.id);
      setMessage(`Tag "${t.name}" deleted`);
      invalidateTagLibrary();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tag library"
        subtitle="Custom labels you can apply to reports, expenses, payouts and delivery income"
      />

      {error && <Alert variant="error">{error}</Alert>}
      {message && <Alert variant="success">{message}</Alert>}

      <Card>
        <h3 className="font-semibold mb-3">{form.id ? "Edit tag" : "New tag"}</h3>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-end">
          <label className="field-label">
            Name
            <input
              type="text"
              maxLength={64}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="field-input"
              placeholder="e.g. Investigate, Owner expense, Black Friday"
            />
          </label>
          <div className="flex items-center gap-2">
            {form.name.trim() && (
              <TagChip
                tag={{ id: form.id ?? "preview", name: form.name.trim(), color: form.color }}
              />
            )}
          </div>
        </div>
        <label className="field-label mt-3">
          Description (optional)
          <input
            type="text"
            maxLength={200}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="field-input"
            placeholder="When should this tag be used?"
          />
        </label>
        <div className="mt-3">
          <p className="text-xs uppercase tracking-wide text-[var(--color-muted)] mb-2">
            Colour
          </p>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, color: null }))}
              className={`w-7 h-7 rounded-full border-2 ${
                form.color == null
                  ? "border-[var(--color-saffron)]"
                  : "border-transparent"
              }`}
              style={{
                background:
                  "repeating-linear-gradient(45deg, #ddd 0 4px, #fff 4px 8px)",
              }}
              title="Auto (deterministic colour)"
            />
            {COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setForm((f) => ({ ...f, color: c }))}
                className={`w-7 h-7 rounded-full border-2 ${
                  form.color === c
                    ? "border-[var(--color-saffron)]"
                    : "border-transparent"
                }`}
                style={{ background: c }}
                title={c}
              />
            ))}
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : form.id ? "Save changes" : "Create tag"}
          </Button>
          {form.id && (
            <Button variant="ghost" onClick={startCreate} disabled={saving}>
              Cancel
            </Button>
          )}
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner label="Loading tags…" />
        </div>
      ) : tags.length === 0 ? (
        <EmptyState
          title="No tags yet"
          description="Create your first tag above. Tags help you label records for later filtering and search."
        />
      ) : (
        <Card>
          <h3 className="font-semibold mb-3">{tags.length} tag{tags.length === 1 ? "" : "s"}</h3>
          <ul className="divide-y divide-black/5">
            {tags.map((t) => (
              <li
                key={t.id}
                className="py-3 flex flex-wrap items-center gap-3 justify-between"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <TagChip tag={t} />
                  {t.description && (
                    <span className="text-sm text-[var(--color-muted)] truncate">
                      {t.description}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-[var(--color-muted)] tabular-nums">
                    {t.usageCount ?? 0} use{(t.usageCount ?? 0) === 1 ? "" : "s"}
                  </span>
                  <button
                    type="button"
                    className="text-xs font-medium text-[var(--color-saffron-dark)] hover:underline"
                    onClick={() => startEdit(t)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="text-xs font-medium text-red-600 hover:underline"
                    onClick={() => void remove(t)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
