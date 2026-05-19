import { useEffect, useState, FormEvent } from "react";
import { api } from "../api/client";
import type { PayType, User } from "../types";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";
import { Badge } from "../components/ui/Badge";

const PAY_TYPES: { value: PayType; label: string; hint: string }[] = [
  { value: "HOURLY", label: "Hourly", hint: "PLN per hour worked" },
  { value: "DAILY", label: "Daily", hint: "PLN per full open day (pro-rated by hours)" },
  { value: "MONTHLY", label: "Monthly", hint: "Fixed monthly salary" },
];

function payLabel(type: PayType) {
  return PAY_TYPES.find((p) => p.value === type)?.label ?? type;
}

function amountSuffix(type: PayType) {
  if (type === "HOURLY") return "PLN/h";
  if (type === "DAILY") return "PLN/day";
  return "PLN/month";
}

const emptyNew = { name: "", email: "", password: "", payType: "HOURLY" as PayType, payAmount: "" };

export function CashiersPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [newUser, setNewUser] = useState(emptyNew);
  const [editing, setEditing] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    password: "",
    payType: "HOURLY" as PayType,
    payAmount: "",
    active: true,
  });
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

  const cashiers = users.filter((u) => u.role === "CASHIER");

  const createCashier = async (e: FormEvent) => {
    e.preventDefault();
    setMsg("");
    setErr("");
    setSaving(true);
    try {
      const payAmount = newUser.payAmount ? Number(newUser.payAmount) : undefined;
      await api("/users", {
        method: "POST",
        body: JSON.stringify({
          name: newUser.name,
          email: newUser.email,
          password: newUser.password,
          role: "CASHIER",
          payType: newUser.payType,
          payAmount,
          hourlyRate: payAmount,
        }),
      });
      setNewUser(emptyNew);
      setMsg("Cashier created");
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
      email: u.email,
      password: "",
      payType: u.payType ?? "HOURLY",
      payAmount:
        u.payAmount != null
          ? String(u.payAmount)
          : u.hourlyRate != null
            ? String(u.hourlyRate)
            : "",
      active: u.active !== false,
    });
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
      const amount = editForm.payAmount === "" ? 0 : Number(editForm.payAmount);
      const body: Record<string, unknown> = {
        name: editForm.name,
        email: editForm.email,
        active: editForm.active,
        payType: editForm.payType,
        payAmount: amount,
        hourlyRate: amount,
      };
      if (editForm.password.trim()) body.password = editForm.password;
      await api(`/users/${editing.id}`, { method: "PATCH", body: JSON.stringify(body) });
      setMsg("Cashier updated");
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
      setMsg(active ? "Reactivated" : "Deactivated");
      await loadUsers();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className="space-y-4">
      {loadError && <Alert variant="error">{loadError}</Alert>}
      {msg && <Alert variant="success">{msg}</Alert>}
      {err && <Alert variant="error">{err}</Alert>}

      <Card>
        <form onSubmit={createCashier} className="space-y-3">
          <h3 className="font-semibold">Create cashier</h3>
          <input
            placeholder="Name"
            required
            value={newUser.name}
            onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
            className="field-input"
          />
          <input
            placeholder="Email"
            type="email"
            required
            value={newUser.email}
            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
            className="field-input"
          />
          <input
            placeholder="Password"
            type="password"
            required
            minLength={6}
            value={newUser.password}
            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
            className="field-input"
          />
          <div className="grid grid-cols-2 gap-3">
            <label className="field-label">
              Pay type
              <select
                value={newUser.payType}
                onChange={(e) => setNewUser({ ...newUser, payType: e.target.value as PayType })}
                className="field-input"
              >
                {PAY_TYPES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </label>
            <label className="field-label">
              Amount
              <input
                type="number"
                min={0}
                step={0.5}
                placeholder={amountSuffix(newUser.payType)}
                value={newUser.payAmount}
                onChange={(e) => setNewUser({ ...newUser, payAmount: e.target.value })}
                className="field-input"
              />
            </label>
          </div>
          <Button type="submit" fullWidth disabled={saving}>
            {saving ? "Creating…" : "Create cashier"}
          </Button>
        </form>
      </Card>

      <ul className="space-y-2">
        {cashiers.map((u) => (
          <li
            key={u.id}
            className={`bg-white rounded-xl p-4 border flex flex-wrap justify-between gap-3 ${
              u.active === false ? "opacity-75" : ""
            }`}
          >
            <div className="min-w-0">
              <p className="font-medium">{u.name}</p>
              <p className="text-sm text-[var(--color-muted)]">{u.email}</p>
              <p className="text-sm mt-1">
                <span className="font-medium">{payLabel(u.payType ?? "HOURLY")}</span>
                {(u.payAmount ?? u.hourlyRate) != null && (u.payAmount ?? u.hourlyRate)! > 0 && (
                  <span className="text-[var(--color-muted)]">
                    {" "}· {u.payAmount ?? u.hourlyRate} {amountSuffix(u.payType ?? "HOURLY")}
                  </span>
                )}
              </p>
              {u.active === false && (
                <span className="inline-block mt-1">
                  <Badge variant="inactive">Inactive</Badge>
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2 items-end shrink-0">
              <button
                type="button"
                onClick={() => openEdit(u)}
                className="text-sm font-medium text-[var(--color-saffron)]"
              >
                Edit
              </button>
              {u.active === false ? (
                <button
                  type="button"
                  onClick={() => toggleActive(u, true)}
                  className="text-sm text-[var(--color-success)]"
                >
                  Reactivate
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => toggleActive(u, false)}
                  className="text-sm text-[var(--color-danger)]"
                >
                  Deactivate
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <form onSubmit={saveEdit} className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Edit {editing.name}</h3>
                <button type="button" onClick={() => setEditing(null)} className="text-2xl leading-none px-2">
                  ×
                </button>
              </div>
              <input
                required
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="field-input"
                placeholder="Name"
              />
              <input
                type="email"
                required
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                className="field-input"
                placeholder="Email"
              />
              <input
                type="password"
                value={editForm.password}
                onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                className="field-input"
                placeholder="New password (leave blank to keep)"
                minLength={6}
              />
              <div className="grid grid-cols-2 gap-3">
                <label className="field-label">
                  Pay type
                  <select
                    value={editForm.payType}
                    onChange={(e) =>
                      setEditForm({ ...editForm, payType: e.target.value as PayType })
                    }
                    className="field-input"
                  >
                    {PAY_TYPES.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </label>
                <label className="field-label">
                  Amount ({amountSuffix(editForm.payType)})
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={editForm.payAmount}
                    onChange={(e) => setEditForm({ ...editForm, payAmount: e.target.value })}
                    className="field-input"
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editForm.active}
                  onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })}
                  className="w-4 h-4"
                />
                Active
              </label>
              <Button type="submit" fullWidth disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
