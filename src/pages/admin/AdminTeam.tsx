import { useEffect, useMemo, useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { addPayRate, deletePayRate, listPayRates } from "../../api/payRates";
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
    active: true,
  });
  const [payHistory, setPayHistory] = useState<PayRateHistoryEntry[]>([]);
  const [payHistoryLoading, setPayHistoryLoading] = useState(false);
  const [addPayOpen, setAddPayOpen] = useState(false);
  const [payDraft, setPayDraft] = useState({
    payType: "HOURLY" as PayType,
    payAmount: "",
    effectiveFrom: todayIso(),
    notes: "",
  });
  const [payBusy, setPayBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loadError, setLoadError] = useState("");
  // Result of an admin-initiated password reset. The plaintext lives in
  // memory only while this modal is open — we never store it in the
  // users list or anywhere else. Closing the modal clears it.
  const [resetResult, setResetResult] = useState<{
    user: User;
    tempPassword: string;
  } | null>(null);
  const [resetBusyId, setResetBusyId] = useState<string | null>(null);
  const [copiedTempPw, setCopiedTempPw] = useState(false);
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

  // Counts for the tab badges — show how many active people sit in each
  // section so admins don't have to click both to know.
  const sectionCounts = useMemo(() => {
    return {
      cashiers: users.filter((u) => u.role === "CASHIER" && u.active !== false).length,
      managers: users.filter((u) => u.role === "MANAGER" && u.active !== false).length,
    };
  }, [users]);

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
    setEditForm({
      name: u.name,
      username: u.username,
      email: u.email ?? "",
      password: "",
      startDate: u.startDate ?? todayIso(),
      active: u.active !== false,
    });
    setPayHistory([]);
    setAddPayOpen(false);
    setPayDraft({
      payType: u.payType ?? "HOURLY",
      payAmount:
        u.payAmount != null
          ? String(u.payAmount)
          : u.hourlyRate != null
            ? String(u.hourlyRate)
            : "",
      effectiveFrom: todayIso(),
      notes: "",
    });
    if (u.role === "CASHIER") {
      setPayHistoryLoading(true);
      listPayRates(u.id)
        .then(setPayHistory)
        .catch(() => setPayHistory([]))
        .finally(() => setPayHistoryLoading(false));
    }
    setMsg("");
    setErr("");
  };

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setMsg("");
    setErr("");
    try {
      const body: Record<string, unknown> = {
        name: editForm.name,
        username: editForm.username.trim(),
        active: editForm.active,
        startDate: editForm.startDate,
      };
      if (editForm.email.trim()) body.email = editForm.email.trim();
      else body.email = null;
      if (editForm.password.trim()) body.password = editForm.password;
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

  const submitPayDraft = async () => {
    if (!editing) return;
    const amount = payDraft.payAmount === "" ? NaN : Number(payDraft.payAmount);
    if (!Number.isFinite(amount) || amount < 0) {
      setErr("Pay amount must be a number ≥ 0");
      return;
    }
    if (!payDraft.effectiveFrom) {
      setErr("Pick an effective date");
      return;
    }
    setPayBusy(true);
    setErr("");
    setMsg("");
    try {
      const updated = await addPayRate(editing.id, {
        payType: payDraft.payType,
        payAmount: amount,
        effectiveFrom: payDraft.effectiveFrom,
        notes: payDraft.notes.trim() || undefined,
      });
      setPayHistory(updated);
      setAddPayOpen(false);
      setPayDraft({
        payType: payDraft.payType,
        payAmount: "",
        effectiveFrom: todayIso(),
        notes: "",
      });
      setMsg("Pay change added");
      await loadUsers();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to add pay change");
    } finally {
      setPayBusy(false);
    }
  };

  const removePayEntry = async (entry: PayRateHistoryEntry) => {
    if (!editing) return;
    if (!confirm(`Remove pay change of ${entry.payAmount} ${amountSuffix(entry.payType)} from ${formatStartDate(entry.effectiveFrom)}?`)) return;
    setPayBusy(true);
    setErr("");
    setMsg("");
    try {
      const updated = await deletePayRate(editing.id, entry.id);
      setPayHistory(updated);
      setMsg("Pay change removed");
      await loadUsers();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to remove");
    } finally {
      setPayBusy(false);
    }
  };

  const currentPayEntry = useMemo(() => {
    if (!editing || editing.role !== "CASHIER") return null;
    const today = todayIso();
    return (
      payHistory.find((h) => h.effectiveFrom <= today) ??
      payHistory[payHistory.length - 1] ??
      null
    );
  }, [editing, payHistory]);

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

  /**
   * Generate a one-time temporary password for {@code u} and show it in
   * the {@link resetResult} modal. The plaintext appears only in this
   * single network response — once the admin closes the modal, it's
   * gone forever. Reloading users after the call refreshes the
   * "must change password" badge so the row reflects the new state.
   */
  const resetPassword = async (u: User) => {
    if (!confirm(`Generate a new one-time password for ${u.name}?\n\nThe current password will stop working immediately. They'll be asked to set a new password the next time they sign in.`)) {
      return;
    }
    setErr("");
    setResetBusyId(u.id);
    try {
      const res = await api<{ tempPassword: string }>(
        `/users/${u.id}/reset-password`,
        { method: "POST" },
      );
      setResetResult({ user: u, tempPassword: res.tempPassword });
      setCopiedTempPw(false);
      await loadUsers();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setResetBusyId(null);
    }
  };

  const closeResetModal = () => {
    setResetResult(null);
    setCopiedTempPw(false);
  };

  const copyTempPassword = async () => {
    if (!resetResult) return;
    try {
      await navigator.clipboard.writeText(resetResult.tempPassword);
      setCopiedTempPw(true);
      // Self-clear the "copied" feedback after 2s so the button can be
      // clicked again to re-copy if needed.
      setTimeout(() => setCopiedTempPw(false), 2000);
    } catch {
      // Clipboard API can fail under odd permissions / non-HTTPS contexts.
      // The user can still triple-click + Cmd-C the visible field.
    }
  };

  return (
    <div data-tour="tour-admin-team">
      <PageHeader
        kicker="People"
        title="Team"
        subtitle="Create managers and cashiers, set pay rates, and toggle access."
        action={
          <Button onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? "Cancel" : section === "cashiers" ? "+ Add cashier" : "+ Add manager"}
          </Button>
        }
        tabs={[
          {
            id: "cashiers",
            label: "Cashiers",
            active: section === "cashiers",
            onClick: () => { setSection("cashiers"); setShowCreate(false); },
            badge: sectionCounts.cashiers,
          },
          {
            id: "managers",
            label: "Managers",
            active: section === "managers",
            onClick: () => { setSection("managers"); setShowCreate(false); },
            badge: sectionCounts.managers,
          },
        ]}
      />

      <div className="page-toolbar">
        <div className="flex items-center gap-1 p-1 rounded-full bg-white border border-black/[0.06]">
          {(["active", "inactive", "all"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition ${
                filter === f
                  ? "bg-[var(--color-ink)] text-white"
                  : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
      {loadError && <Alert variant="error">{loadError}</Alert>}
      {msg && <Alert variant="success">{msg}</Alert>}
      {err && <Alert variant="error">{err}</Alert>}

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
                  pattern="[-a-zA-Z0-9._]+"
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
                {u.active !== false && (
                  <button
                    type="button"
                    onClick={() => resetPassword(u)}
                    disabled={resetBusyId === u.id}
                    className="flex-1 text-sm font-medium text-[var(--color-saffron-dark)] py-2 disabled:opacity-50"
                    title="Generate a one-time password the user must change on next sign-in"
                  >
                    {resetBusyId === u.id ? "Generating…" : "Reset password"}
                  </button>
                )}
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
                  pattern="[-a-zA-Z0-9._]+"
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
                <div className="space-y-2 p-3 rounded-xl border border-black/5 bg-[var(--color-cream)]/50">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                      Pay
                    </p>
                    {!addPayOpen && (
                      <button
                        type="button"
                        onClick={() => setAddPayOpen(true)}
                        className="text-sm font-medium text-[var(--color-saffron-dark)]"
                      >
                        + Add pay change
                      </button>
                    )}
                  </div>

                  {currentPayEntry ? (
                    <p className="text-sm">
                      <span className="font-semibold">Current:</span>{" "}
                      {payLabel(currentPayEntry.payType)} · {currentPayEntry.payAmount}{" "}
                      {amountSuffix(currentPayEntry.payType)}
                      <span className="text-[var(--color-muted)]">
                        {" "}
                        — since {formatStartDate(currentPayEntry.effectiveFrom)}
                      </span>
                    </p>
                  ) : (
                    <p className="text-sm text-[var(--color-muted)]">
                      {payHistoryLoading ? "Loading pay history…" : "No pay set yet — add a pay change below."}
                    </p>
                  )}

                  {addPayOpen && (
                    <div className="space-y-3 p-3 rounded-lg border border-[var(--color-saffron)]/30 bg-white">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">New pay change</p>
                        <button
                          type="button"
                          onClick={() => setAddPayOpen(false)}
                          className="text-xs text-[var(--color-muted)]"
                        >
                          Cancel
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {PAY_TYPES.map((p) => (
                          <button
                            key={p.value}
                            type="button"
                            onClick={() => setPayDraft({ ...payDraft, payType: p.value })}
                            className={`py-2 px-1 rounded-lg text-xs font-medium border transition ${
                              payDraft.payType === p.value
                                ? "bg-[var(--color-saffron)] text-white border-[var(--color-saffron)]"
                                : "bg-white border-black/10"
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                      <div className="grid sm:grid-cols-2 gap-2">
                        <label className="field-label">
                          Amount ({amountSuffix(payDraft.payType)})
                          <input
                            type="number"
                            min={0}
                            step={0.5}
                            value={payDraft.payAmount}
                            onChange={(e) => setPayDraft({ ...payDraft, payAmount: e.target.value })}
                            className="field-input"
                          />
                        </label>
                        <label className="field-label">
                          Effective from
                          <input
                            type="date"
                            value={payDraft.effectiveFrom}
                            onChange={(e) =>
                              setPayDraft({ ...payDraft, effectiveFrom: e.target.value })
                            }
                            className="field-input"
                          />
                        </label>
                      </div>
                      <label className="field-label">
                        Note <span className="font-normal text-[var(--color-muted)]">(optional)</span>
                        <input
                          type="text"
                          value={payDraft.notes}
                          onChange={(e) => setPayDraft({ ...payDraft, notes: e.target.value })}
                          className="field-input"
                          placeholder="e.g. raise, seasonal adjustment"
                        />
                      </label>
                      <Button
                        type="button"
                        onClick={submitPayDraft}
                        disabled={payBusy}
                        fullWidth
                      >
                        {payBusy ? "Adding…" : "Add pay change"}
                      </Button>
                      <p className="text-xs text-[var(--color-muted)]">
                        Shifts on or after this date use the new rate. Earlier shifts keep the
                        previous rate.
                      </p>
                    </div>
                  )}

                  {payHistory.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-[var(--color-muted)]">Pay history</p>
                      <ul className="space-y-1 text-sm rounded-lg bg-white border border-black/5 divide-y divide-black/5">
                        {payHistory.map((h) => {
                          const isCurrent = currentPayEntry?.id === h.id;
                          return (
                            <li key={h.id} className="flex items-center justify-between gap-2 px-3 py-2">
                              <div className="min-w-0">
                                <p className={isCurrent ? "font-semibold" : ""}>
                                  {payLabel(h.payType)} · {h.payAmount} {amountSuffix(h.payType)}
                                  {isCurrent && (
                                    <span className="ml-1.5 text-[10px] uppercase tracking-wide text-[var(--color-saffron-dark)]">
                                      current
                                    </span>
                                  )}
                                </p>
                                <p className="text-xs text-[var(--color-muted)]">
                                  from {formatStartDate(h.effectiveFrom)}
                                  {h.notes && ` · ${h.notes}`}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => removePayEntry(h)}
                                disabled={payBusy}
                                className="text-xs font-medium text-[var(--color-danger)] shrink-0 px-2 py-1 rounded hover:bg-[var(--color-danger)]/10"
                              >
                                Remove
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
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

      {resetResult && (
        <ResetPasswordModal
          name={resetResult.user.name}
          username={resetResult.user.username}
          tempPassword={resetResult.tempPassword}
          copied={copiedTempPw}
          onCopy={copyTempPassword}
          onClose={closeResetModal}
        />
      )}
      </div>
    </div>
  );
}

function ResetPasswordModal({
  name,
  username,
  tempPassword,
  copied,
  onCopy,
  onClose,
}: {
  name: string;
  username: string;
  tempPassword: string;
  copied: boolean;
  onCopy: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md rounded-t-2xl md:rounded-2xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-black/[0.06]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-saffron-dark)]">
            One-time password
          </p>
          <h3 className="text-lg font-semibold mt-1">Share with {name}</h3>
          <p className="text-xs text-[var(--color-muted)] mt-1">
            They'll be asked to set a new password the next time they sign in. This
            value is shown <strong>only once</strong> — copy it before closing.
          </p>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="rounded-lg border border-black/[0.08] bg-[var(--color-cream)] p-3">
            <p className="text-[10px] uppercase tracking-wider text-[var(--color-muted)] font-semibold">
              Username
            </p>
            <p className="font-mono text-sm mt-0.5 select-all">{username}</p>
          </div>
          <div className="rounded-lg border border-[var(--color-saffron)]/40 bg-[var(--color-saffron-light)] p-3">
            <p className="text-[10px] uppercase tracking-wider text-[var(--color-saffron-dark)] font-semibold">
              Temporary password
            </p>
            <div className="flex items-center justify-between gap-2 mt-1">
              <code className="font-mono text-base tracking-wider select-all break-all">
                {tempPassword}
              </code>
              <Button
                variant="secondary"
                onClick={onCopy}
                className="!py-1 !px-3 !text-xs shrink-0"
              >
                {copied ? "Copied ✓" : "Copy"}
              </Button>
            </div>
          </div>
          <p className="text-xs text-[var(--color-muted)]">
            Best practice: share over a secure channel (SMS, Signal, in person) — never
            email. If you lose this value, generate a fresh one.
          </p>
        </div>

        <div className="px-5 py-3 border-t border-black/[0.06] flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
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
