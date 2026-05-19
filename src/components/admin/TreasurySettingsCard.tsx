import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { TreasuryOverview, TreasurySettings } from "../../types";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Alert } from "../ui/Alert";

const PLATFORM_KEYS = ["wolt", "bolt", "uberEats", "glovo", "other"] as const;

const PLATFORM_LABELS: Record<string, string> = {
  wolt: "Wolt",
  bolt: "Bolt",
  uberEats: "Uber Eats",
  glovo: "Glovo",
  other: "Other",
};

function defaultSettings(): TreasurySettings {
  return {
    initialCashBalance: 0,
    initialCardBalance: 0,
    cardSalesSettlementRate: 1,
    platformSettlementRates: {
      wolt: 0.5,
      bolt: 0.5,
      uberEats: 0.5,
      glovo: 0.5,
      other: 0.5,
    },
  };
}

export function TreasurySettingsCard() {
  const [form, setForm] = useState<TreasurySettings>(defaultSettings());
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<TreasuryOverview>("/treasury")
      .then((t) => setForm(t.settings))
      .catch(() => setForm(defaultSettings()));
  }, []);

  const save = async () => {
    setSaving(true);
    setMsg("");
    setErr("");
    try {
      await api<TreasuryOverview>("/treasury/settings", {
        method: "PUT",
        body: JSON.stringify(form),
      });
      setMsg("Treasury settings saved");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="space-y-4">
      <h3 className="font-semibold">Cash & card balances</h3>
      <p className="text-sm text-[var(--color-muted)]">
        Starting balances and how much of delivery sales reach your bank (e.g. 400 PLN on Wolt at 50% → 200
        PLN to card). Locked shift reports update balances; record salary payouts from cash or card on
        Salaries.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field-label">
          Initial cash balance (PLN)
          <input
            type="number"
            min={0}
            step={0.01}
            value={form.initialCashBalance}
            onChange={(e) =>
              setForm({ ...form, initialCashBalance: Number(e.target.value) || 0 })
            }
            className="field-input"
          />
        </label>
        <label className="field-label">
          Initial card / bank balance (PLN)
          <input
            type="number"
            min={0}
            step={0.01}
            value={form.initialCardBalance}
            onChange={(e) =>
              setForm({ ...form, initialCardBalance: Number(e.target.value) || 0 })
            }
            className="field-input"
          />
        </label>
      </div>

      <label className="field-label">
        In-store card sales — % to bank
        <input
          type="number"
          min={0}
          max={1}
          step={0.05}
          value={form.cardSalesSettlementRate}
          onChange={(e) =>
            setForm({ ...form, cardSalesSettlementRate: Number(e.target.value) || 0 })
          }
          className="field-input"
        />
        <span className="text-xs text-[var(--color-muted)] block mt-1">Usually 1.0 (100%)</span>
      </label>

      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        Delivery platforms — % to bank
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {PLATFORM_KEYS.map((key) => (
          <label key={key} className="field-label">
            {PLATFORM_LABELS[key]}
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={form.platformSettlementRates[key] ?? 0.5}
              onChange={(e) =>
                setForm({
                  ...form,
                  platformSettlementRates: {
                    ...form.platformSettlementRates,
                    [key]: Number(e.target.value) || 0,
                  },
                })
              }
              className="field-input"
            />
          </label>
        ))}
      </div>

      {msg && <Alert variant="success">{msg}</Alert>}
      {err && <Alert variant="error">{err}</Alert>}
      <Button onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save treasury settings"}
      </Button>
    </Card>
  );
}
