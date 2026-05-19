import { useEffect, useMemo, useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import type { PayRateHistoryEntry, PayType, Role, User } from "../../types";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { PageHeader } from "../../components/ui/PageHeader";

const PAY_TYPES: { value: PayType; label: string; hint: string }[] = [
  { value: "HOURLY", label: "Hourly", hint: "Per hour worked" },
  { value: "DAILY", label: "Daily", hint: "Per open day (pro-rated)" },
  { value: "MONTHLY", label: "Monthly", hint: "Fixed monthly" },
];

function payLabel(type: PayType) {
  return PAY_TYPES.find((p) => p.value === type)?.label ?? type;
}

function amountSuffix(type: PayType) {
  if (type === "HOURLY") return "PLN/h";
  if (type === "DAILY") return "PLN/day";
  return "PLN/mo";
}

function formatStartDate(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const emptyNew = {
  name: "",
  username: "",
  email: "",
  password: "",
  startDate: todayIso(),
  payType: "HOURLY" as PayType,
  payAmount: "",
};

type Filter = "all" | "active" | "inactive";
type TeamSection = "cashiers" | "managers";

export function AdminTeam() {
  const [users, setUsers] = useState<User[]>([]);
  const [section, setSection] = useState<TeamSection>("cashiers");
  const [filter, setFilter] = useState<Filter>("active");
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState(emptyNew);
  const [editing, setEditing] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    startDate: todayIso(),
    payType: "HOURLY" as PayType,
    payAmount: "",
    payEffectiveFrom: todayIso(),
    payChangeNote: "",
    active: true,
  });
  const [originalPay, setOriginalPay] = useState<{ payType: PayType; payAmount: string } | null>(null);
  const [payHistory, setPayHistory] = useState<PayRateHistoryEntry[]>([]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadUsers = () =>
    api<User[]>("/users")
      .then(setUsers)
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Failed to load"));

  useEffect(() => {
    loadUsers();
  }, []);

  const teamMembers = useMemo(() => {
    const role: Role = section === "cashiers" ? "CASHIER" : "MANAGER";
    const list = users.filter((u) => u.role === role);
    if (filter === "active") return list.filter((u) => u.active !== false);
    if (filter === "inactive") return list.filter((u) => u.active === false);
    return list;
  }, [users, filter, section]);

  const createTeamMember = async (e: FormEvent) => {
    e.preventDefault();
    setMsg("");
    setErr("");
    setSaving(true);
    try {
      const role: Role = section === "cashiers" ? "CASHIER" : "MANAGER";
      const body: Record<string, unknown> = {
        name: newUser.name,
        username: newUser.username.trim(),
        password: newUser.password,
        role,
        startDate: newUser.startDate,
      };
      if (newUser.email.trim()) body.email = newUser.email.trim();
      if (section === "cashiers") {
        const payAmount = newUser.payAmount ? Number(newUser.payAmount) : undefined;
        body.payType = newUser.payType;
        body.payAmount = payAmount;
        body.hourlyRate = payAmount;
      }
      await api("/users", { method: "POST", body: JSON.stringify(body) });
      setNewUser(emptyNew);
      setShowCreate(false);
      setMsg(`${section === "cashiers" ? "Cashier" : "Manager"} created`);
      await loadUsers();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to create");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (u: User) => {
    setEditing(u);
    const payAmountStr =
      u.payAmount != null
        ? String(u.payAmount)
        : u.hourlyRate != null
          ? String(u.hourlyRate)
          : "";
    setOriginalPay({ payType: u.payType ?? "HOURLY", payAmount: payAmountStr });
    setEditForm({
      name: u.name,
      username: u.username,
      email: u.email ?? "",
      password: "",
      payType: u.payType ?? "HOURLY",
      payAmount: payAmountStr,
      payEffectiveFrom: todayIso(),
      payChangeNote: "",
      startDate: u.startDate ?? todayIso(),
      active: u.active !== false,
    });
    setPayHistory([]);
    if (u.role === "CASHIER") {
      api<PayRateHistoryEntry[]>(`/users/${u.id}/pay-rates`)
        .then(setPayHistory)
        .catch(() => setPayHistory([]));
    }
    setMsg("");
    setErr("");
  };

  const payChangedInEdit =
    editing?.role === "CASHIER" &&
    originalPay != null &&
    (editForm.payType !== originalPay.payType || editForm.payAmount !== originalPay.payAmount);

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setMsg("");
    setErr("");
    try {
      const amount = editForm.payAmount === "" ? 0 : Number(editForm.payAmount);
      const body: Record<string, unknown> = {
        name: editForm.name,
        username: editForm.username.trim(),
        active: editForm.active,
        startDate: editForm.startDate,
        payType: editForm.payType,
        payAmount: amount,
        hourlyRate: amount,
      };
      if (editForm.email.trim()) body.email = editForm.email.trim();
      else body.email = null;
      if (editForm.password.trim()) body.password = editForm.password;
      if (payChangedInEdit) {
        body.payEffectiveFrom = editForm.payEffectiveFrom;
        if (editForm.payChangeNote.trim()) body.payChangeNote = editForm.payChangeNote.trim();
      }
      await api(`/users/${editing.id}`, { method: "PATCH", body: JSON.stringify(body) });
      setMsg(`${editForm.name} updated`);
      setEditing(null);
      await loadUsers();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (u: User, active: boolean) => {
    const label = active ? "Reactivate" : "Deactivate";
    if (!confirm(`${label} ${u.name}?`)) return;
    setErr("");
    try {
      await api(`/users/${u.id}`, { method: "PATCH", body: JSON.stringify({ active }) });
      setMsg(active ? `${u.name} reactivated` : `${u.name} deactivated`);
      await loadUsers();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Team"
        subtitle="Create managers and cashiers, set pay for cashiers, activate or deactivate"
        action={
          <Button onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? "Cancel" : section === "cashiers" ? "+ Add cashier" : "+ Add manager"}
          </Button>
        }
      />

      <div className="flex gap-2 p-1 rounded-xl bg-[var(--color-cream)] w-fit">
        {(["cashiers", "managers"] as TeamSection[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setSection(s);
              setShowCreate(false);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${
              section === s ? "bg-white shadow-sm text-[var(--color-ink)]" : "text-[var(--color-muted)]"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loadError && <Alert variant="error">{loadError}</Alert>}
      {msg && <Alert variant="success">{msg}</Alert>}
      {err && <Alert variant="error">{err}</Alert>}

      <div className="flex gap-2">
        {(["active", "inactive", "all"] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize ${
              filter === f ? "bg-[var(--color-ink)] text-white" : "bg-white border"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {showCreate && (
        <Card>
          <form onSubmit={createTeamMember} className="space-y-4">
            <h3 className="font-semibold">New {section === "cashiers" ? "cashier" : "manager"}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="field-label sm:col-span-2">
                Name
                <input
                  required
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="field-input"
                />
              </label>
              <label className="field-label">
                Username
                <input
                  type="text"
                  required
                  autoCapitalize="none"
                  pattern="[a-zA-Z0-9._-]+"
                  title="Letters, numbers, dots, underscores, hyphens"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  className="field-input"
                  placeholder="jane.doe"
                />
              </label>
              <label className="field-label">
                Email <span className="text-[var(--color-muted)] font-normal">(optional)</span>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="field-input"
                />
              </label>
              <label className="field-label">
                Password
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="field-input"
                />
              </label>
              <label className="field-label sm:col-span-2">
                Start date
                <input
                  type="date"
                  required
                  value={newUser.startDate}
                  onChange={(e) => setNewUser({ ...newUser, startDate: e.target.value })}
                  className="field-input"
                />
              </label>
            </div>
            {section === "cashiers" && (
              <PayFields
                payType={newUser.payType}
                payAmount={newUser.payAmount}
                onType={(payType) => setNewUser({ ...newUser, payType })}
                onAmount={(payAmount) => setNewUser({ ...newUser, payAmount })}
              />
            )}
            <Button type="submit" fullWidth disabled={saving}>
              {saving ? "Creating…" : `Create ${section === "cashiers" ? "cashier" : "manager"}`}
            </Button>
          </form>
        </Card>
      )}

      {teamMembers.length === 0 ? (
        <Card className="text-center py-10 text-[var(--color-muted)]">
          <p>No {section} in this view.</p>
          <Button className="mt-4" onClick={() => setShowCreate(true)}>
            Add first {section === "cashiers" ? "cashier" : "manager"}
          </Button>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {teamMembers.map((u) => (
            <li
              key={u.id}
              className={`bg-white rounded-2xl border border-black/5 p-4 flex flex-col gap-3 ${
                u.active === false ? "opacity-80" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{u.name}</p>
                  <p className="text-sm text-[var(--color-muted)] truncate">@{u.username}</p>
                  {u.email && (
                    <p className="text-xs text-[var(--color-muted)] truncate">{u.email}</p>
                  )}
                  {u.startDate && (
                    <p className="text-xs text-[var(--color-muted)] mt-0.5">
                      Started {formatStartDate(u.startDate)}
                    </p>
                  )}
                </div>
                {u.active === false ? (
                  <Badge variant="inactive">Inactive</Badge>
                ) : (
                  <Badge variant="neutral">Active</Badge>
                )}
              </div>
              {u.role === "CASHIER" && (
                <p className="text-sm bg-[var(--color-cream)] rounded-lg px-3 py-2">
                  <span className="font-medium">{payLabel(u.payType ?? "HOURLY")}</span>
                  {(u.payAmount ?? u.hourlyRate) != null && (u.payAmount ?? u.hourlyRate)! > 0 && (
                    <span className="text-[var(--color-muted)]">
                      {" "}
                      · {u.payAmount ?? u.hourlyRate} {amountSuffix(u.payType ?? "HOURLY")}
                    </span>
                  )}
                </p>
              )}
              {u.role === "MANAGER" && (
                <p className="text-sm bg-[var(--color-cream)] rounded-lg px-3 py-2 text-[var(--color-muted)]">
                  Manager — full access to reports and operations
                </p>
              )}
              <div className="flex flex-wrap gap-2 mt-auto">
                <Button variant="secondary" className="flex-1 !py-2 !text-sm" onClick={() => openEdit(u)}>
                  Edit
                </Button>
                {u.active === false ? (
                  <button
                    type="button"
                    onClick={() => toggleActive(u, true)}
                    className="flex-1 text-sm font-medium text-[var(--color-success)] py-2"
                  >
                    Reactivate
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleActive(u, false)}
                    className="flex-1 text-sm font-medium text-[var(--color-danger)] py-2"
                  >
                    Deactivate
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-[var(--color-muted)] text-center">
        Schedule shifts in{" "}
        <Link to="/admin/attendance" className="text-[var(--color-saffron)] font-medium">
          Attendance
        </Link>
        . View payroll in{" "}
        <Link to="/admin/salaries" className="text-[var(--color-saffron)] font-medium">
          Salaries
        </Link>
        .
      </p>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40">
          <Card className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-b-none sm:rounded-2xl sm:rounded-b-2xl">
            <form onSubmit={saveEdit} className="space-y-4">
              <div className="flex justify-between items-center sticky top-0 bg-white pb-2 border-b border-black/5 -mx-4 px-4 pt-1">
                <h3 className="font-semibold text-lg">Edit {editing.name}</h3>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="w-10 h-10 rounded-full bg-[var(--color-cream)] text-xl leading-none"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <label className="field-label">
                Name
                <input
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="field-input"
                />
              </label>
              <label className="field-label">
                Username
                <input
                  type="text"
                  required
                  autoCapitalize="none"
                  pattern="[a-zA-Z0-9._-]+"
                  value={editForm.username}
                  onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                  className="field-input"
                />
              </label>
              <label className="field-label">
                Email <span className="text-[var(--color-muted)] font-normal">(optional)</span>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="field-input"
                />
              </label>
              <label className="field-label">
                New password
                <input
                  type="password"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  className="field-input"
                  placeholder="Leave blank to keep current"
                  minLength={6}
                />
              </label>
              <label className="field-label">
                Start date
                <input
                  type="date"
                  required
                  value={editForm.startDate}
                  onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                  className="field-input"
                />
              </label>

              {editing.role === "CASHIER" && (
                <>
                  <PayFields
                    payType={editForm.payType}
                    payAmount={editForm.payAmount}
                    onType={(payType) => setEditForm({ ...editForm, payType })}
                    onAmount={(payAmount) => setEditForm({ ...editForm, payAmount })}
                  />
                  {payChangedInEdit && (
                    <div className="space-y-3 p-3 rounded-xl border border-[var(--color-saffron)]/30 bg-[var(--color-saffron)]/5">
                      <p className="text-sm font-medium text-[var(--color-ink)]">
                        Pay change — applies from this date onward
                      </p>
                      <label className="field-label">
                        Effective from
                        <input
                          type="date"
                          required
                          value={editForm.payEffectiveFrom}
                          onChange={(e) =>
                            setEditForm({ ...editForm, payEffectiveFrom: e.target.value })
                          }
                          className="field-input"
                        />
                      </label>
                      <label className="field-label">
                        Note <span className="font-normal text-[var(--color-muted)]">(optional)</span>
                        <input
                          type="text"
                          value={editForm.payChangeNote}
                          onChange={(e) =>
                            setEditForm({ ...editForm, payChangeNote: e.target.value })
                          }
                          className="field-input"
                          placeholder="e.g. raise, seasonal adjustment"
                        />
                      </label>
                      <p className="text-xs text-[var(--color-muted)]">
                        Shifts before this date keep the previous rate in Salaries. Past payroll is not
                        recalculated retroactively.
                      </p>
                    </div>
                  )}
                  {payHistory.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                        Pay history
                      </p>
                      <ul className="text-sm space-y-1 max-h-36 overflow-y-auto rounded-lg bg-[var(--color-cream)] p-2">
                        {payHistory.map((h) => (
                          <li key={h.id} className="flex justify-between gap-2">
                            <span>
                              {payLabel(h.payType)} · {h.payAmount} {amountSuffix(h.payType)}
                            </span>
                            <span className="text-[var(--color-muted)] shrink-0">
                              from {formatStartDate(h.effectiveFrom)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}

              <label className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-cream)]">
                <input
                  type="checkbox"
                  checked={editForm.active}
                  onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })}
                  className="w-5 h-5"
                />
                <span className="text-sm font-medium">Active — can log in and be scheduled</span>
              </label>

              <div className="flex gap-2 pt-2">
                <Button type="button" variant="secondary" fullWidth onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button type="submit" fullWidth disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}

function PayFields({
  payType,
  payAmount,
  onType,
  onAmount,
}: {
  payType: PayType;
  payAmount: string;
  onType: (t: PayType) => void;
  onAmount: (v: string) => void;
}) {
  const hint = PAY_TYPES.find((p) => p.value === payType)?.hint;
  return (
    <div className="space-y-3 p-3 rounded-xl border border-black/5 bg-[var(--color-cream)]/50">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">Pay</p>
      <div className="grid grid-cols-3 gap-2">
        {PAY_TYPES.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => onType(p.value)}
            className={`py-2 px-1 rounded-lg text-xs font-medium border transition ${
              payType === p.value
                ? "bg-[var(--color-saffron)] text-white border-[var(--color-saffron)]"
                : "bg-white border-black/10"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <label className="field-label">
        Amount ({amountSuffix(payType)})
        <input
          type="number"
          min={0}
          step={0.5}
          value={payAmount}
          onChange={(e) => onAmount(e.target.value)}
          className="field-input"
        />
      </label>
      {hint && <p className="text-xs text-[var(--color-muted)]">{hint}</p>}
    </div>
  );
}
