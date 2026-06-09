import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useConfirm } from "../context/ConfirmContext";
import {
  listSuppliers,
  createSupplier,
  updateSupplier,
  deactivateSupplier,
  reactivateSupplier,
  type Supplier,
  type SupplierInput,
} from "../api/suppliers";
import { PageHeader } from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";
import { Badge } from "../components/ui/Badge";
import { Spinner } from "../components/ui/Spinner";
import { EmptyState } from "../components/ui/EmptyState";
import { DialogBody, DialogFooter, DialogForm, DialogTitle } from "../components/ui/Dialog";
import { Field, Input, Textarea } from "../components/ui/Field";

// ─── form draft ──────────────────────────────────────────────────────────────

type Draft = {
  name: string;
  contactName: string;
  phone: string;
  email: string;
  vatId: string;
  address: string;
  paymentTermsDays: string;
  bankAccountNumber: string;
  bankName: string;
  bankBicSwift: string;
  notes: string;
};

const blankDraft = (): Draft => ({
  name: "", contactName: "", phone: "", email: "", vatId: "",
  address: "", paymentTermsDays: "14", bankAccountNumber: "",
  bankName: "", bankBicSwift: "", notes: "",
});

const supplierToDraft = (s: Supplier): Draft => ({
  name: s.name,
  contactName: s.contactName ?? "",
  phone: s.phone ?? "",
  email: s.email ?? "",
  vatId: s.vatId ?? "",
  address: s.address ?? "",
  paymentTermsDays: String(s.paymentTermsDays),
  bankAccountNumber: s.bankAccountNumber ?? "",
  bankName: s.bankName ?? "",
  bankBicSwift: s.bankBicSwift ?? "",
  notes: s.notes ?? "",
});

const draftToInput = (d: Draft): SupplierInput => ({
  name: d.name.trim(),
  contactName: d.contactName.trim() || null,
  phone: d.phone.trim() || null,
  email: d.email.trim() || null,
  vatId: d.vatId.trim() || null,
  address: d.address.trim() || null,
  paymentTermsDays: parseInt(d.paymentTermsDays, 10) || 14,
  bankAccountNumber: d.bankAccountNumber.trim() || null,
  bankName: d.bankName.trim() || null,
  bankBicSwift: d.bankBicSwift.trim() || null,
  notes: d.notes.trim() || null,
});

// ─── page ─────────────────────────────────────────────────────────────────────

