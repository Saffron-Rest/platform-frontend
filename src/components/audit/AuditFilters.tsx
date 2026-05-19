import { useState } from "react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import type { User } from "../../types";
import { formatAction } from "../../lib/auditDisplay";

const ACTIONS = [
  "",
  "CREATE",
  "UPDATE",
  "DELETE",
  "SUBMIT",
  "UNLOCK",
  "LOGIN",
  "LOGIN_FAILED",
  "EXPORT",
  "SYNC",
] as const;

const ENTITIES = ["", "DailyEntry", "ExpenseItem", "User", "Settings", "Report", "Auth"] as const;

const QUICK_ACTIONS = ["LOGIN_FAILED", "EXPORT", "SUBMIT", "DELETE"] as const;

export type AuditFilterState = {
  q: string;
  action: string;
  entityType: string;
  userId: string;
  entityId: string;
  from: string;
  to: string;
};

type Props = {
  filters: AuditFilterState;
  users: User[];
  onChange: (next: AuditFilterState) => void;
  onApply: () => void;
  onClear: () => void;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function AuditFilters({ filters, users, onChange, onApply, onClear }: Props) {
  const [expanded, setExpanded] = useState(false);

  const set = (patch: Partial<AuditFilterState>) => onChange({ ...filters, ...patch });

  const activeChips: { label: string; clear: () => void }[] = [];
  if (filters.q) activeChips.push({ label: `Search: ${filters.q}`, clear: () => set({ q: "" }) });
  if (filters.action) activeChips.push({ label: formatAction(filters.action), clear: () => set({ action: "" }) });
  if (filters.entityType) activeChips.push({ label: filters.entityType, clear: () => set({ entityType: "" }) });
  if (filters.userId) {
    const u = users.find((x) => x.id === filters.userId);
    activeChips.push({ label: u?.name ?? "User", clear: () => set({ userId: "" }) });
  }
  if (filters.from || filters.to) {
    activeChips.push({
      label: filters.from && filters.to ? `${filters.from} → ${filters.to}` : filters.from || filters.to,
      clear: () => set({ from: "", to: "" }),
    });
  }

  const applyPreset = (from: string, to: string) => {
    onChange({ ...filters, from, to });
    onApply();
  };

  return (
    <Card className="mb-4 space-y-4">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["Today", todayIso(), todayIso()],
            ["7 days", daysAgo(6), todayIso()],
            ["30 days", daysAgo(29), todayIso()],
          ] as const
        ).map(([label, from, to]) => (
          <button
            key={label}
            type="button"
            onClick={() => applyPreset(from, to)}
            className="px-3 py-1.5 rounded-full text-xs font-medium bg-black/5 hover:bg-[var(--color-saffron)]/15 hover:text-[var(--color-saffron)] transition"
          >
            {label}
          </button>
        ))}
      </div>

      <label className="field-label">
        Search activity
        <input
          type="search"
          value={filters.q}
          onChange={(e) => set({ q: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && onApply()}
          placeholder="User name, summary, entity ID…"
          className="field-input"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-[var(--color-muted)] w-full">Quick filters</span>
        {QUICK_ACTIONS.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => {
              set({ action: filters.action === a ? "" : a });
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
              filters.action === a
                ? "bg-[var(--color-saffron)] text-white border-[var(--color-saffron)]"
                : "border-black/10 hover:border-[var(--color-saffron)]/40"
            }`}
          >
            {formatAction(a)}
          </button>
        ))}
      </div>

      {activeChips.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          {activeChips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={chip.clear}
              className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs bg-[var(--color-cream)] border border-black/10 hover:border-[var(--color-saffron)]/40"
            >
              {chip.label}
              <span className="text-[var(--color-muted)]">×</span>
            </button>
          ))}
          <button type="button" onClick={onClear} className="text-xs text-[var(--color-saffron)] font-medium ml-1">
            Clear all
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="text-sm font-medium text-[var(--color-saffron)]"
      >
        {expanded ? "Hide" : "Show"} advanced filters
      </button>

      {expanded && (
        <div className="grid gap-3 sm:grid-cols-2 pt-1 border-t border-black/5">
          <label className="field-label">
            Action
            <select value={filters.action} onChange={(e) => set({ action: e.target.value })} className="field-input">
              {ACTIONS.map((a) => (
                <option key={a || "all"} value={a}>
                  {a ? formatAction(a) : "All actions"}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Entity
            <select
              value={filters.entityType}
              onChange={(e) => set({ entityType: e.target.value })}
              className="field-input"
            >
              {ENTITIES.map((e) => (
                <option key={e || "all"} value={e}>
                  {e || "All types"}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            User
            <select value={filters.userId} onChange={(e) => set({ userId: e.target.value })} className="field-input">
              <option value="">All users</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Entity ID
            <input
              type="text"
              value={filters.entityId}
              onChange={(e) => set({ entityId: e.target.value })}
              placeholder="Paste UUID"
              className="field-input font-mono text-xs"
            />
          </label>
          <label className="field-label">
            From
            <input type="date" value={filters.from} onChange={(e) => set({ from: e.target.value })} className="field-input" />
          </label>
          <label className="field-label">
            To
            <input type="date" value={filters.to} onChange={(e) => set({ to: e.target.value })} className="field-input" />
          </label>
        </div>
      )}

      <Button variant="dark" fullWidth onClick={onApply}>
        Search
      </Button>
    </Card>
  );
}
