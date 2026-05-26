import { useEffect, useMemo, useState } from "react";
import {
  createHaccp,
  deleteHaccp,
  exportHaccpPdf,
  KIND_LABEL,
  listHaccp,
  uploadHaccpPhoto,
  type HaccpKind,
  type HaccpLog,
  type HaccpPayload,
  type HaccpStatus,
} from "../api/haccp";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";
import { Spinner } from "../components/ui/Spinner";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "/api";

const KIND_ICON: Record<HaccpKind, string> = {
  FRIDGE_TEMP: "❄",
  FREEZER_TEMP: "❄❄",
  COOK_TEMP: "🔥",
  CLEANING: "🧽",
  DELIVERY: "📦",
  PEST_CONTROL: "🐛",
  OTHER: "📝",
};

const todayIso = () => new Date().toISOString().slice(0, 10);
const daysAgoIso = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

const statusBadge = (s: HaccpStatus) => {
  switch (s) {
    case "OK": return "bg-emerald-100 text-emerald-800 ring-emerald-200";
    case "ATTENTION": return "bg-amber-100 text-amber-900 ring-amber-200";
    case "CORRECTIVE_ACTION": return "bg-red-100 text-red-800 ring-red-200";
  }
};

export function HaccpLogs() {
  const [logs, setLogs] = useState<HaccpLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [from, setFrom] = useState(daysAgoIso(7));
  const [to, setTo] = useState(todayIso());
  const [kindFilter, setKindFilter] = useState<HaccpKind | "">("");
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await listHaccp(from, to, kindFilter || undefined);
      setLogs(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [from, to, kindFilter]);

  const grouped = useMemo(() => {
    const m = new Map<string, HaccpLog[]>();
    for (const l of logs) {
      const arr = m.get(l.recordedOn) ?? [];
      arr.push(l);
      m.set(l.recordedOn, arr);
    }
    return Array.from(m.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [logs]);

  const exportPdf = async () => {
    try {
      const blob = await exportHaccpPdf(from, to);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `haccp-${from}_${to}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="HACCP log"
        subtitle="Daily food-safety checks — temperatures, cleaning, deliveries."
        action={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={exportPdf}
              className="px-3 py-1.5 rounded-lg ring-1 ring-black/10 bg-white text-sm hover:bg-[var(--color-cream)]"
            >
              Export PDF
            </button>
            <Button onClick={() => setCreating(true)}>+ Log entry</Button>
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

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="From">
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="field-input" />
          </Field>
          <Field label="To">
            <input type="date" value={to} max={todayIso()} onChange={(e) => setTo(e.target.value)} className="field-input" />
          </Field>
          <Field label="Kind">
            <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as HaccpKind | "")} className="field-input">
              <option value="">All kinds</option>
              {(Object.keys(KIND_LABEL) as HaccpKind[]).map((k) => (
                <option key={k} value={k}>{KIND_LABEL[k]}</option>
              ))}
            </select>
          </Field>
          <div className="ml-auto text-sm text-[var(--color-muted)]">{logs.length} entr{logs.length === 1 ? "y" : "ies"}</div>
        </div>
      </Card>

      {loading ? (
        <Card><div className="py-10"><Spinner /></div></Card>
      ) : logs.length === 0 ? (
        <Card>
          <EmptyState
            title="No entries yet"
            description="Start with today's fridge temperatures. Even a one-line entry counts."
            action={<Button onClick={() => setCreating(true)}>Log entry</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {grouped.map(([date, items]) => (
            <Card key={date}>
              <div className="text-xs uppercase tracking-wider text-[var(--color-muted)] mb-2">
                {new Date(date + "T12:00:00").toLocaleDateString(undefined, {
                  weekday: "long", year: "numeric", month: "short", day: "numeric",
                })}
              </div>
              <ul className="divide-y divide-black/5 -mx-4">
                {items.map((l) => (
                  <li key={l.id} className="px-4 py-2.5 flex items-start gap-3">
                    {l.photoPath && (
                      <img
                        src={`${API_BASE}/uploads/${l.photoPath}`}
                        alt=""
                        className="w-10 h-10 rounded-lg object-cover ring-1 ring-black/10 shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap text-sm">
                        <span aria-hidden>{KIND_ICON[l.kind]}</span>
                        <span className="font-medium text-[var(--color-ink)]">{KIND_LABEL[l.kind]}</span>
                        {l.location && <span className="text-[var(--color-muted)]">· {l.location}</span>}
                        {l.temperatureC !== null && (
                          <span className="font-mono text-[var(--color-ink)]">{l.temperatureC.toFixed(1)}°C</span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full ring-1 ${statusBadge(l.status)}`}>
                          {l.status === "CORRECTIVE_ACTION" ? "Action taken" : l.status === "ATTENTION" ? "Attention" : "OK"}
                        </span>
                      </div>
                      {l.notes && (
                        <div className="text-xs text-[var(--color-muted)] mt-0.5">{l.notes}</div>
                      )}
                      <div className="text-[10px] text-[var(--color-muted)] mt-0.5">
                        {fmtTime(l.recordedAt)} · {l.recordedByName ?? "—"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm("Delete this entry? Inspectors expect a continuous log.")) return;
                        try {
                          await deleteHaccp(l.id);
                          setInfo("Entry deleted");
                          await load();
                        } catch (e) {
                          setError(e instanceof Error ? e.message : "Delete failed");
                        }
                      }}
                      className="text-xs text-red-700 hover:underline self-center"
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}

      {creating && (
        <HaccpCreator
          onCancel={() => setCreating(false)}
          onSaved={async (msg) => {
            setCreating(false);
            setInfo(msg);
            await load();
          }}
          onError={setError}
        />
      )}
    </div>
  );
}

