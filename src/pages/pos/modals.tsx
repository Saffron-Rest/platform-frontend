import { useState } from "react";
import { closeSession, openSession, cancelQrPayment, type PosSession } from "../../api/pos";
import { fmt } from "../../lib/calc";
import type { usePosController } from "./usePosController";
import { PosBtn, PosInput, PosLabel, PosModal } from "./ui";

type C = ReturnType<typeof usePosController>;

export function PosModals({
  c,
  session,
  onShiftClosed,
  onSessionOpened,
}: {
  c: C;
  session: PosSession | null;
  onShiftClosed?: () => void;
  onSessionOpened?: (s: PosSession) => void;
}) {
  if (!c.modal) return null;

  if (c.modal === "open-register") {
    return (
      <OpenRegisterModal
        onOpen={s => { onSessionOpened?.(s); c.setModal(null); }}
        onClose={() => c.setModal(null)}
      />
    );
  }

  if (c.modal === "close-shift") {
    if (!session) { c.setModal(null); return null; }
    return (
      <CloseShiftModal
        session={session}
        onClosed={() => { c.setSession(null); onShiftClosed?.(); }}
        onClose={() => c.setModal(null)}
      />
    );
  }

  if (c.modal === "cash") {
    return (
      <PosModal title="Cash drawer" onClose={() => c.setModal(null)}>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
          {(["OUT", "IN"] as const).map(t => (
            <button
              key={t}
              type="button"
              className={`pos-btn pos-btn--pill flex-1 ${c.cashType === t ? "pos-btn--pill-active" : ""}`}
              style={c.cashType === t && t === "OUT" ? { background: "rgb(155 34 38 / 0.1)", color: "var(--color-danger)" } : undefined}
              onClick={() => c.setCashType(t)}
            >
              {t === "OUT" ? "Withdraw" : "Deposit"}
            </button>
          ))}
        </div>
        <PosLabel>Amount (PLN)</PosLabel>
        <PosInput type="number" className="mb-3" value={c.cashAmount} onChange={e => c.setCashAmount(e.target.value)} />
        <PosLabel>Reason</PosLabel>
        <select className="pos-input mb-3" value={c.cashReason} onChange={e => c.setCashReason(e.target.value)}>
          <option value="BANK_DEPOSIT">Bank deposit</option>
          <option value="SUPPLIER_PAYMENT">Supplier</option>
          <option value="PETTY_CASH">Petty cash</option>
          <option value="CHANGE_FUND">Change fund</option>
          <option value="OTHER">Other</option>
        </select>
        <PosLabel>Note</PosLabel>
        <PosInput className="mb-4" value={c.cashNote} onChange={e => c.setCashNote(e.target.value)} />
        <PosBtn variant="primary" disabled={!c.cashAmount || c.cashBusy} onClick={c.handleCashMovement}>
          {c.cashBusy ? "Saving…" : "Confirm"}
        </PosBtn>
      </PosModal>
    );
  }

  if (c.modal === "park") {
    return (
      <PosModal title="Park bill" onClose={() => c.setModal(null)}>
        <p style={{ color: "var(--pos-muted)", fontSize: "0.875rem", marginBottom: "1rem" }}>Hold this order and free the terminal. The table stays busy.</p>
        <PosInput placeholder="Note (optional)" value={c.parkNote} onChange={e => c.setParkNote(e.target.value)} className="mb-4" />
        <PosBtn variant="primary" onClick={c.parkBill}>
          Park bill
        </PosBtn>
      </PosModal>
    );
  }

  if (c.modal === "order-details") {
    return (
      <PosModal title="Order details" onClose={() => c.setModal(null)} wide>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <PosLabel>Covers</PosLabel>
            <PosInput value={c.draft.covers} onChange={e => c.patchDraft({ covers: e.target.value })} />
          </div>
          <div>
            <PosLabel>Order note</PosLabel>
            <PosInput value={c.draft.orderNote} onChange={e => c.patchDraft({ orderNote: e.target.value })} />
          </div>
          <PosBtn variant="ghost" onClick={() => c.setModal("discount")}>
            Apply discount
          </PosBtn>
          <PosBtn variant="primary" onClick={() => c.setModal(null)}>
            Done
          </PosBtn>
        </div>
      </PosModal>
    );
  }

  if (c.modal === "discount") {
    return (
      <PosModal title="Discount" onClose={() => c.setModal(null)}>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
          {(["ORDER", "ITEM"] as const).map(t => (
            <button
              key={t}
              type="button"
              className={`pos-btn pos-btn--pill flex-1 ${c.discountType === t ? "pos-btn--pill-active" : ""}`}
              onClick={() => c.setDiscountType(t)}
            >
              {t === "ORDER" ? "Whole order" : "Line item"}
            </button>
          ))}
        </div>
        {c.discountType === "ITEM" && c.draft.activeOrder && (
          <div style={{ maxHeight: "8rem", overflow: "auto", marginBottom: "1rem" }}>
            {c.draft.activeOrder.lines.map(l => (
              <button
                key={l.id}
                type="button"
                className="pos-btn"
                style={{
                  width: "100%",
                  marginBottom: "0.35rem",
                  justifyContent: "flex-start",
                  borderColor: c.discountLineId === l.id ? "var(--color-saffron)" : undefined,
                  background: c.discountLineId === l.id ? "var(--color-saffron-light)" : undefined,
                }}
                onClick={() => c.setDiscountLineId(l.id)}
              >
                {l.quantity}× {l.itemName}
              </button>
            ))}
          </div>
        )}
        <PosInput type="number" value={c.discountValue} onChange={e => c.setDiscountValue(e.target.value)} placeholder={c.discountIsPct ? "% off" : "PLN off"} className="mb-4" />
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <PosBtn variant="ghost" onClick={() => { c.clearDiscountFn(); c.setModal(null); }}>
            Clear
          </PosBtn>
          <PosBtn variant="primary" disabled={!c.discountValue || c.discountBusy} onClick={c.applyDiscountFn}>
            Apply
          </PosBtn>
        </div>
      </PosModal>
    );
  }

  if (c.modal === "split-pay") {
    const allMethods = [
      { id: "CASH",          label: "Cash" },
      { id: "CARD",          label: "Card" },
      { id: "BLIK",          label: "BLIK" },
      { id: "WOLT",          label: "Wolt" },
      { id: "BOLT_FOOD",     label: "Bolt Food" },
      { id: "GLOVO",         label: "Glovo" },
      { id: "UBER_EATS",     label: "Uber Eats" },
      { id: "VOUCHER",       label: "Voucher" },
      { id: "BANK_TRANSFER", label: "Bank transfer" },
      { id: "OTHER",         label: "Other" },
    ];

    return (
      <PosModal title="Split payment" onClose={() => c.setModal(null)} wide>
        {/* Total + remaining */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 0", marginBottom: "0.75rem", borderBottom: "1px solid var(--pos-border)" }}>
          <div>
            <p style={{ fontSize: "0.75rem", color: "var(--pos-muted)", fontWeight: 600 }}>Total</p>
            <p style={{ fontWeight: 800, fontSize: "1.125rem", fontVariantNumeric: "tabular-nums" }}>{fmt(c.totals.total)}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: "0.75rem", color: "var(--pos-muted)", fontWeight: 600 }}>Remaining</p>
            <p style={{ fontWeight: 800, fontSize: "1.125rem", fontVariantNumeric: "tabular-nums", color: c.legRemaining <= 0.005 ? "var(--pos-green)" : "var(--pos-orange)" }}>
              {c.legRemaining <= 0.005 ? "Covered ✓" : fmt(c.legRemaining)}
            </p>
          </div>
        </div>

        {/* Payment legs */}
        {c.payLegs.map((leg, i) => (
          <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", alignItems: "center" }}>
            <select
              className="pos-input"
              style={{ flex: "0 0 9rem" }}
              value={leg.method}
              onChange={e => c.setPayLegs(p => p.map((l, j) => j === i ? { ...l, method: e.target.value } : l))}
            >
              {allMethods.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
            <PosInput
              type="number"
              value={leg.amount}
              onChange={e => c.setPayLegs(p => p.map((l, j) => j === i ? { ...l, amount: e.target.value } : l))}
              placeholder="0.00"
            />
            {c.payLegs.length > 1 && (
              <button
                type="button"
                onClick={() => c.setPayLegs(p => p.filter((_, j) => j !== i))}
                style={{ width: "2.25rem", height: "2.25rem", flexShrink: 0, border: "1.5px solid var(--pos-border)", borderRadius: "0.625rem", background: "var(--pos-surface-2)", cursor: "pointer", fontSize: "1rem", color: "var(--pos-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          style={{ color: "var(--color-saffron)", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "1rem", background: "none", border: "none", cursor: "pointer" }}
          onClick={() =>
            c.setPayLegs(p => [...p, { method: "CASH", amount: c.legRemaining > 0 ? String(Math.round(c.legRemaining * 100) / 100) : "" }])
          }
        >
          + Add leg
        </button>
        <PosBtn variant="primary" disabled={c.legRemaining > 0.005 || c.payBusy} onClick={c.payMulti}>
          {c.payBusy ? "Processing…" : `Confirm split payment — ${fmt(c.totals.total)}`}
        </PosBtn>
      </PosModal>
    );
  }

  if (c.modal === "qr" && c.qrTx) {
    return (
      <PosModal title="BLIK / QR" onClose={() => c.setModal(null)}>
        <div style={{ textAlign: "center", padding: "0.5rem 0 1rem" }}>
          <p style={{ fontSize: "2.25rem", fontWeight: 800, color: "var(--pos-orange)", fontVariantNumeric: "tabular-nums" }}>
            {fmt(c.qrTx.amount)}
          </p>
          <p style={{ marginTop: "0.5rem", fontWeight: 600, color: "var(--pos-muted)" }}>{c.qrTx.status}</p>
          <button
            type="button"
            style={{ marginTop: "1.25rem", fontSize: "0.8125rem", color: "var(--pos-muted)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
            onClick={async () => {
              await cancelQrPayment(c.qrTx!.id).catch(() => {});
              c.setQrTx(null);
              c.setModal(null);
            }}
          >
            Cancel payment
          </button>
        </div>
      </PosModal>
    );
  }

  return null;
}

function CloseShiftModal({
  session,
  onClosed,
  onClose,
}: {
  session: PosSession;
  onClosed: () => void;
  onClose: () => void;
}) {
  const [float_, setFloat] = useState("0");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setBusy(true);
    setErr("");
    try {
      await closeSession(session.id, Number(float_) || 0);
      onClosed();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
      setBusy(false);
    }
  };

  return (
    <PosModal title="Close Register" onClose={onClose}>
      <p style={{ color: "var(--pos-muted)", fontSize: "0.875rem", marginBottom: "1rem" }}>
        Opening float was <strong>{fmt(session.openingFloat)}</strong>
      </p>
      {err && <p style={{ color: "var(--color-danger)", fontSize: "0.875rem", marginBottom: "1rem" }}>{err}</p>}
      <PosLabel>Closing cash in drawer</PosLabel>
      <PosInput type="number" value={float_} onChange={e => setFloat(e.target.value)} className="mb-4" />
      <PosBtn variant="ghost" onClick={onClose}>
        Cancel
      </PosBtn>
      <div style={{ height: "0.5rem" }} />
      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="pos-btn w-full"
        style={{ background: "var(--color-danger)", color: "white", border: "none", minHeight: "3rem", fontWeight: 700 }}
      >
        {busy ? "Closing…" : "Close register"}
      </button>
    </PosModal>
  );
}

// ─── Open Register modal ──────────────────────────────────────────────────────

function OpenRegisterModal({
  onOpen,
  onClose,
}: {
  onOpen: (s: PosSession) => void;
  onClose: () => void;
}) {
  const [float_, setFloat] = useState("0");
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState("");
  const presets = [0, 100, 200, 500];

  const submit = async () => {
    setBusy(true);
    setErr("");
    try {
      onOpen(await openSession(Number(float_) || 0));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to open register");
      setBusy(false);
    }
  };

  return (
    <PosModal title="Open Register" onClose={onClose}>
      <p style={{ color: "var(--pos-muted)", fontSize: "0.875rem", marginBottom: "1.25rem" }}>
        Count your opening cash float before starting.
      </p>
      {err && <p style={{ color: "var(--color-danger)", fontSize: "0.875rem", marginBottom: "1rem" }}>{err}</p>}
      <PosLabel>Opening float (PLN)</PosLabel>
      <PosInput
        type="number"
        min={0}
        value={float_}
        onChange={e => setFloat(e.target.value)}
        onKeyDown={e => e.key === "Enter" && !busy && submit()}
        style={{ fontSize: "1.75rem", fontWeight: 800, textAlign: "center", marginBottom: "0.875rem", height: "3.75rem" }}
        autoFocus
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.5rem", marginBottom: "1.25rem" }}>
        {presets.map(p => (
          <button
            key={p}
            type="button"
            className={`pos-btn pos-btn--pill ${Number(float_) === p ? "pos-btn--pill-active" : ""}`}
            style={{ width: "100%" }}
            onClick={() => setFloat(String(p))}
          >
            {p === 0 ? "0" : fmt(p)}
          </button>
        ))}
      </div>
      <PosBtn variant="primary" onClick={submit} disabled={busy}>
        {busy ? "Opening…" : "Open register →"}
      </PosBtn>
    </PosModal>
  );
}
