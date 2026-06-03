import { useEffect, useMemo, useState } from "react";
import {
  addLine,
  createOrder,
  getPosMenu,
  getPosTables,
  payOrder,
  voidOrder,
  type PosMenuItem,
  type PosOrder,
  type PosTable,
} from "../api/pos";
import { fmt } from "../lib/calc";
import { Spinner } from "../components/ui/Spinner";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";

// ─── Types ───────────────────────────────────────────────────────────────────

type CartLine = {
  menuItemId: string;
  itemName: string;
  unitPrice: number;
  vatRatePct: number;
  quantity: number;
  note?: string;
};

// ─── POS App shell ───────────────────────────────────────────────────────────

export function PosApp() {
  const [menu, setMenu] = useState<PosMenuItem[]>([]);
  const [tables, setTables] = useState<PosTable[]>([]);
  const [activeOrder, setActiveOrder] = useState<PosOrder | null>(null);
  const [selectedTable, setSelectedTable] = useState<PosTable | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(false);
  const [view, setView] = useState<"tables" | "menu" | "cart">("tables");
  const [buyerNip, setBuyerNip] = useState("");

  useEffect(() => {
    Promise.all([getPosMenu(), getPosTables()])
      .then(([m, t]) => { setMenu(m); setTables(t); })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    menu.forEach((i) => { if (!seen.has(i.categoryId)) seen.set(i.categoryId, i.categoryId); });
    return [...seen.keys()];
  }, [menu]);

  const [activeCat, setActiveCat] = useState<string | null>(null);
  const filteredMenu = activeCat ? menu.filter((i) => i.categoryId === activeCat) : menu;

  const cartTotal = cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const cartVat = cart.reduce((s, l) => {
    const gross = l.unitPrice * l.quantity;
    const net = gross / (1 + l.vatRatePct / 100);
    return s + (gross - net);
  }, 0);

  const addToCart = (item: PosMenuItem) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.menuItemId === item.id);
      if (existing) {
        return prev.map((l) => l.menuItemId === item.id ? { ...l, quantity: l.quantity + 1 } : l);
      }
      return [...prev, { menuItemId: item.id, itemName: item.name, unitPrice: item.sellPrice, vatRatePct: item.vatRatePct, quantity: 1 }];
    });
    setView("menu");
  };

  const removeFromCart = (menuItemId: string) => {
    setCart((prev) => prev.filter((l) => l.menuItemId !== menuItemId));
  };

  const handlePay = async (method: "CASH" | "CARD") => {
    setPaying(true);
    setError("");
    try {
      let order = activeOrder;
      if (!order) {
        order = await createOrder({
          tableId: selectedTable?.id,
          lines: cart.map((l) => ({
            menuItemId: l.menuItemId,
            quantity: l.quantity,
          })),
        });
      } else {
        for (const l of cart) {
          order = await addLine(order.id, { menuItemId: l.menuItemId, quantity: l.quantity });
        }
      }
      const paid = await payOrder(order.id, {
        paymentMethod: method,
        buyerNip: buyerNip.trim() || undefined,
      });
      setActiveOrder(paid);
      setCart([]);
      setBuyerNip("");
      setView("tables");
      const updated = await getPosTables();
      setTables(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setPaying(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-[var(--color-ink)]">
      <Spinner label="Loading POS…" />
    </div>
  );

  return (
    <div className="flex h-screen bg-[var(--color-ink)] text-white overflow-hidden">
      {/* Left: Table map / Menu grid */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-4 px-4 py-3 border-b border-white/10">
          <h1 className="font-bold text-xl tracking-tight">Saffron POS</h1>
          <div className="flex gap-1 ml-4">
            {(["tables", "menu", "cart"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${
                  view === v ? "bg-[var(--color-saffron)] text-white" : "bg-white/10 hover:bg-white/20"
                }`}
              >
                {v === "cart" ? `Cart (${cart.length})` : v}
              </button>
            ))}
          </div>
          {selectedTable && (
            <span className="ml-auto text-sm text-white/60">
              Table: <strong className="text-white">{selectedTable.name}</strong>
            </span>
          )}
        </div>

        {error && (
          <div className="px-4 py-2">
            <Alert variant="error">{error}</Alert>
          </div>
        )}

        {/* Table map */}
        {view === "tables" && (
          <div className="flex-1 overflow-auto p-4">
            <h2 className="text-white/60 text-xs uppercase tracking-widest mb-3">Select a table</h2>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
              {tables.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { setSelectedTable(t); setView("menu"); }}
                  className={`aspect-square rounded-xl flex flex-col items-center justify-center text-sm font-semibold border-2 transition ${
                    t.occupied
                      ? "bg-amber-500/20 border-amber-400/50 text-amber-300"
                      : "bg-emerald-500/10 border-emerald-400/30 text-emerald-300 hover:bg-emerald-500/20"
                  } ${selectedTable?.id === t.id ? "ring-2 ring-[var(--color-saffron)]" : ""}`}
                >
                  <span>{t.name}</span>
                  <span className="text-[10px] font-normal opacity-70">{t.seats} seats</span>
                  {t.occupied && <span className="text-[10px] text-amber-400">Occupied</span>}
                </button>
              ))}
              {/* Takeaway slot */}
              <button
                type="button"
                onClick={() => { setSelectedTable(null); setView("menu"); }}
                className="aspect-square rounded-xl flex flex-col items-center justify-center text-sm font-semibold border-2 border-white/20 bg-white/5 hover:bg-white/10 text-white/70"
              >
                <span>📦</span>
                <span>Take-away</span>
              </button>
            </div>
          </div>
        )}

        {/* Menu grid */}
        {view === "menu" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Category tabs */}
            <div className="flex gap-2 px-4 py-2 overflow-x-auto border-b border-white/10">
              <button
                type="button"
                onClick={() => setActiveCat(null)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${!activeCat ? "bg-[var(--color-saffron)]" : "bg-white/10"}`}
              >
                All
              </button>
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setActiveCat(c)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${activeCat === c ? "bg-[var(--color-saffron)]" : "bg-white/10"}`}
                >
                  {c}
                </button>
              ))}
            </div>
            {/* Items */}
            <div className="flex-1 overflow-auto p-4 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3 content-start">
              {filteredMenu.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => addToCart(item)}
                  className="flex flex-col items-start p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition active:scale-95"
                >
                  {item.imagePath && (
                    <img
                      src={`/api/uploads/${item.imagePath}`}
                      alt=""
                      className="w-full aspect-square rounded-lg object-cover mb-2"
                    />
                  )}
                  <span className="text-sm font-medium leading-tight">{item.name}</span>
                  <span className="text-[var(--color-saffron)] font-bold mt-1">{fmt(item.sellPrice)}</span>
                  <span className="text-[10px] text-white/40 mt-0.5">VAT {item.vatRatePct}%</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Cart */}
        {view === "cart" && (
          <div className="flex-1 overflow-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <p className="text-white/50 text-center py-12">Cart is empty</p>
            ) : (
              cart.map((line) => (
                <div key={line.menuItemId} className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{line.itemName}</p>
                    <p className="text-sm text-white/50">{fmt(line.unitPrice)} × {line.quantity}</p>
                  </div>
                  <span className="font-bold">{fmt(line.unitPrice * line.quantity)}</span>
                  <button
                    type="button"
                    onClick={() => removeFromCart(line.menuItemId)}
                    className="text-red-400 hover:text-red-300 text-lg leading-none px-2"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Right: Order summary + payment */}
      <div className="w-72 flex flex-col bg-white/5 border-l border-white/10">
        <div className="px-4 py-3 border-b border-white/10">
          <p className="text-white/60 text-xs uppercase tracking-widest">Order</p>
          {selectedTable && (
            <p className="font-semibold">{selectedTable.name}</p>
          )}
        </div>

        <div className="flex-1 overflow-auto px-4 py-3 space-y-2">
          {cart.map((l) => (
            <div key={l.menuItemId} className="flex justify-between text-sm">
              <span className="text-white/80 truncate flex-1 mr-2">{l.quantity}× {l.itemName}</span>
              <span className="font-medium">{fmt(l.unitPrice * l.quantity)}</span>
            </div>
          ))}
          {cart.length === 0 && (
            <p className="text-white/30 text-sm text-center py-4">Add items from the menu</p>
          )}
        </div>

        <div className="px-4 py-3 border-t border-white/10 space-y-3">
          {/* Totals */}
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-white/60">
              <span>Net</span>
              <span>{fmt(cartTotal - cartVat)}</span>
            </div>
            <div className="flex justify-between text-white/60">
              <span>VAT</span>
              <span>{fmt(cartVat)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span className="text-[var(--color-saffron)]">{fmt(cartTotal)}</span>
            </div>
          </div>

          {/* NIP field */}
          <label className="block text-xs text-white/50">
            NIP (optional — required for B2B receipt)
            <input
              type="text"
              value={buyerNip}
              onChange={(e) => setBuyerNip(e.target.value)}
              placeholder="1234567890"
              maxLength={10}
              className="mt-1 w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[var(--color-saffron)]"
            />
          </label>

          {/* Payment buttons */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => handlePay("CASH")}
              disabled={cart.length === 0 || paying}
              className="!py-4 !text-sm font-bold"
            >
              {paying ? "…" : "💵 Cash"}
            </Button>
            <Button
              onClick={() => handlePay("CARD")}
              disabled={cart.length === 0 || paying}
              variant="secondary"
              className="!py-4 !text-sm font-bold"
            >
              {paying ? "…" : "💳 Card"}
            </Button>
          </div>

          {cart.length > 0 && (
            <button
              type="button"
              onClick={() => setCart([])}
              className="w-full text-xs text-red-400 hover:text-red-300 py-1"
            >
              Clear order
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
