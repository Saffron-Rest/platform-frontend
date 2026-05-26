import { useEffect, useMemo, useState } from "react";
import {
  todayChecklists,
  uploadChecklistPhoto,
  upsertRun,
  type ChecklistResponse,
  type ChecklistTemplate,
  type ChecklistType,
  type TodayChecklist,
} from "../api/checklists";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";
import { Spinner } from "../components/ui/Spinner";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "/api";

const TYPE_LABEL: Record<ChecklistType, string> = {
  OPENING: "Opening",
  CLOSING: "Closing",
  PERIODIC: "Periodic",
};

const TYPE_TONE: Record<ChecklistType, string> = {
  OPENING: "bg-emerald-50 border-emerald-200",
  CLOSING: "bg-violet-50 border-violet-200",
  PERIODIC: "bg-amber-50 border-amber-200",
};

const todayIso = () => new Date().toISOString().slice(0, 10);

export function DailyChecklists() {
  const [data, setData] = useState<TodayChecklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [date, setDate] = useState(todayIso());

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await todayChecklists(date);
      setData(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [date]);

  const summary = useMemo(() => {
    let done = 0, started = 0;
    for (const row of data) {
      if (!row.run) continue;
      if (row.run.completedItems >= row.run.totalItems && row.run.totalItems > 0) done++;
      else started++;
    }
    return { done, started, total: data.length };
  }, [data]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Checklists"
        subtitle="Tick items off as you go — they auto-save when you leave the page."
        action={
          <input
            type="date"
            value={date}
            max={todayIso()}
            onChange={(e) => setDate(e.target.value)}
            className="field-input"
          />
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

      {loading ? (
        <Card><div className="py-10"><Spinner /></div></Card>
      ) : data.length === 0 ? (
        <Card>
          <EmptyState
            title="No checklists set up yet"
            description="Ask an admin to create some templates in Admin → Checklists."
          />
        </Card>
      ) : (
        <>
          <div className="text-sm text-[var(--color-muted)]">
            {summary.done} complete · {summary.started} in progress · {summary.total - summary.done - summary.started} not started
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.map((row) => (
              <ChecklistCard
                key={row.template.id}
                template={row.template}
                runDate={date}
                initialResponses={row.run?.responses ?? {}}
                initialNotes={row.run?.notes ?? ""}
                onSaved={(msg) => {
                  setInfo(msg);
                  void load();
                }}
                onError={setError}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ChecklistCard({
  template, runDate, initialResponses, initialNotes, onSaved, onError,
}: {
  template: ChecklistTemplate;
  runDate: string;
  initialResponses: Record<string, ChecklistResponse>;
  initialNotes: string;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [responses, setResponses] = useState<Record<string, ChecklistResponse>>(initialResponses);
  const [notes, setNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(true);

  // Sync when the parent passes a fresh run (e.g. after reload).
  useEffect(() => { setResponses(initialResponses); }, [initialResponses]);
  useEffect(() => { setNotes(initialNotes); }, [initialNotes]);

  const completed = useMemo(
    () => template.items.reduce((acc, it) => acc + (responses[it.id]?.checked ? 1 : 0), 0),
    [responses, template.items],
  );
  const pct = template.items.length === 0 ? 0 : Math.round((completed / template.items.length) * 100);

  const toggle = (itemId: string, patch: Partial<ChecklistResponse>) => {
    setResponses((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] ?? { checked: false }), ...patch },
    }));
  };

  const uploadPhoto = async (itemId: string, file: File) => {
    try {
      const { path } = await uploadChecklistPhoto(file);
      toggle(itemId, { photoPath: path });
    } catch (e) {
      onError(e instanceof Error ? e.message : "Upload failed");
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await upsertRun(template.id, { runDate, responses, notes });
      onSaved(`Saved ${template.name}`);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className={`border ${TYPE_TONE[template.type]}`}>
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-left flex-1 min-w-0"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-[var(--color-ink)]">{template.name}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white ring-1 ring-black/10 text-[var(--color-muted)]">
              {TYPE_LABEL[template.type]}
            </span>
            {template.role && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-white ring-1 ring-black/10 text-[var(--color-muted)]">
                {template.role}
              </span>
            )}
          </div>
          {template.description && (
            <p className="text-xs text-[var(--color-muted)] mt-1 line-clamp-1">{template.description}</p>
          )}
        </button>
        <div className="text-right">
          <div className="font-semibold text-[var(--color-ink)]">{completed}/{template.items.length}</div>
          <div className="text-xs text-[var(--color-muted)]">{pct}%</div>
        </div>
      </div>

      <div className="mt-2 h-1 rounded-full bg-black/5 overflow-hidden">
        <div
          className="h-full bg-[var(--color-saffron)]"
          style={{ width: `${pct}%` }}
        />
      </div>

      {open && (
        <>
          <ul className="mt-4 space-y-1.5">
            {template.items.map((it) => {
              const resp = responses[it.id] ?? { checked: false };
              return (
                <li key={it.id} className="rounded-lg bg-white ring-1 ring-black/5 p-2.5">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!resp.checked}
                      onChange={(e) => toggle(it.id, { checked: e.target.checked })}
                      className="mt-1 w-5 h-5 accent-[var(--color-saffron)]"
                    />
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm ${resp.checked ? "line-through text-[var(--color-muted)]" : "text-[var(--color-ink)]"}`}>
                        {it.label}
                      </div>
                      {(it.requiresPhoto || it.requiresTemperature) && (
                        <div className="text-[10px] text-[var(--color-muted)] mt-0.5">
                          {it.requiresPhoto && "Photo required"}
                          {it.requiresPhoto && it.requiresTemperature && " · "}
                          {it.requiresTemperature && "Temperature note required"}
                        </div>
                      )}
                    </div>
                  </label>
                  {(resp.checked || resp.notes || resp.photoPath) && (
                    <div className="mt-2 pl-7 space-y-1.5">
                      {it.requiresTemperature && (
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="Temperature / reading"
                          value={resp.notes ?? ""}
                          onChange={(e) => toggle(it.id, { notes: e.target.value })}
                          className="field-input py-1 text-sm"
                        />
                      )}
                      {!it.requiresTemperature && (
                        <input
                          type="text"
                          placeholder="Notes (optional)"
                          value={resp.notes ?? ""}
                          onChange={(e) => toggle(it.id, { notes: e.target.value })}
                          className="field-input py-1 text-sm"
                        />
                      )}
                      <div className="flex items-center gap-2">
                        {resp.photoPath ? (
                          <>
                            <img
                              src={`${API_BASE}/uploads/${resp.photoPath}`}
                              alt=""
                              className="w-12 h-12 rounded object-cover ring-1 ring-black/10"
                            />
                            <button
                              type="button"
                              onClick={() => toggle(it.id, { photoPath: undefined })}
                              className="text-xs text-red-700 hover:underline"
                            >
                              Remove photo
                            </button>
                          </>
                        ) : (
                          <label className="text-xs text-[var(--color-saffron-dark)] hover:underline cursor-pointer">
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) void uploadPhoto(it.id, f);
                              }}
                            />
                            📷 Add photo
                          </label>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <textarea
            placeholder="Shift notes (anything the next shift should know?)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="field-input mt-3 min-h-[60px] text-sm"
          />

          <div className="mt-3 flex justify-end">
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
