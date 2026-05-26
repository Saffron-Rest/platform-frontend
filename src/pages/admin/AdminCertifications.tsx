import { useEffect, useMemo, useState } from "react";
import {
  createCert,
  deleteCert,
  listCerts,
  listCertTypes,
  updateCert,
  uploadCertFile,
  type CertPayload,
  type CertStatus,
  type EmployeeCert,
} from "../../api/certifications";
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

type Filter = "ATTENTION" | "OK" | "ALL";

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso + "T12:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

const statusBadge = (s: CertStatus, days: number | null) => {
  switch (s) {
    case "EXPIRED":
      return {
        cls: "bg-red-100 text-red-800 ring-red-200",
        label: days !== null ? `Expired ${Math.abs(days)}d ago` : "Expired",
      };
    case "URGENT":
      return {
        cls: "bg-orange-100 text-orange-900 ring-orange-200",
        label: days === 0 ? "Expires today" : `${days}d left`,
      };
    case "SOON":
      return { cls: "bg-amber-100 text-amber-900 ring-amber-200", label: `${days}d left` };
    case "OK":
      return {
        cls: "bg-emerald-100 text-emerald-800 ring-emerald-200",
        label: days !== null ? `${days}d` : "OK",
      };
    case "NO_EXPIRY":
      return { cls: "bg-zinc-100 text-zinc-700 ring-zinc-200", label: "No expiry" };
  }
};

type Draft = CertPayload & { id?: string };

const blankDraft = (defaultUserId = ""): Draft => ({
  userId: defaultUserId,
  type: "",
  number: "",
  issuer: "",
  issuedOn: "",
  expiresOn: "",
  notes: "",
  filePath: "",
});

