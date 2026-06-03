import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addLine,
  closeSession,
  createOrder,
  getCurrentSession,
  getPosMenu,
  getPosTables,
  openSession,
  payOrder,
  type PosMenuItem,
  type PosOrder,
  type PosSession,
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function nipValid(nip: string) {
  const digits = nip.replace(/\D/g, "");
  if (digits.length !== 10) return false;
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const sum = weights.reduce((acc, w, i) => acc + w * Number(digits[i]), 0);
  return sum % 11 === Number(digits[9]);
}

// ─── Session gate ─────────────────────────────────────────────────────────────

function SessionGate({ onOpen }: { onOpen: (s: PosSession) => void }) {
  const [float_, setFloat] = useState("0");
  const [opening, setOpening] = useState(false);
  const [err, setErr] = useState("");

  const handleOpen = async () => {
    setOpening(true);
    setErr("");
    try {
      const s = await openSession(Number(float_) || 0);
      onOpen(s);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to open session");
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[var(--color-ink)] text-white">
      <div className="w-full max-w-sm p-8 rounded-2xl bg-white/5 border border-white/10 space-y-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Saffron POS</h1>
        <p className="text-white/60 text-sm">Enter opening cash float to begin shift</p>
        {err && <Alert variant="error">{err}</Alert>}
        <label className="block text-left text-sm text-white/60">
          Opening float (PLN)
          <input
            type="number"
            min={0}
            step={0.01}
            value={float_}
            onChange={(e) => setFloat(e.target.value)}
            className="mt-1 w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-lg text-center focus:outline-none focus:ring-2 focus:ring-[var(--color-saffron)]"
            onKeyDown={(e) => e.key === "Enter" && handleOpen()}
          />
        </label>
        <Button onClick={handleOpen} disabled={opening} fullWidth className="!py-4 !text-base font-bold">
          {opening ? "Opening…" : "Open Shift"}
        </Button>
      </div>
    </div>
  );
}

// ─── Close session modal ──────────────────────────────────────────────────────

function CloseSessionModal({
  session,
  onClosed,
  onCancel,
}: {
  session: PosSession;
  onClosed: () => void;
  onCancel: () => void;
}) {
  const [float_, setFloat] = useState("0");
  const [closing, setClosing] = useState(false);
  const [err, setErr] = useState("");

  const handleClose = async () => {
    setClosing(true);
    setErr("");
    try {
      await closeSession(session.id, Number(float_) || 0);
      onClosed();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to close session");
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[var(--color-ink)] border border-white/10 rounded-2xl p-6 space-y-5 text-white">
        <h2 className="text-lg font-bold">Close Shift</h2>
        {err && <Alert variant="error">{err}</Alert>}
        <div className="text-sm text-white/60 space-y-1">
          <p>Opening float: <strong className="text-white">{fmt(session.openingFloat)}</strong></p>
        </div>
        <label className="block text-sm text-white/60">
          Closing cash count (PLN)
          <input
            type="number"
            min={0}
            step={0.01}
            value={float_}
            onChange={(e) => setFloat(e.target.value)}
            className="mt-1 w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-lg text-center focus:outline-none focus:ring-2 focus:ring-[var(--color-saffron)]"
          />
        </label>
        <p className="text-xs text-white/40">
          Closing will auto-fill your shift report with today's POS totals.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="ghost" onClick={onCancel} disabled={closing}>Cancel</Button>
          <Button onClick={handleClose} disabled={closing} className="!bg-red-600 hover:!bg-red-700">
            {closing ? "Closing…" : "Close Shift"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main POS App ─────────────────────────────────────────────────────────────

export function PosApp() {
  const [session, setSession] = useState<PosSession | null | "loading">("loading");
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
  const [tendered, setTendered] = useState("");
  const [covers, setCovers] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [showCloseModal, setShowCloseModal] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [m, t] = await Promise.all([getPosMenu(), getPosTables()]);
      setMenu(m);
      setTables(t);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    getCurrentSession().then((s) => setSession(s)).catch(() => setSession(null));
    loadData().finally(() => setLoading(false));

    // Auto-refresh table occupancy every 30 seconds.
    const interval = setInterval(() => {
      getPosTables().then(setTables).catch(() => {});
    }, 30_000);
    return () => clearInterval(interval);
  }, [loadData]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const categories = useMemo(() => {
    const seen = new Map<string, { name: string; sortOrder: number }>();
    menu.forEach((i) => {
      if (!seen.has(i.categoryId)) {
        seen.set(i.categoryId, { name: i.categoryName, sortOrder: i.categorySortOrder });
      }
    });
    return [...seen.entries()]
      .sort((a, b) => a[1].sortOrder - b[1].sortOrder)
      .map(([id, { name }]) => ({ id, name }));
  }, [menu]);

  const filteredMenu = useMemo(
    () => activeCat ? menu.filter((i) => i.categoryId === activeCat) : menu,
    [menu, activeCat]
  );

  const areas = useMemo(() => {
    const seen = new Set<string>();
    tables.forEach((t) => { if (t.area) seen.add(t.area); });
    return [...seen].sort();
  }, [tables]);

  const filteredTables = areaFilter
    ? tables.filter((t) => t.area === areaFilter)
    : tables;

  const cartTotal = cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const cartVat = cart.reduce((s, l) => {
    const gross = l.unitPrice * l.quantity;
    return s + gross - gross / (1 + l.vatRatePct / 100);
  }, 0);
  const change = tendered ? Number(tendered) - cartTotal : null;
  const nipStatus = buyerNip.length === 0 ? "empty" : nipValid(buyerNip) ? "valid" : "invalid";

  // ── Cart actions ──────────────────────────────────────────────────────────

  const adjustQty = (menuItemId: string, delta: number) => {
    setCart((prev) => {
      const next = prev.map((l) =>
        l.menuItemId === menuItemId ? { ...l, quantity: l.quantity + delta } : l
      ).filter((l) => l.quantity > 0);
      return next;
    });
  };

  const addToCart = (item: PosMenuItem) => {
    setCart((prev) => {
      const ex = prev.find((l) => l.menuItemId === item.id);
      if (ex) return prev.map((l) => l.menuItemId === item.id ? { ...l, quantity: l.quantity + 1 } : l);
      return [...prev, {
        menuItemId: item.id,
        itemName: item.name,
        unitPrice: item.sellPrice,
        vatRatePct: item.vatRatePct,
        quantity: 1,
      }];
    });
  };

  // ── Payment ───────────────────────────────────────────────────────────────

  const handlePay = async (method: "CASH" | "CARD") => {
    if (nipStatus === "invalid") { setError("NIP is invalid — 10 digits, correct checksum required."); return; }
    setPaying(true);
    setError("");
    try {
      let order = activeOrder;
      if (!order) {
        order = await createOrder({
          tableId: selectedTable?.id,
          covers: covers ? Number(covers) : undefined,
          orderNote: orderNote.trim() || undefined,
          lines: cart.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity, note: l.note })),
        });
      } else {
        for (const l of cart) {
          order = await addLine(order.id, { menuItemId: l.menuItemId, quantity: l.quantity, note: l.note });
        }
      }
      const paid = await payOrder(order.id, {
        paymentMethod: method,
        amountTendered: tendered ? Number(tendered) : undefined,
        buyerNip: buyerNip.trim() || undefined,
      });
      setActiveOrder(paid);
      setCart([]);
      setBuyerNip("");
      setTendered("");
      setCovers("");
      setOrderNote("");
      setView("tables");
      const updated = await getPosTables();
      setTables(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setPaying(false);
    }
  };

  // ── Session gate ──────────────────────────────────────────────────────────

  if (session === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--color-ink)]">
        <Spinner label="Loading POS…" />
      </div>
    );
  }

  if (!session) {
    return <SessionGate onOpen={(s) => { setSession(s); }} />;
  }

  // ── Main UI ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-[var(--color-ink)] text-white overflow-hidden">
      {showCloseModal && (
        <CloseSessionModal
          session={session}
          onClosed={() => { setSession(null); setShowCloseModal(false); setCart([]); }}
          onCancel={() => setShowCloseModal(false)}
        />
      )}

      {/* ── Left panel ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 flex-wrap">
          <h1 className="font-bold text-lg tracking-tight">Saffron POS</h1>
          <div className="flex gap-1">
            {(["tables", "menu", "cart"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition ${
                  view === v ? "bg-[var(--color-saffron)]" : "bg-white/10 hover:bg-white/20"
                }`}
              >
                {v === "cart" ? `Cart${cart.length ? ` (${cart.reduce((s, l) => s + l.quantity, 0)})` : ""}` : v}
              </button>
            ))}
          </div>
          {selectedTable && (
            <span className="text-sm text-white/60">
              📍 <strong className="text-white">{selectedTable.name}</strong>
            </span>
          )}
          <button
            type="button"
            onClick={() => setShowCloseModal(true)}
            className="ml-auto text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg border border-red-400/30 hover:bg-red-400/10"
          >
            Close Shift
          </button>
        </div>

        {error && (
          <div className="px-4 pt-2">
            <Alert variant="error">
              <div className="flex justify-between">
                <span>{error}</span>
                <button type="button" onClick={() => setError("")} className="ml-3 opacity-60 hover:opacity-100">×</button>
              </div>
            </Alert>
          </div>
        )}

        {/* ── Table map ── */}
        {view === "tables" && (
          <div className="flex-1 overflow-auto p-4">
            {/* Area filter */}
            {areas.length > 0 && (
              <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setAreaFilter(null)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${!areaFilter ? "bg-[var(--color-saffron)]" : "bg-white/10"}`}
                >
                  All areas
                </button>
                {areas.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAreaFilter(a)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${areaFilter === a ? "bg-[var(--color-saffron)]" : "bg-white/10"}`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            )}

            {/* Summary row */}
            <div className="flex gap-4 text-xs text-white/40 mb-3">
              <span>🟢 {filteredTables.filter((t) => !t.occupied).length} free</span>
              <span>🟡 {filteredTables.filter((t) => t.occupied).length} occupied</span>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 gap-3">
              {filteredTables.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { setSelectedTable(t); setView("menu"); }}
                  className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 text-sm font-semibold border-2 transition active:scale-95 ${
                    t.occupied
                      ? "bg-amber-500/20 border-amber-400/50 text-amber-300 hover:bg-amber-500/30"
                      : "bg-emerald-500/10 border-emerald-400/30 text-emerald-300 hover:bg-emerald-500/20"
                  } ${selectedTable?.id === t.id ? "ring-2 ring-[var(--color-saffron)]" : ""}`}
                >
                  <span>{t.name}</span>
                  <span className="text-[10px] font-normal opacity-60">{t.seats} 👤</span>
                  {t.occupied && <span className="text-[9px] text-amber-400">●</span>}
                </button>
              ))}
              <button
                type="button"
                onClick={() => { setSelectedTable(null); setView("menu"); }}
                className="aspect-square rounded-xl flex flex-col items-center justify-center text-sm font-semibold border-2 border-white/20 bg-white/5 hover:bg-white/10 text-white/70 transition active:scale-95"
              >
                <span className="text-xl">📦</span>
                <span className="text-xs mt-0.5">Take-away</span>
              </button>
            </div>
          </div>
        )}

        {/* ── Menu grid ── */}
        {view === "menu" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex gap-2 px-4 py-2 overflow-x-auto border-b border-white/10 shrink-0">
              <button
                type="button"
                onClick={() => setActiveCat(null)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${!activeCat ? "bg-[var(--color-saffron)]" : "bg-white/10 hover:bg-white/15"}`}
              >
                All
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveCat(c.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${activeCat === c.id ? "bg-[var(--color-saffron)]" : "bg-white/10 hover:bg-white/15"}`}
                >
                  {c.name}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-auto p-4 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3 content-start">
              {filteredMenu.map((item) => {
                const inCart = cart.find((l) => l.menuItemId === item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => addToCart(item)}
                    className={`relative flex flex-col items-start p-3 rounded-xl border text-left transition active:scale-95 ${
                      inCart
                        ? "bg-[var(--color-saffron)]/20 border-[var(--color-saffron)]/60"
                        : "bg-white/5 hover:bg-white/10 border-white/10"
                    }`}
                  >
                    {inCart && (
                      <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[var(--color-saffron)] text-white text-[10px] font-bold flex items-center justify-center">
                        {inCart.quantity}
                      </span>
                    )}
                    {item.imagePath && (
                      <img
                        src={`/api/uploads/${item.imagePath}`}
                        alt=""
                        className="w-full aspect-square rounded-lg object-cover mb-2"
                      />
                    )}
                    <span className="text-sm font-medium leading-tight line-clamp-2">{item.name}</span>
                    <span className="text-[var(--color-saffron)] font-bold mt-1 text-sm">{fmt(item.sellPrice)}</span>
                    {/* Allergen chips */}
                    {item.allergens && (
                      <div className="flex flex-wrap gap-0.5 mt-1">
                        {item.allergens.split(",").slice(0, 3).map((a) => (
                          <span key={a} className="text-[9px] px-1 rounded bg-red-500/20 text-red-300">{a.trim()}</span>
                        ))}
                      </div>
                    )}
                    {/* Dietary tags */}
                    {item.dietaryTags && (
                      <div className="flex flex-wrap gap-0.5 mt-0.5">
                        {item.dietaryTags.split(",").slice(0, 2).map((t) => (
                          <span key={t} className="text-[9px] px-1 rounded bg-emerald-500/20 text-emerald-300">{t.trim()}</span>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Cart view ── */}
        {view === "cart" && (
          <div className="flex-1 overflow-auto p-4 space-y-2">
            {/* Order meta */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <label className="block text-xs text-white/50">
                Covers (guests)
                <input
                  type="number"
                  min={1}
                  value={covers}
                  onChange={(e) => setCovers(e.target.value)}
                  placeholder="2"
                  className="mt-1 w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[var(--color-saffron)]"
                />
              </label>
              <label className="block text-xs text-white/50">
                Order note
                <input
                  type="text"
                  value={orderNote}
                  onChange={(e) => setOrderNote(e.target.value)}
                  placeholder="Allergen note, etc."
                  className="mt-1 w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[var(--color-saffron)]"
                />
              </label>
            </div>

            {cart.length === 0 ? (
              <p className="text-white/30 text-center py-12">Cart is empty — add items from Menu</p>
            ) : (
              cart.map((line) => (
                <div key={line.menuItemId} className="flex items-center gap-2 bg-white/5 rounded-xl p-3">
                  <span className="flex-1 min-w-0 font-medium truncate text-sm">{line.itemName}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => adjustQty(line.menuItemId, -1)}
                      className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-sm font-bold"
                    >−</button>
                    <span className="w-6 text-center text-sm font-semibold">{line.quantity}</span>
                    <button
                      type="button"
                      onClick={() => adjustQty(line.menuItemId, 1)}
                      className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-sm font-bold"
                    >+</button>
                  </div>
                  <span className="text-sm font-bold shrink-0 w-16 text-right">
                    {fmt(line.unitPrice * line.quantity)}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ── Right: Order summary + payment ── */}
      <div className="w-72 flex flex-col bg-white/5 border-l border-white/10 shrink-0">
        <div className="px-4 py-3 border-b border-white/10">
          <p className="text-white/50 text-xs uppercase tracking-widest">
            {selectedTable ? selectedTable.name : "Take-away"}
          </p>
          {session && (
            <p className="text-[10px] text-white/30 mt-0.5">
              Shift open {new Date(session.openedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>

        {/* Order lines summary */}
        <div className="flex-1 overflow-auto px-4 py-3 space-y-1.5">
          {cart.map((l) => (
            <div key={l.menuItemId} className="flex justify-between text-sm">
              <span className="text-white/70 truncate flex-1 mr-2">
                {l.quantity > 1 && <span className="text-white/40">{l.quantity}× </span>}
                {l.itemName}
              </span>
              <span className="font-medium shrink-0">{fmt(l.unitPrice * l.quantity)}</span>
            </div>
          ))}
          {cart.length === 0 && (
            <p className="text-white/25 text-xs text-center py-6">No items yet</p>
          )}
        </div>

        <div className="px-4 py-3 border-t border-white/10 space-y-3">
          {/* Totals */}
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-white/50">
              <span>Net</span><span>{fmt(cartTotal - cartVat)}</span>
            </div>
            <div className="flex justify-between text-white/50">
              <span>VAT</span><span>{fmt(cartVat)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span className="text-[var(--color-saffron)]">{fmt(cartTotal)}</span>
            </div>
          </div>

          {/* Cash tendered + change */}
          <label className="block text-xs text-white/50">
            Cash tendered (for change)
            <input
              type="number"
              min={0}
              step={0.01}
              value={tendered}
              onChange={(e) => setTendered(e.target.value)}
              placeholder="e.g. 50.00"
              className="mt-1 w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[var(--color-saffron)]"
            />
          </label>
          {change !== null && tendered !== "" && (
            <div className={`flex justify-between text-sm font-bold rounded-lg px-3 py-2 ${
              change >= 0 ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"
            }`}>
              <span>{change >= 0 ? "Change" : "Short"}</span>
              <span>{fmt(Math.abs(change))}</span>
            </div>
          )}

          {/* NIP field */}
          <label className="block text-xs text-white/50">
            NIP nabywcy (B2B receipt)
            <input
              type="text"
              value={buyerNip}
              onChange={(e) => setBuyerNip(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="10 digits"
              maxLength={10}
              className={`mt-1 w-full bg-white/10 border rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 ${
                nipStatus === "valid"
                  ? "border-emerald-400/50 focus:ring-emerald-400"
                  : nipStatus === "invalid"
                  ? "border-red-400/50 focus:ring-red-400"
                  : "border-white/20 focus:ring-[var(--color-saffron)]"
              }`}
            />
            {nipStatus === "valid" && <span className="text-emerald-400">✓ Valid NIP</span>}
            {nipStatus === "invalid" && <span className="text-red-400">✗ Invalid NIP checksum</span>}
          </label>

          {/* Payment buttons */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => handlePay("CASH")}
              disabled={cart.length === 0 || paying || nipStatus === "invalid"}
              className="!py-4 !text-sm font-bold"
            >
              {paying ? "…" : "💵 Cash"}
            </Button>
            <Button
              onClick={() => handlePay("CARD")}
              disabled={cart.length === 0 || paying || nipStatus === "invalid"}
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
              className="w-full text-xs text-red-400 hover:text-red-300 py-1 transition"
            >
              Clear order
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
