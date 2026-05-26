import { useEffect, useMemo, useState } from "react";
import {
  createIncident,
  deleteIncident,
  listIncidents,
  reopenIncident,
  resolveIncident,
  severityLabel,
  statusLabel,
  updateIncident,
  uploadIncidentPhoto,
  type Incident,
  type IncidentPayload,
  type IncidentSeverity,
  type IncidentStatus,
} from "../../api/incidents";
import { api } from "../../api/client";
import type { User } from "../../types";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { Spinner } from "../../components/ui/Spinner";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "/api";

const CATEGORY_SUGGESTIONS = [
  "Breakage",
  "Customer complaint",
  "Equipment failure",
  "Slip / accident",
  "Theft / missing cash",
  "Missing delivery",
  "Food safety",
  "Pest control",
  "Other",
];

type Filter = "OPEN" | "ASSIGNED" | "CRITICAL" | "ALL";

const fmtMoney = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : `${n.toFixed(2)} zł`;

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  // accept both YYYY-MM-DD (occurredOn) and full ISO strings
  const d = iso.length === 10 ? new Date(iso + "T12:00:00") : new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

const fmtRelative = (iso: string | null) => {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  const sec = Math.floor((Date.now() - then) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
};

const severityBadge = (s: IncidentSeverity) => {
  switch (s) {
    case "LOW": return { cls: "bg-zinc-100 text-zinc-700 ring-zinc-200", dot: "bg-zinc-400" };
    case "MEDIUM": return { cls: "bg-amber-100 text-amber-900 ring-amber-200", dot: "bg-amber-500" };
    case "HIGH": return { cls: "bg-orange-100 text-orange-900 ring-orange-200", dot: "bg-orange-500" };
    case "CRITICAL": return { cls: "bg-red-100 text-red-800 ring-red-200", dot: "bg-red-600" };
  }
};

const statusBadge = (s: IncidentStatus) => {
  switch (s) {
    case "OPEN": return "bg-blue-100 text-blue-800 ring-blue-200";
    case "IN_PROGRESS": return "bg-violet-100 text-violet-800 ring-violet-200";
    case "RESOLVED": return "bg-emerald-100 text-emerald-800 ring-emerald-200";
    case "DISMISSED": return "bg-zinc-100 text-zinc-600 ring-zinc-200";
  }
};

type Draft = Omit<IncidentPayload, "occurredOn"> & { occurredOn: string; id?: string };

const blankDraft = (): Draft => ({
  title: "",
  category: "",
  occurredOn: new Date().toISOString().slice(0, 10),
  severity: "MEDIUM",
  status: "OPEN",
  description: "",
  estimatedCost: null,
  photoPath: null,
  assigneeId: null,
});

export function AdminIncidents() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [filter, setFilter] = useState<Filter>("OPEN");
  const [search, setSearch] = useState("");

  const [editor, setEditor] = useState<Draft | null>(null);
  const [resolveTarget, setResolveTarget] = useState<Incident | null>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [inc, allUsers] = await Promise.all([
        listIncidents(),
        api<User[]>("/users"),
      ]);
      setIncidents(inc);
      setUsers(allUsers.filter((u) => u.active !== false));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load incidents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const counts = useMemo(() => {
    let open = 0, inProgress = 0, critical = 0, totalCost = 0;
    for (const i of incidents) {
      if (i.status === "OPEN") open++;
      if (i.status === "IN_PROGRESS") inProgress++;
      if ((i.status === "OPEN" || i.status === "IN_PROGRESS") && i.severity === "CRITICAL") critical++;
      if (i.estimatedCost) totalCost += i.estimatedCost;
    }
    return { open, inProgress, critical, totalCost };
  }, [incidents]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return incidents.filter((i) => {
      if (filter === "OPEN" && !(i.status === "OPEN" || i.status === "IN_PROGRESS")) return false;
      if (filter === "ASSIGNED" && !i.assigneeId) return false;
      if (filter === "CRITICAL" && i.severity !== "CRITICAL") return false;
      if (q) {
        const hay = [i.title, i.category, i.description, i.assigneeName, i.reportedByName]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [incidents, filter, search]);

  const userName = (id: string | null) => users.find((u) => u.id === id)?.name ?? "—";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Incidents"
        subtitle="Breakages, complaints, accidents — anything worth a 'this happened' entry."
        action={<Button onClick={() => setEditor(blankDraft())}>+ Report incident</Button>}
      />

      {error && (
        <Alert variant="error">
          <div className="flex items-start justify-between gap-3">
            <span>{error}</span>
            <button type="button" onClick={() => setError("")} className="opacity-70 hover:opacity-100">×</button>
          </div>
        </Alert>
      )}
      {info && (
        <Alert variant="success">
          <div className="flex items-start justify-between gap-3">
            <span>{info}</span>
            <button type="button" onClick={() => setInfo("")} className="opacity-70 hover:opacity-100">×</button>
          </div>
        </Alert>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile label="Open" value={String(counts.open)} hint="Newly filed, unassigned" tone="warn" />
        <KpiTile label="In progress" value={String(counts.inProgress)} hint="Being worked on" tone="info" />
        <KpiTile label="Critical open" value={String(counts.critical)} hint="Severity = critical & not resolved" tone="bad" />
        <KpiTile label="Estimated loss" value={fmtMoney(counts.totalCost)} hint="Sum of estimated costs YTD" tone="neutral" />
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex gap-1">
            {(["OPEN", "ASSIGNED", "CRITICAL", "ALL"] as Filter[]).map((f) => {
              const active = filter === f;
              const label = f === "OPEN"
                ? `Active (${counts.open + counts.inProgress})`
                : f === "ASSIGNED"
                ? "Assigned"
                : f === "CRITICAL"
                ? `Critical (${counts.critical})`
                : "All";
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`tab-pill shrink-0 ${active ? "tab-pill-active" : "tab-pill-idle"}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <input
            type="search"
            placeholder="Search by title, category, description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="field-input min-w-[240px] max-w-[340px]"
          />
        </div>

        {loading ? (
          <div className="py-10"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No incidents match"
            description={
              filter === "ALL"
                ? "Nothing has been reported yet. Quiet is good — or maybe nobody's writing them down."
                : "No incidents match this filter."
            }
            action={<Button onClick={() => setEditor(blankDraft())}>Report incident</Button>}
          />
        ) : (
          <ul className="divide-y divide-black/5 -mx-4">
            {filtered.map((i) => {
              const sev = severityBadge(i.severity);
              const isResolved = i.status === "RESOLVED" || i.status === "DISMISSED";
              return (
                <li key={i.id} className={`px-4 py-3 ${isResolved ? "opacity-75" : ""}`}>
                  <div className="flex items-start gap-3">
                    {i.photoPath && (
                      <img
                        src={`${API_BASE}/uploads/${i.photoPath}`}
                        alt=""
                        className="w-14 h-14 rounded-lg object-cover ring-1 ring-black/10 shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setEditor({
                            id: i.id,
                            title: i.title,
                            category: i.category ?? "",
                            occurredOn: i.occurredOn,
                            severity: i.severity,
                            status: i.status,
                            description: i.description ?? "",
                            estimatedCost: i.estimatedCost ?? null,
                            photoPath: i.photoPath ?? null,
                            assigneeId: i.assigneeId ?? null,
                          })}
                          className="font-semibold text-[var(--color-ink)] hover:underline text-left"
                        >
                          {i.title}
                        </button>
                        <span className={`text-xs px-2 py-0.5 rounded-full ring-1 ${sev.cls}`}>
                          <span className={`inline-block w-1.5 h-1.5 rounded-full ${sev.dot} mr-1.5`} />
                          {severityLabel(i.severity)}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ring-1 ${statusBadge(i.status)}`}>
                          {statusLabel(i.status)}
                        </span>
                        {i.category && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-cream)] text-[var(--color-muted)]">
                            {i.category}
                          </span>
                        )}
                      </div>
                      {i.description && (
                        <p className="text-sm text-[var(--color-ink)]/85 mt-1 line-clamp-2">{i.description}</p>
                      )}
                      <div className="text-xs text-[var(--color-muted)] mt-1.5 flex gap-3 flex-wrap">
                        <span>📅 {fmtDate(i.occurredOn)}</span>
                        <span>· {i.reportedByName ?? "—"} reported</span>
                        {i.assigneeName && <span>· 👤 {i.assigneeName}</span>}
                        {i.estimatedCost ? <span>· {fmtMoney(i.estimatedCost)}</span> : null}
                        {i.resolvedAt && <span>· ✓ resolved {fmtRelative(i.resolvedAt)}</span>}
                      </div>
                      {i.resolutionNotes && (
                        <p className="text-xs text-[var(--color-muted)] mt-1 italic">
                          Resolution: {i.resolutionNotes}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 text-xs shrink-0">
                      {!isResolved ? (
                        <button
                          type="button"
                          onClick={() => setResolveTarget(i)}
                          className="text-emerald-700 hover:underline"
                        >
                          Resolve
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await reopenIncident(i.id);
                              setInfo(`Reopened "${i.title}"`);
                              await load();
                            } catch (e) {
                              setError(e instanceof Error ? e.message : "Reopen failed");
                            }
                          }}
                          className="text-blue-700 hover:underline"
                        >
                          Reopen
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm(`Delete "${i.title}"? This cannot be undone.`)) return;
                          try {
                            await deleteIncident(i.id);
                            setInfo("Incident deleted");
                            await load();
                          } catch (e) {
                            setError(e instanceof Error ? e.message : "Delete failed");
                          }
                        }}
                        className="text-red-700 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {editor && (
        <IncidentEditor
          draft={editor}
          users={users}
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

      {resolveTarget && (
        <ResolveModal
          incident={resolveTarget}
          onCancel={() => setResolveTarget(null)}
          onDone={async (msg) => {
            setResolveTarget(null);
            setInfo(msg);
            await load();
          }}
          onError={setError}
        />
      )}
    </div>
  );
}

function KpiTile({ label, value, hint, tone }: {
  label: string;
  value: string;
  hint?: string;
  tone: "ok" | "warn" | "bad" | "info" | "neutral";
}) {
  const toneCls = {
    ok: "border-emerald-200/60 bg-emerald-50/40",
    warn: "border-amber-200/60 bg-amber-50/40",
    bad: "border-red-200/60 bg-red-50/40",
    info: "border-blue-200/60 bg-blue-50/40",
    neutral: "border-black/5 bg-[var(--color-cream)]/60",
  }[tone];
  return (
    <div className={`rounded-xl border ${toneCls} p-3`}>
      <div className="text-xs uppercase tracking-wider text-[var(--color-muted)]">{label}</div>
      <div className="text-2xl font-semibold text-[var(--color-ink)] mt-1">{value}</div>
      {hint && <div className="text-xs text-[var(--color-muted)] mt-1">{hint}</div>}
    </div>
  );
}

function IncidentEditor({
  draft, users, onChange, onCancel, onSaved, onError,
}: {
  draft: Draft;
  users: User[];
  onChange: (d: Draft) => void;
  onCancel: () => void;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const isEdit = !!draft.id;
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handlePhoto = async (file: File) => {
    setUploading(true);
    try {
      const { path } = await uploadIncidentPhoto(file);
      onChange({ ...draft, photoPath: path });
    } catch (e) {
      onError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!draft.title.trim()) { onError("Title is required"); return; }
    setSaving(true);
    try {
      const payload: IncidentPayload = {
        title: draft.title.trim(),
        category: draft.category?.trim() || null,
        occurredOn: draft.occurredOn,
        severity: draft.severity,
        status: draft.status,
        description: draft.description?.trim() || null,
        estimatedCost: draft.estimatedCost,
        photoPath: draft.photoPath,
        assigneeId: draft.assigneeId,
      };
      if (isEdit && draft.id) {
        await updateIncident(draft.id, payload);
        onSaved(`Updated "${payload.title}"`);
      } else {
        await createIncident(payload);
        onSaved(`Reported "${payload.title}"`);
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? "Edit incident" : "Report incident"} onClose={onCancel}>
      <div className="space-y-4">
        <Field label="What happened? *">
          <input
            className="field-input"
            value={draft.title}
            onChange={(e) => onChange({ ...draft, title: e.target.value })}
            placeholder="Plate dropped during dinner service"
            autoFocus
          />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Category">
            <input
              list="incident-categories"
              className="field-input"
              value={draft.category ?? ""}
              onChange={(e) => onChange({ ...draft, category: e.target.value })}
              placeholder="Choose or type…"
            />
            <datalist id="incident-categories">
              {CATEGORY_SUGGESTIONS.map((c) => <option key={c} value={c} />)}
            </datalist>
          </Field>
          <Field label="When">
            <input
              type="date"
              className="field-input"
              value={draft.occurredOn}
              onChange={(e) => onChange({ ...draft, occurredOn: e.target.value })}
            />
          </Field>
        </div>

        <Field label="Severity">
          <div className="grid grid-cols-4 gap-1.5">
            {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as IncidentSeverity[]).map((s) => {
              const active = draft.severity === s;
              const sev = severityBadge(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => onChange({ ...draft, severity: s })}
                  className={`px-3 py-2 rounded-lg text-sm border transition ${
                    active
                      ? `border-[var(--color-saffron)] ${sev.cls.replace('ring-', 'bg-').split(' ')[0]} text-[var(--color-ink)]`
                      : "border-black/10 hover:bg-[var(--color-cream)]"
                  }`}
                >
                  <span className={`inline-block w-2 h-2 rounded-full ${sev.dot} mr-1.5`} />
                  {severityLabel(s)}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Description" hint="What exactly happened? Include any details a future reader will want.">
          <textarea
            className="field-input min-h-[100px]"
            value={draft.description ?? ""}
            onChange={(e) => onChange({ ...draft, description: e.target.value })}
            placeholder="Around 19:30, table 7, customer dropped the soup bowl…"
          />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Assign to" hint="They'll get a notification.">
            <select
              className="field-input"
              value={draft.assigneeId ?? ""}
              onChange={(e) => onChange({ ...draft, assigneeId: e.target.value || null })}
            >
              <option value="">— Nobody yet —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name} · {u.role.toLowerCase()}</option>
              ))}
            </select>
          </Field>
          <Field label="Estimated cost (zł)" hint="Replacement, refund, lost cash — anything that hits P&L.">
            <input
              type="number"
              step="any"
              className="field-input"
              value={draft.estimatedCost ?? ""}
              onChange={(e) => onChange({ ...draft, estimatedCost: e.target.value === "" ? null : Number(e.target.value) })}
              placeholder="0.00"
            />
          </Field>
        </div>

        <Field label="Photo" hint="Optional. Helps identify the equipment / damage / receipt later.">
          {draft.photoPath ? (
            <div className="flex items-center gap-3">
              <img
                src={`${API_BASE}/uploads/${draft.photoPath}`}
                alt=""
                className="w-24 h-24 rounded-lg object-cover ring-1 ring-black/10"
              />
              <button
                type="button"
                onClick={() => onChange({ ...draft, photoPath: null })}
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

        {isEdit && (
          <Field label="Status">
            <select
              className="field-input"
              value={draft.status ?? "OPEN"}
              onChange={(e) => onChange({ ...draft, status: e.target.value as IncidentStatus })}
            >
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In progress</option>
            </select>
          </Field>
        )}
      </div>

      <div className="flex justify-end gap-2 mt-6">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button onClick={save} disabled={saving || uploading}>
          {saving ? "Saving…" : isEdit ? "Save changes" : "Report"}
        </Button>
      </div>
    </Modal>
  );
}

function ResolveModal({
  incident, onCancel, onDone, onError,
}: {
  incident: Incident;
  onCancel: () => void;
  onDone: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [notes, setNotes] = useState("");
  const [dismiss, setDismiss] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!notes.trim()) { onError("Add resolution notes — they're searchable later."); return; }
    setSaving(true);
    try {
      await resolveIncident(incident.id, notes.trim(), dismiss);
      onDone(`${dismiss ? "Dismissed" : "Resolved"}: "${incident.title}"`);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Resolve failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Resolve · ${incident.title}`} onClose={onCancel}>
      <div className="space-y-4">
        <Field label="What was done? *" hint="One paragraph. Mention parts ordered, refund issued, staff trained, etc.">
          <textarea
            autoFocus
            className="field-input min-h-[120px]"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Refunded customer, talked to kitchen about plating, ordered replacement bowls from Makro."
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={dismiss} onChange={(e) => setDismiss(e.target.checked)} />
          <span>
            Mark as <strong>dismissed</strong> instead (false alarm / duplicate / customer withdrew)
          </span>
        </label>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button onClick={submit} disabled={saving}>
          {saving ? "Saving…" : dismiss ? "Dismiss" : "Resolve"}
        </Button>
      </div>
    </Modal>
  );
}

function Modal({ title, onClose, children }: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-black/5 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--color-muted)] hover:text-[var(--color-ink)] text-2xl leading-none"
            aria-label="Close"
          >×</button>
        </div>
        <div className="p-6">{children}</div>
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
