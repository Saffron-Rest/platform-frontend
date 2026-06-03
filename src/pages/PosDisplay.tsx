import { useEffect, useState } from "react";
import { getDisplayOrder, type PosOrder } from "../api/pos";
import { fmt } from "../lib/calc";

/**
 * Customer-facing display screen — designed for a second monitor or iPad
 * at the checkout counter. Shows the current order total in large text.
 * Polls every 3 seconds; no user interaction required.
 */
export function PosDisplay() {
  const [order, setOrder] = useState<PosOrder | null>(null);
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  useEffect(() => {
    const poll = () =>
      getDisplayOrder().then((o) => {
        setOrder(o);
        setLastUpdate(Date.now());
      }).catch(() => {});

    poll();
    const id = setInterval(poll, 3_000);
    return () => clearInterval(id);
  }, []);

  const total = order ? order.totalGross + (order.tipAmount ?? 0) : 0;

  if (!order || order.lines.length === 0) {
    return (
      <div className="min-h-screen bg-[var(--color-ink)] flex flex-col items-center justify-center text-white">
        <h1 className="font-[family-name:var(--font-display)] text-5xl tracking-tight mb-3">Saffron</h1>
        <p className="text-white/40 text-lg">Welcome</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-ink)] text-white flex flex-col">
      {/* Header */}
      <div className="px-8 pt-8 pb-4 border-b border-white/10">
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">Saffron</h1>
      </div>

      {/* Order lines */}
      <div className="flex-1 px-8 py-6 space-y-3 overflow-auto">
        {order.lines.map((l) => (
          <div key={l.id} className="flex items-center justify-between gap-4 text-xl">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-white/40 tabular-nums w-8 text-right shrink-0">{l.quantity}×</span>
              <span className="font-medium truncate">{l.itemName}</span>
              {l.note && (
                <span className="text-sm text-[var(--color-saffron)]/80 shrink-0">({l.note})</span>
              )}
            </div>
            <span className="tabular-nums font-semibold shrink-0">
              {fmt(l.unitPrice * l.quantity - l.discountAmount * l.quantity)}
            </span>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="px-8 py-6 border-t border-white/10 space-y-2">
        {order.tipAmount > 0 && (
          <div className="flex justify-between text-white/50 text-lg">
            <span>Subtotal</span>
            <span className="tabular-nums">{fmt(order.totalGross)}</span>
          </div>
        )}
        {order.tipAmount > 0 && (
          <div className="flex justify-between text-white/50 text-lg">
            <span>Tip</span>
            <span className="tabular-nums">+{fmt(order.tipAmount)}</span>
          </div>
        )}
        <div className="flex justify-between items-end">
          <span className="text-3xl font-bold text-white/60">Total</span>
          <span className="text-6xl font-bold tabular-nums text-[var(--color-saffron)]">
            {fmt(total)}
          </span>
        </div>
        <p className="text-white/30 text-sm text-right">PLN</p>
      </div>

      {/* Thank you overlay after payment */}
      {order.status === "PAID" && (
        <div className="fixed inset-0 bg-emerald-900 flex flex-col items-center justify-center z-10">
          <div className="text-8xl mb-6">✓</div>
          <h2 className="text-4xl font-bold text-emerald-100">Thank you!</h2>
          <p className="text-emerald-300 text-xl mt-2">Payment received</p>
          <p className="text-5xl font-bold tabular-nums text-white mt-6">{fmt(total)}</p>
        </div>
      )}
    </div>
  );
}
