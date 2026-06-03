import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addLine,
  createOrder,
  getPosMenu,
  getPosTables,
  type PosMenuItem,
  type PosOrder,
  type PosTable,
} from "../api/pos";
import { fmt } from "../lib/calc";
import { Spinner } from "../components/ui/Spinner";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";

/**
 * Mobile Waiter — portrait-optimised tablet/phone screen for tableside ordering.
 *
 * The waiter selects a table, adds items, and sends the order to the kitchen
 * (creates/updates the PosOrder). Payment is handled at the main POS terminal.
 *
 * Designed for single-hand use: large touch targets, thumb-reachable actions.
 */
export function PosWaiter() {
  const [menu, setMenu] = useState<PosMenuItem[]>([]);
  const [tables, setTables] = useState<PosTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTable, setSelectedTable] = useState<PosTable | null>(null);
  const [activeOrder, setActiveOrder] = useState<PosOrder | null>(null);
  const [cart, setCart] = useState<Array<{ menuItemId: string; itemName: string; unitPrice: number; vatRatePct: number; quantity: number }>>([]);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [view, setView] = useState<"tables" | "menu" | "sent">("tables");
  const [sending, setSending] = useState(false);
  const [covers, setCovers] = useState("");

  const load = useCallback(async () => {
    try {
      const [m, t] = await Promise.all([getPosMenu(), getPosTables()]);
      setMenu(m);
      setTables(t);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const categories = useMemo(() => {
    const seen = new Map<string, { name: string; sortOrder: number }>();
    menu.forEach((i) => {
      if (!seen.has(i.categoryId)) seen.set(i.categoryId, { name: i.categoryName, sortOrder: i.categorySortOrder });
    });
    return [...seen.entries()].sort((a, b) => a[1].sortOrder - b[1].sortOrder).map(([id, { name }]) => ({ id, name }));
  }, [menu]);

  const filteredMenu = activeCat ? menu.filter((i) => i.categoryId === activeCat) : menu;
  const cartTotal = cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const cartCount = cart.reduce((s, l) => s + l.quantity, 0);

  const addToCart = (item: PosMenuItem) => {
    setCart((prev) => {
      const ex = prev.find((l) => l.menuItemId === item.id);
      if (ex) return prev.map((l) => l.menuItemId === item.id ? { ...l, quantity: l.quantity + 1 } : l);
      return [...prev, { menuItemId: item.id, itemName: item.name, unitPrice: item.sellPrice, vatRatePct: item.vatRatePct, quantity: 1 }];
    });
  };

  const adjustQty = (menuItemId: string, delta: number) => {
    setCart((prev) => prev.map((l) => l.menuItemId === menuItemId ? { ...l, quantity: l.quantity + delta } : l).filter((l) => l.quantity > 0));
  };

  const handleSend = async () => {
    if (cart.length === 0) return;
    setSending(true);
    setError("");
    try {
      let order = activeOrder;
      if (!order) {
        order = await createOrder({
          tableId: selectedTable?.id,
          covers: covers ? Number(covers) : undefined,
          lines: cart.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity })),
        });
      } else {
        for (const l of cart) {
          order = await addLine(order.id, { menuItemId: l.menuItemId, quantity: l.quantity });
        }
      }
      setActiveOrder(order);
      setCart([]);
      setView("sent");
      const updated = await getPosTables();
      setTables(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-[var(--color-ink)]">
      <Spinner label="Loading…" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--color-ink)] text-white flex flex-col max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 sticky top-0 bg-[var(--color-ink)] z-10">
        <button type="button" onClick={() => { window.location.href = "/pos"; }} className="text-white/40 text-xl px-1">←</button>
        <h1 className="font-bold tracking-tight">Waiter</h1>
        {selectedTable && <span className="text-sm text-white/60 ml-1">· {selectedTable.name}</span>}
        {cartCount > 0 && (
          <button type="button" onClick={() => setView("menu")} className="ml-auto flex items-center gap-2 bg-[var(--color-saffron)] px-3 py-1.5 rounded-full text-sm font-semibold">
            <span>{cartCount} items</span>
            <span>{fmt(cartTotal)}</span>
          </button>
        )}
      </div>

      {error && (
        <div className="px-4 pt-2">
          <Alert variant="error"><div className="flex justify-between"><span>{error}</span><button type="button" onClick={() => setError("")}>×</button></div></Alert>
        </div>
      )}

      {/* Sent confirmation */}
      {view === "sent" && (
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center space-y-6">
          <div className="text-6xl">✓</div>
          <div>
            <h2 className="text-2xl font-bold">Order sent!</h2>
            <p className="text-white/50 mt-1">Kitchen is preparing the order.</p>
            {activeOrder && <p className="text-xs text-white/30 mt-2">{activeOrder.lines.length} items · {fmt(activeOrder.totalGross)}</p>}
          </div>
          <Button onClick={() => { setView("menu"); setActiveOrder(null); }} fullWidth className="!py-4">
            Add more items
          </Button>
          <button type="button" onClick={() => { setView("tables"); setSelectedTable(null); setActiveOrder(null); setCart([]); }} className="text-white/40 text-sm hover:text-white/70">
            New table
          </button>
        </div>
      )}

      {/* Table grid */}
      {view === "tables" && (
        <div className="flex-1 p-4">
          <p className="text-white/50 text-sm mb-3">Select a table to begin</p>
          <div className="grid grid-cols-3 gap-3">
            {tables.map((t) => (
              <button key={t.id} type="button"
                onClick={() => { setSelectedTable(t); setView("menu"); }}
                className={`aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 font-semibold border-2 text-sm transition active:scale-95 ${
                  t.occupied ? "bg-amber-500/20 border-amber-400/40 text-amber-300" : "bg-emerald-500/10 border-emerald-400/30 text-emerald-300"
                }`}>
                <span>{t.name}</span>
                <span className="text-[10px] font-normal opacity-60">{t.seats} 👤</span>
              </button>
            ))}
            <button type="button" onClick={() => { setSelectedTable(null); setView("menu"); }}
              className="aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 text-sm border-2 border-white/20 bg-white/5 text-white/60">
              <span className="text-2xl">📦</span>
              <span>Take-away</span>
            </button>
          </div>
        </div>
      )}

      {/* Menu */}
      {view === "menu" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Category tabs */}
          <div className="flex gap-2 px-4 py-2 overflow-x-auto border-b border-white/10 shrink-0">
            <button type="button" onClick={() => setActiveCat(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${!activeCat ? "bg-[var(--color-saffron)]" : "bg-white/10"}`}>
              All
            </button>
            {categories.map((c) => (
              <button key={c.id} type="button" onClick={() => setActiveCat(c.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${activeCat === c.id ? "bg-[var(--color-saffron)]" : "bg-white/10"}`}>
                {c.name}
              </button>
            ))}
          </div>

          {/* Items — large tap targets for tableside use */}
          <div className="flex-1 overflow-auto p-4 space-y-2">
            {filteredMenu.map((item) => {
              const inCart = cart.find((l) => l.menuItemId === item.id);
              return (
                <div key={item.id} className={`flex items-center gap-3 rounded-xl p-3 border transition ${inCart ? "border-[var(--color-saffron)]/40 bg-[var(--color-saffron)]/10" : "border-white/10 bg-white/5"}`}>
                  <button type="button" onClick={() => addToCart(item)} className="flex-1 min-w-0 text-left active:scale-95">
                    <p className="font-medium text-sm">{item.name}</p>
                    <p className="text-[var(--color-saffron)] font-bold text-sm mt-0.5">{fmt(item.sellPrice)}</p>
                    {item.allergens && <p className="text-[10px] text-red-300 mt-0.5">{item.allergens}</p>}
                  </button>
                  {inCart ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <button type="button" onClick={() => adjustQty(item.id, -1)} className="w-9 h-9 rounded-full bg-white/10 text-lg font-bold flex items-center justify-center">−</button>
                      <span className="w-6 text-center font-bold">{inCart.quantity}</span>
                      <button type="button" onClick={() => adjustQty(item.id, 1)} className="w-9 h-9 rounded-full bg-white/10 text-lg font-bold flex items-center justify-center">+</button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => addToCart(item)} className="w-10 h-10 rounded-full bg-[var(--color-saffron)] text-xl font-bold flex items-center justify-center shrink-0 active:scale-95">+</button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Send to kitchen sticky bar */}
          {cart.length > 0 && (
            <div className="px-4 py-3 border-t border-white/10 space-y-2 sticky bottom-0 bg-[var(--color-ink)]">
              <label className="block text-xs text-white/50">
                Covers (guests)
                <input type="number" min={1} value={covers} onChange={(e) => setCovers(e.target.value)} placeholder="2"
                  className="mt-0.5 w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none" />
              </label>
              <Button onClick={handleSend} disabled={sending} fullWidth className="!py-4 !text-base font-bold">
                {sending ? "Sending…" : `🍽 Send to kitchen · ${fmt(cartTotal)}`}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
