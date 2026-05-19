import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import type { PaymentSource, SalaryPaymentRecord, User } from "../../types";
import { fmt } from "../../lib/calc";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";

function monthStartIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

type MatchMode = "paidDate" | "payroll";

export function AdminPayouts() {
  const [from, setFrom] = useState(monthStartIso());
  const [to, setTo] = useState(todayIso());
  const [userId, setUserId] = useState("");
  const [source, setSource] = useState<"" | PaymentSource>("");
  const [matchMode, setMatchMode] = useState<MatchMode>("paidDate");
  const [cashiers, setCashiers] = useState<User[]>([]);
  const [payments, setPayments] = useState<SalaryPaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api<User[]>("/users")
      .then((list) => setCashiers(list.filter((u) => u.role === "CASHIER")))
      .catch(() => setCashiers([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ from, to });
      if (userId) params.set("userId", userId);
      if (source) params.set("source", source);
      if (matchMode === "payroll") params.set("matchPeriod", "payroll");
      const rows = await api<SalaryPaymentRecord[]>(`/treasury/salary-payments?${params}`);
      setPayments(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load payouts");
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [from, to, userId, source, matchMode]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = useMemo(() => payments.reduce((s, p) => s + p.amount, 0), [payments]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Salary payouts"
        subtitle="All recorded salary payments — filter by date, employee, or source"
        action={
          <Link to="/admin/salaries" className="text-sm font-medium text-[var(--color-saffron)]">
            Payroll →
          </Link>
        }
      />

      <Card className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["Paid date in range", "paidDate"],
              ["Payroll period overlap", "payroll"],
            ] as const
          ).map(([label, mode]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setMatchMode(mode)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                matchMode === mode
                  ? "bg-[var(--color-saffron)] text-white"
                  : "bg-black/5 hover:bg-black/10"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="field-label">
            From
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="field-input"
            />
          </label>
          <label className="field-label">
            To
            <input
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
              className="field-input"
            />
          </label>
          <label className="field-label">
            Employee
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="field-input"
            >
              <option value="">All cashiers</option>
              {cashiers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Paid from
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as "" | PaymentSource)}
              className="field-input"
            >
              <option value="">Cash or card</option>
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
            </select>
          </label>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="dark" onClick={() => void load()}>
            Apply filters
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setFrom(monthStartIso());
              setTo(todayIso());
              setUserId("");
              setSource("");
              setMatchMode("paidDate");
            }}
          >
            Reset
          </Button>
        </div>
        <p className="text-xs text-[var(--color-muted)]">
          {matchMode === "payroll"
            ? "Shows payments tagged for a payroll period that overlaps your date range (even if paid on another day)."
            : "Shows payments by the date money was paid out."}
        </p>
      </Card>

      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        <div className="flex justify-between items-baseline gap-2 mb-4">
          <p className="font-semibold">
            {payments.length} payout{payments.length === 1 ? "" : "s"}
          </p>
          <p className="text-lg font-bold tabular-nums">{fmt(total)}</p>
        </div>
        {loading ? (
          <p className="text-center text-[var(--color-muted)] py-6">Loading…</p>
        ) : payments.length === 0 ? (
          <p className="text-center text-[var(--color-muted)] py-6">No payouts match these filters.</p>
        ) : (
          <ul className="divide-y divide-black/5">
            {payments.map((p) => (
              <li key={p.id} className="py-3 flex flex-wrap justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{p.employeeName}</p>
                  <p className="text-sm text-[var(--color-muted)]">
                    Paid {p.paidDate}
                    {p.periodFrom && p.periodTo && (
                      <span>
                        {" "}
                        · payroll {p.periodFrom} → {p.periodTo}
                      </span>
                    )}
                  </p>
                  {p.notes && (
                    <p className="text-xs text-[var(--color-muted)] mt-0.5">{p.notes}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold tabular-nums">{fmt(p.amount)}</p>
                  <Badge variant="neutral">{p.source === "CASH" ? "Cash" : "Card"}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