export function AdminCertifications() {
  const [certs, setCerts] = useState<EmployeeCert[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [filter, setFilter] = useState<Filter>("ATTENTION");
  const [search, setSearch] = useState("");
  const [userFilter, setUserFilter] = useState<string>("");

  const [editor, setEditor] = useState<Draft | null>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [c, u, t] = await Promise.all([
        listCerts(),
        api<User[]>("/users"),
        listCertTypes(),
      ]);
      setCerts(c);
      setUsers(u.filter((x) => x.active !== false));
      setTypes(t);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load certifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const counts = useMemo(() => {
    let expired = 0, urgent = 0, soon = 0, ok = 0;
    for (const c of certs) {
      if (c.status === "EXPIRED") expired++;
      else if (c.status === "URGENT") urgent++;
      else if (c.status === "SOON") soon++;
      else ok++;
    }
    return { expired, urgent, soon, ok };
  }, [certs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return certs.filter((c) => {
      if (filter === "ATTENTION" && c.status === "OK") return false;
      if (filter === "ATTENTION" && c.status === "NO_EXPIRY") return false;
      if (filter === "OK" && c.status !== "OK") return false;
      if (userFilter && c.userId !== userFilter) return false;
      if (q) {
        const hay = [c.type, c.number, c.issuer, c.userName, c.notes]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [certs, filter, search, userFilter]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Certifications & training"
        subtitle="Books, licences, BHP, sanepid — alerts 30, 14, 1 days before expiry."
        action={<Button onClick={() => setEditor(blankDraft(userFilter))}>+ Add certificate</Button>}
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile label="Expired" value={String(counts.expired)} hint="Past expiry — block from shift" tone="bad" />
        <KpiTile label="Urgent" value={String(counts.urgent)} hint="≤ 7 days remaining" tone="warn" />
        <KpiTile label="Soon" value={String(counts.soon)} hint="≤ 30 days — plan renewal" tone="info" />
        <KpiTile label="OK" value={String(counts.ok)} hint="More than 30 days out" tone="ok" />
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex gap-1">
            {([
              ["ATTENTION", `Needs attention (${counts.expired + counts.urgent + counts.soon})`],
              ["OK", `OK (${counts.ok})`],
              ["ALL", "All"],
            ] as [Filter, string][]).map(([k, label]) => {
              const active = filter === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFilter(k)}
                  className={`tab-pill shrink-0 ${active ? "tab-pill-active" : "tab-pill-idle"}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 items-center">
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="field-input min-w-[160px]"
            >
              <option value="">All people</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <input
              type="search"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="field-input min-w-[200px] max-w-[260px]"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-10"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Nothing to show"
            description={
              filter === "ATTENTION"
                ? "Nothing needs your attention — every certificate is fresh. Nice."
                : "No certificates match this filter yet."
            }
            action={<Button onClick={() => setEditor(blankDraft(userFilter))}>Add certificate</Button>}
          />
        ) : (
          <div className="overflow-x-auto -mx-4">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
                <tr className="border-b border-black/5">
                  <th className="text-left px-4 py-2">Person</th>
                  <th className="text-left px-4 py-2">Certificate</th>
                  <th className="text-left px-4 py-2">Issued</th>
                  <th className="text-left px-4 py-2">Expires</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-right px-4 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const b = statusBadge(c.status, c.daysUntilExpiry);
                  return (
                    <tr key={c.id} className="border-b border-black/5 last:border-0 hover:bg-[var(--color-cream)]/40">
                      <td className="px-4 py-3 font-medium">{c.userName ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[var(--color-ink)]">{c.type}</div>
                        <div className="text-xs text-[var(--color-muted)]">
                          {c.number ? `#${c.number}` : "—"}
                          {c.issuer ? ` · ${c.issuer}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{fmtDate(c.issuedOn)}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{fmtDate(c.expiresOn)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ring-1 ${b.cls}`}>{b.label}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2 text-xs">
                          {c.filePath && (
                            <a
                              href={`${API_BASE}/uploads/${c.filePath}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-700 hover:underline"
                            >
                              View
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => setEditor({
                              id: c.id,
                              userId: c.userId,
                              type: c.type,
                              number: c.number ?? "",
                              issuer: c.issuer ?? "",
                              issuedOn: c.issuedOn ?? "",
                              expiresOn: c.expiresOn ?? "",
                              notes: c.notes ?? "",
                              filePath: c.filePath ?? "",
                            })}
                            className="text-[var(--color-saffron-dark)] hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!confirm(`Delete ${c.type} for ${c.userName}?`)) return;
                              try {
                                await deleteCert(c.id);
                                setInfo("Certificate removed");
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editor && (
        <CertEditor
          draft={editor}
          users={users}
          types={types}
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

function CertEditor({
  draft, users, types, onChange, onCancel, onSaved, onError,
}: {
  draft: Draft;
  users: User[];
  types: string[];
  onChange: (d: Draft) => void;
  onCancel: () => void;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const isEdit = !!draft.id;
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const { path } = await uploadCertFile(file);
      onChange({ ...draft, filePath: path });
    } catch (e) {
      onError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!draft.userId) { onError("Pick a person"); return; }
    if (!draft.type?.trim()) { onError("Choose a certificate type"); return; }
    setSaving(true);
    try {
      const payload: CertPayload = {
        userId: draft.userId,
        type: draft.type.trim(),
        number: draft.number?.trim() || null,
        issuer: draft.issuer?.trim() || null,
        issuedOn: draft.issuedOn || null,
        expiresOn: draft.expiresOn || null,
        notes: draft.notes?.trim() || null,
        filePath: draft.filePath || null,
      };
      if (isEdit && draft.id) {
        await updateCert(draft.id, payload);
        onSaved("Certificate updated");
      } else {
        await createCert(payload);
        onSaved("Certificate added");
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? "Edit certificate" : "Add certificate"} onClose={onCancel}>
      <div className="space-y-4">
        <Field label="Person *">
          <select
            className="field-input"
            value={draft.userId}
            onChange={(e) => onChange({ ...draft, userId: e.target.value })}
          >
            <option value="">— Select —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name} · {u.role.toLowerCase()}</option>
            ))}
          </select>
        </Field>
        <Field label="Certificate type *">
          <input
            list="cert-types"
            className="field-input"
            value={draft.type}
            onChange={(e) => onChange({ ...draft, type: e.target.value })}
            placeholder="Książeczka sanepidowska"
          />
          <datalist id="cert-types">
            {types.map((t) => <option key={t} value={t} />)}
          </datalist>
        </Field>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Number">
            <input
              className="field-input"
              value={draft.number ?? ""}
              onChange={(e) => onChange({ ...draft, number: e.target.value })}
              placeholder="123/2025"
            />
          </Field>
          <Field label="Issued by">
            <input
              className="field-input"
              value={draft.issuer ?? ""}
              onChange={(e) => onChange({ ...draft, issuer: e.target.value })}
              placeholder="Sanepid Warszawa"
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Issued on">
            <input
              type="date"
              className="field-input"
              value={draft.issuedOn ?? ""}
              onChange={(e) => onChange({ ...draft, issuedOn: e.target.value })}
            />
          </Field>
          <Field label="Expires on" hint="Leave empty for non-expiring certs.">
            <input
              type="date"
              className="field-input"
              value={draft.expiresOn ?? ""}
              onChange={(e) => onChange({ ...draft, expiresOn: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Notes">
          <textarea
            className="field-input min-h-[80px]"
            value={draft.notes ?? ""}
            onChange={(e) => onChange({ ...draft, notes: e.target.value })}
            placeholder="Optional context."
          />
        </Field>
        <Field label="Scan / PDF" hint="Attach a scan of the document for future reference.">
          {draft.filePath ? (
            <div className="flex items-center gap-3">
              <a
                href={`${API_BASE}/uploads/${draft.filePath}`}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-blue-700 hover:underline"
              >
                View attachment ↗
              </a>
              <button
                type="button"
                onClick={() => onChange({ ...draft, filePath: "" })}
                className="text-sm text-red-700 hover:underline"
              >
                Remove
              </button>
            </div>
          ) : (
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                }}
              />
              <span className="px-3 py-1.5 rounded-lg ring-1 ring-black/10 bg-white text-sm hover:bg-[var(--color-cream)]">
                {uploading ? "Uploading…" : "Choose file"}
              </span>
            </label>
          )}
        </Field>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button onClick={save} disabled={saving || uploading}>
          {saving ? "Saving…" : isEdit ? "Save changes" : "Add"}
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
        className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
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