export function SuppliersPanel({ asTab }: { asTab?: boolean } = {}) {
  const { hasPermission } = useAuth();
  const confirm = useConfirm();
  const canManage = hasPermission("PAYABLES_MANAGE");

  const [suppliers,       setSuppliers]       = useState<Supplier[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState<string | null>(null);
  const [showInactive,    setShowInactive]     = useState(false);
  const [editTarget,      setEditTarget]       = useState<Supplier | null>(null);
  const [openEdit,        setOpenEdit]         = useState(false);
  const [openCreate,      setOpenCreate]       = useState(false);

  const load = async (withInactive = showInactive) => {
    setLoading(true);
    setError(null);
    try {
      setSuppliers(await listSuppliers(withInactive));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load suppliers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(showInactive); }, [showInactive]);

  const openEditFor = (s: Supplier) => { setEditTarget(s); setOpenEdit(true); };

  const handleDeactivate = async (s: Supplier) => {
    const ok = await confirm({
      title: "Deactivate supplier",
      description: `"${s.name}" will be hidden from new invoices but existing records are kept.`,
      confirmLabel: "Deactivate",
    });
    if (!ok) return;
    try {
      await deactivateSupplier(s.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to deactivate");
    }
  };

  const handleReactivate = async (s: Supplier) => {
    try {
      await reactivateSupplier(s.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reactivate");
    }
  };

  const visible = suppliers.filter((s) => showInactive || s.active);
  const activeCount = suppliers.filter((s) => s.active).length;

  return (
    <>
      {!asTab && (
        <PageHeader
          kicker="Finance"
          title="Suppliers"
          subtitle="Manage your supplier directory — contact info, payment terms, bank details."
          action={
            canManage && (
              <Button onClick={() => setOpenCreate(true)}>+ Add supplier</Button>
            )
          }
        />
      )}

      {asTab && canManage && (
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-[var(--color-muted)]">
            {activeCount} active supplier{activeCount !== 1 ? "s" : ""}
          </p>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-sm text-[var(--color-muted)] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="rounded"
              />
              Show inactive
            </label>
            <Button onClick={() => setOpenCreate(true)}>+ Add supplier</Button>
          </div>
        </div>
      )}

      {!asTab && (
        <div className="flex items-center gap-2 mb-4">
          <p className="flex-1 text-sm text-[var(--color-muted)]">
            {activeCount} active supplier{activeCount !== 1 ? "s" : ""}
          </p>
          <label className="flex items-center gap-1.5 text-sm text-[var(--color-muted)] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded"
            />
            Show inactive
          </label>
        </div>
      )}

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : visible.length === 0 ? (
        <EmptyState
          title="No suppliers yet"
          description={canManage ? "Add your first supplier to start creating payable invoices." : undefined}
          action={canManage ? <Button onClick={() => setOpenCreate(true)}>Add supplier</Button> : undefined}
        />
      ) : (
        <div className="rounded-xl border border-black/8 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-black/[0.03] border-b border-black/8 text-[var(--color-muted)] text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Supplier</th>
                <th className="px-4 py-2.5 text-left font-medium hidden md:table-cell">Contact</th>
                <th className="px-4 py-2.5 text-left font-medium hidden lg:table-cell">VAT ID</th>
                <th className="px-4 py-2.5 text-center font-medium hidden sm:table-cell">Terms</th>
                <th className="px-4 py-2.5 text-left font-medium hidden xl:table-cell">Bank</th>
                <th className="px-4 py-2.5 text-center font-medium">Status</th>
                {canManage && <th className="px-4 py-2.5" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.05]">
              {visible.map((s) => (
                <tr key={s.id} className={`hover:bg-black/[0.02] transition-colors ${!s.active ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-[var(--color-ink)]">{s.name}</p>
                    {s.notes && (
                      <p className="text-xs text-[var(--color-muted)] mt-0.5 truncate max-w-[200px]">{s.notes}</p>
                    )}
                    <p className="text-xs text-[var(--color-muted)] mt-0.5 sm:hidden">
                      {s.paymentTermsDays}d terms
                    </p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {s.contactName && <p className="text-[var(--color-ink)]">{s.contactName}</p>}
                    {s.phone && <p className="text-xs text-[var(--color-muted)]">{s.phone}</p>}
                    {s.email && <p className="text-xs text-[var(--color-muted)] truncate max-w-[180px]">{s.email}</p>}
                    {!s.contactName && !s.phone && !s.email && <span className="text-[var(--color-muted)]">—</span>}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-[var(--color-muted)]">
                    {s.vatId ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-center hidden sm:table-cell">
                    <span className="inline-block px-2 py-0.5 rounded-full bg-black/5 text-xs font-medium tabular-nums">
                      {s.paymentTermsDays}d
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell">
                    {s.bankAccountNumber ? (
                      <div>
                        <p className="text-xs font-mono text-[var(--color-ink)]">{s.bankAccountNumber}</p>
                        {s.bankName && <p className="text-xs text-[var(--color-muted)]">{s.bankName}</p>}
                      </div>
                    ) : (
                      <span className="text-[var(--color-muted)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={s.active ? "success" : "neutral"}>
                      {s.active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEditFor(s)}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium text-[var(--color-ink)] hover:bg-black/5 transition-colors"
                        >
                          Edit
                        </button>
                        {s.active ? (
                          <button
                            type="button"
                            onClick={() => void handleDeactivate(s)}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleReactivate(s)}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium text-emerald-700 hover:bg-emerald-50 transition-colors"
                          >
                            Reactivate
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Create dialog ─────────────────────────────────────────────── */}
      {openCreate && (
        <SupplierFormDialog
          title="Add supplier"
          initialDraft={blankDraft()}
          onSave={async (draft) => {
            await createSupplier(draftToInput(draft));
            setOpenCreate(false);
            await load();
          }}
          onClose={() => setOpenCreate(false)}
        />
      )}

      {/* ── Edit dialog ───────────────────────────────────────────────── */}
      {openEdit && editTarget && (
        <SupplierFormDialog
          title={`Edit · ${editTarget.name}`}
          initialDraft={supplierToDraft(editTarget)}
          onSave={async (draft) => {
            await updateSupplier(editTarget.id, draftToInput(draft));
            setOpenEdit(false);
            setEditTarget(null);
            await load();
          }}
          onClose={() => { setOpenEdit(false); setEditTarget(null); }}
        />
      )}
    </>
  );
}

// ─── form dialog ─────────────────────────────────────────────────────────────

function SupplierFormDialog({
  title,
  initialDraft,
  onSave,
  onClose,
}: {
  title: string;
  initialDraft: Draft;
  onSave: (draft: Draft) => Promise<void>;
  onClose: () => void;
}) {
  const [draft,   setDraft]   = useState<Draft>(initialDraft);
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState("");

  const set = (field: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDraft((d) => ({ ...d, [field]: e.target.value }));

  const handleSubmit = async () => {
    if (!draft.name.trim()) { setErr("Supplier name is required."); return; }
    const terms = parseInt(draft.paymentTermsDays, 10);
    if (isNaN(terms) || terms < 0) { setErr("Payment terms must be a non-negative number."); return; }
    setSaving(true);
    setErr("");
    try {
      await onSave(draft);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
      setSaving(false);
    }
  };

  return (
    <DialogForm open onClose={onClose} onSubmit={(e) => { e.preventDefault(); void handleSubmit(); }}>
        <DialogTitle>{title}</DialogTitle>
        <DialogBody className="space-y-4">
          {err && <Alert variant="error">{err}</Alert>}

          {/* ── Basic info ─────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Supplier name *" className="sm:col-span-2">
              <Input value={draft.name} onChange={set("name")} autoFocus placeholder="e.g. FreshFarm Sp. z o.o." />
            </Field>
            <Field label="Contact person">
              <Input value={draft.contactName} onChange={set("contactName")} placeholder="e.g. Jan Kowalski" />
            </Field>
            <Field label="Phone">
              <Input value={draft.phone} onChange={set("phone")} type="tel" placeholder="+48 500 000 000" />
            </Field>
            <Field label="Email">
              <Input value={draft.email} onChange={set("email")} type="email" placeholder="contact@supplier.pl" />
            </Field>
            <Field label="VAT ID (NIP)">
              <Input value={draft.vatId} onChange={set("vatId")} placeholder="1234567890" />
            </Field>
            <Field label="Payment terms (days)" className="sm:col-span-2">
              <Input value={draft.paymentTermsDays} onChange={set("paymentTermsDays")} type="number" min="0" placeholder="14" className="w-32" />
            </Field>
          </div>

          {/* ── Address ────────────────────────────────────────────── */}
          <Field label="Address">
            <Textarea value={draft.address} onChange={set("address")} rows={2} placeholder="Street, city, postal code" />
          </Field>

          {/* ── Bank details ───────────────────────────────────────── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)] mb-2">
              Bank details
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Account number (IBAN)" className="sm:col-span-2">
                <Input value={draft.bankAccountNumber} onChange={set("bankAccountNumber")} placeholder="PL00 0000 0000 0000 0000 0000 0000" className="font-mono" />
              </Field>
              <Field label="Bank name">
                <Input value={draft.bankName} onChange={set("bankName")} placeholder="e.g. PKO Bank Polski" />
              </Field>
              <Field label="BIC / SWIFT">
                <Input value={draft.bankBicSwift} onChange={set("bankBicSwift")} placeholder="e.g. BPKOPLPW" className="font-mono" />
              </Field>
            </div>
          </div>

          {/* ── Notes ─────────────────────────────────────────────── */}
          <Field label="Notes">
            <Textarea value={draft.notes} onChange={set("notes")} rows={2} placeholder="Any internal notes about this supplier…" />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogForm>
  );
}