function HaccpCreator({ onCancel, onSaved, onError }: {
  onCancel: () => void;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [draft, setDraft] = useState<HaccpPayload>({
    kind: "FRIDGE_TEMP",
    recordedOn: todayIso(),
    location: "",
    temperatureC: null,
    status: "OK",
    notes: "",
    photoPath: null,
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const showTemp = draft.kind === "FRIDGE_TEMP" || draft.kind === "FREEZER_TEMP" || draft.kind === "COOK_TEMP";

  const handlePhoto = async (file: File) => {
    setUploading(true);
    try {
      const { path } = await uploadHaccpPhoto(file);
      setDraft((d) => ({ ...d, photoPath: path }));
    } catch (e) {
      onError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await createHaccp({
        ...draft,
        location: draft.location?.trim() || null,
        notes: draft.notes?.trim() || null,
      });
      onSaved("Entry logged");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-black/5 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Log HACCP entry</h2>
          <button type="button" onClick={onCancel} className="text-2xl leading-none text-[var(--color-muted)]" aria-label="Close">×</button>
        </div>
        <div className="p-6 space-y-4">
          <Field label="Kind">
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
              {(Object.keys(KIND_LABEL) as HaccpKind[]).map((k) => {
                const active = draft.kind === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setDraft({ ...draft, kind: k })}
                    className={`px-2.5 py-2 rounded-lg text-xs border ${
                      active
                        ? "border-[var(--color-saffron)] bg-[var(--color-saffron)]/15"
                        : "border-black/10 hover:bg-[var(--color-cream)]"
                    }`}
                  >
                    <div className="text-base">{KIND_ICON[k]}</div>
                    {KIND_LABEL[k]}
                  </button>
                );
              })}
            </div>
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Date">
              <input
                type="date"
                value={draft.recordedOn ?? ""}
                onChange={(e) => setDraft({ ...draft, recordedOn: e.target.value })}
                className="field-input"
              />
            </Field>
            <Field label="Where" hint="Walk-in 1, Display fridge…">
              <input
                value={draft.location ?? ""}
                onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                placeholder="Walk-in 1"
                className="field-input"
              />
            </Field>
          </div>
          {showTemp && (
            <Field label="Temperature (°C)">
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={draft.temperatureC ?? ""}
                onChange={(e) => setDraft({ ...draft, temperatureC: e.target.value === "" ? null : Number(e.target.value) })}
                className="field-input"
                placeholder="4.0"
              />
            </Field>
          )}
          <Field label="Status">
            <div className="grid grid-cols-3 gap-1.5">
              {(["OK", "ATTENTION", "CORRECTIVE_ACTION"] as HaccpStatus[]).map((s) => {
                const active = draft.status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setDraft({ ...draft, status: s })}
                    className={`px-3 py-2 rounded-lg text-sm border ${
                      active
                        ? "border-[var(--color-saffron)] bg-[var(--color-saffron)]/15"
                        : "border-black/10 hover:bg-[var(--color-cream)]"
                    }`}
                  >
                    {s === "OK" ? "OK" : s === "ATTENTION" ? "Attention" : "Action taken"}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="Notes" hint={draft.status === "CORRECTIVE_ACTION" ? "What did you do about it?" : "Optional."}>
            <textarea
              value={draft.notes ?? ""}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              className="field-input min-h-[80px]"
              placeholder={draft.kind === "DELIVERY" ? "Supplier, batch, packaging condition…" : ""}
            />
          </Field>
          <Field label="Photo">
            {draft.photoPath ? (
              <div className="flex items-center gap-3">
                <img
                  src={`${API_BASE}/uploads/${draft.photoPath}`}
                  alt=""
                  className="w-20 h-20 rounded-lg object-cover ring-1 ring-black/10"
                />
                <button
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, photoPath: null }))}
                  className="text-sm text-red-700 hover:underline"
                >
                  Remove
                </button>
              </div>
            ) : (
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handlePhoto(f);
                  }}
                />
                <span className="px-3 py-1.5 rounded-lg ring-1 ring-black/10 bg-white text-sm hover:bg-[var(--color-cream)]">
                  {uploading ? "Uploading…" : "Choose photo"}
                </span>
              </label>
            )}
          </Field>
        </div>
        <div className="border-t border-black/5 px-6 py-3 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving || uploading}>{saving ? "Saving…" : "Log"}</Button>
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
