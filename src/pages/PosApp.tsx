import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addLine,
  applyDiscount,
  cancelQrPayment,
  clearDiscount,
  closeSession,
  createOrder,
  getCurrentSession,
  getExchangeRates,
  getOpenOrders,
  getPosMenu,
  getPosTables,
  getQrStatus,
  initiateQrPayment,
  openSession,
  parkOrder,
  payOrder,
  payOrderMulti,
  recordCashMovement,
  resumeOrder,
  searchByBarcode,
  type ExchangeRates,
  type PosMenuItem,
  type PosOrder,
  type PosQrTransaction,
  type PosSession,
  type PosTable,
} from "../api/pos";
import { fmt } from "../lib/calc";
import { Spinner } from "../components/ui/Spinner";
import { Alert } from "../components/ui/Alert";

// ─── Types ────────────────────────────────────────────────────────────────────

type CartLine = {
  menuItemId: string;
  itemName: string;
  unitPrice: number;
  vatRatePct: number;
  quantity: number;
  note?: string;
};

// ─── NIP validation (Polish checksum) ────────────────────────────────────────

function nipValid(nip: string) {
  const d = nip.replace(/\D/g, "");
  if (d.length !== 10) return false;
  const w = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  return w.reduce((s, v, i) => s + v * Number(d[i]), 0) % 11 === Number(d[9]);
}

// ─── Session gate ─────────────────────────────────────────────────────────────

function SessionGate({ onOpen }: { onOpen: (s: PosSession) => void }) {
  const [float_, setFloat] = useState("0");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setBusy(true); setErr("");
    try { onOpen(await openSession(Number(float_) || 0)); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-6">
      <div className="bg-[#1E293B] rounded-2xl p-8 w-full max-w-sm border border-white/5 shadow-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-[#6366F1]/10 rounded-2xl mb-4">
            <svg className="w-7 h-7 text-[#6366F1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Saffron POS</h1>
          <p className="text-[#64748B] text-sm mt-1">Open your shift to begin</p>
        </div>
        {err && <div className="mb-4 px-3 py-2 bg-red-500/10 text-red-400 text-sm rounded-lg">{err}</div>}
        <label className="block mb-4">
          <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Opening cash float (PLN)</span>
          <input type="number" min={0} step={0.01} value={float_}
            onChange={(e) => setFloat(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="mt-2 w-full bg-[#0F172A] border border-white/10 rounded-xl px-4 py-3 text-white text-xl text-center tabular-nums focus:outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1]/30"
          />
        </label>
        <button type="button" onClick={submit} disabled={busy}
          className="w-full bg-[#6366F1] hover:bg-[#5558E8] text-white font-semibold py-3.5 rounded-xl transition disabled:opacity-50 text-sm">
          {busy ? "Opening shift…" : "Open Shift"}
        </button>
      </div>
    </div>
  );
}

// ─── Close session modal ──────────────────────────────────────────────────────

function CloseModal({ session, onClosed, onCancel }: {
  session: PosSession; onClosed: () => void; onCancel: () => void;
}) {
  const [float_, setFloat] = useState("0");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setBusy(true); setErr("");
    try { await closeSession(session.id, Number(float_) || 0); onClosed(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#1E293B] rounded-2xl p-6 w-full max-w-sm border border-white/5 shadow-2xl">
        <h2 className="text-lg font-bold text-white mb-1">Close Shift</h2>
        <p className="text-[#64748B] text-sm mb-5">Opening float: <strong className="text-white">{fmt(session.openingFloat)}</strong></p>
        {err && <div className="mb-4 px-3 py-2 bg-red-500/10 text-red-400 text-sm rounded-lg">{err}</div>}
        <label className="block mb-5">
          <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Closing cash count (PLN)</span>
          <input type="number" min={0} step={0.01} value={float_}
            onChange={(e) => setFloat(e.target.value)}
            className="mt-2 w-full bg-[#0F172A] border border-white/10 rounded-xl px-4 py-3 text-white text-xl text-center tabular-nums focus:outline-none focus:border-[#6366F1]" />
        </label>
        <p className="text-xs text-[#475569] mb-5">POS totals will auto-fill your shift report.</p>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} className="flex-1 py-3 rounded-xl border border-white/10 text-[#94A3B8] text-sm hover:bg-white/5 transition">Cancel</button>
          <button type="button" onClick={submit} disabled={busy}
            className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold text-sm transition disabled:opacity-50">
            {busy ? "Closing…" : "Close Shift"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Generic overlay modal ────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#1E293B] rounded-2xl p-6 w-full max-w-md border border-white/5 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-white">{title}</h2>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-[#94A3B8] flex items-center justify-center transition text-lg leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── POS App ──────────────────────────────────────────────────────────────────

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
  const [mainView, setMainView] = useState<"tables" | "menu">("tables");
  const [buyerNip, setBuyerNip] = useState("");
  const [tendered, setTendered] = useState("");
  const [covers, setCovers] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [tip, setTip] = useState(0);
  const [barcodeBuffer, setBarcodeBuffer] = useState("");

  // Modals
  const [showParkModal, setShowParkModal] = useState(false);
  const [parkNote, setParkNote] = useState("");
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashType, setCashType] = useState<"IN" | "OUT">("OUT");
  const [cashAmount, setCashAmount] = useState("");
  const [cashReason, setCashReason] = useState("OTHER");
  const [cashNote, setCashNote] = useState("");
  const [cashBusy, setCashBusy] = useState(false);
  const [showDiscountDrawer, setShowDiscountDrawer] = useState(false);
  const [discountType, setDiscountType] = useState<"ITEM" | "ORDER">("ORDER");
  const [discountValue, setDiscountValue] = useState("");
  const [discountIsPct, setDiscountIsPct] = useState(true);
  const [discountLineId, setDiscountLineId] = useState<string | null>(null);
  const [discountBusy, setDiscountBusy] = useState(false);
  const [orderType, setOrderType] = useState<"DINE_IN" | "TAKEAWAY" | "DELIVERY">("DINE_IN");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [qrTx, setQrTx] = useState<PosQrTransaction | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrBusy, setQrBusy] = useState(false);
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState("PLN");
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payLegs, setPayLegs] = useState<Array<{ method: string; amount: string }>>([{ method: "CASH", amount: "" }]);
  const [payBusy, setPayBusy] = useState(false);
  const [showOpenBills, setShowOpenBills] = useState(false);
  const [openOrders, setOpenOrders] = useState<PosOrder[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [m, t] = await Promise.all([getPosMenu(), getPosTables()]);
      setMenu(m); setTables(t);
    } catch (e) { setError(e instanceof Error ? e.message : "Load failed"); }
  }, []);

  useEffect(() => {
    getCurrentSession().then(setSession).catch(() => setSession(null));
    loadData().finally(() => setLoading(false));
    getExchangeRates().then(setRates).catch(() => {});
    const timer = setInterval(() => getPosTables().then(setTables).catch(() => {}), 30_000);
    return () => clearInterval(timer);
  }, [loadData]);

  // Barcode
  useEffect(() => {
    if (mainView !== "menu") return;
    const onKey = async (e: KeyboardEvent) => {
      if (e.key === "Enter" && barcodeBuffer.length >= 3) {
        const code = barcodeBuffer; setBarcodeBuffer("");
        const item = await searchByBarcode(code);
        if (item) { addToCart(item); setError(""); }
        else setError(`Barcode not found: ${code}`);
      } else if (e.key.length === 1) setBarcodeBuffer(p => p + e.key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mainView, barcodeBuffer]);
  useEffect(() => { if (mainView !== "menu") setBarcodeBuffer(""); }, [mainView]);

  // Derived
  const categories = useMemo(() => {
    const seen = new Map<string, { name: string; sortOrder: number }>();
    menu.forEach(i => { if (!seen.has(i.categoryId)) seen.set(i.categoryId, { name: i.categoryName, sortOrder: i.categorySortOrder }); });
    return [...seen.entries()].sort((a, b) => a[1].sortOrder - b[1].sortOrder).map(([id, { name }]) => ({ id, name }));
  }, [menu]);

  const filteredMenu = useMemo(() => activeCat ? menu.filter(i => i.categoryId === activeCat) : menu, [menu, activeCat]);
  const areas = useMemo(() => { const s = new Set<string>(); tables.forEach(t => { if (t.area) s.add(t.area); }); return [...s].sort(); }, [tables]);
  const filteredTables = areaFilter ? tables.filter(t => t.area === areaFilter) : tables;

  const cartTotal = cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const cartVat = cart.reduce((s, l) => { const g = l.unitPrice * l.quantity; return s + g - g / (1 + l.vatRatePct / 100); }, 0);
  const paymentTotal = cartTotal + tip;
  const change = tendered ? Number(tendered) - paymentTotal : null;
  const nipStatus = buyerNip.length === 0 ? "empty" : nipValid(buyerNip) ? "valid" : "invalid";
  const legTotal = payLegs.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const legRemaining = paymentTotal - legTotal;
  const cartCount = cart.reduce((s, l) => s + l.quantity, 0);

  // Handlers
  const loadOpenOrders = useCallback(async () => { try { setOpenOrders(await getOpenOrders()); } catch {} }, []);
  useEffect(() => { if (showOpenBills) loadOpenOrders(); }, [showOpenBills, loadOpenOrders]);

  const adjustQty = (menuItemId: string, delta: number) => {
    setCart(p => p.map(l => l.menuItemId === menuItemId ? { ...l, quantity: l.quantity + delta } : l).filter(l => l.quantity > 0));
  };

  const addToCart = (item: PosMenuItem) => {
    setCart(p => {
      const ex = p.find(l => l.menuItemId === item.id);
      if (ex) return p.map(l => l.menuItemId === item.id ? { ...l, quantity: l.quantity + 1 } : l);
      return [...p, { menuItemId: item.id, itemName: item.name, unitPrice: item.sellPrice, vatRatePct: item.vatRatePct, quantity: 1 }];
    });
    setMainView("menu");
  };

  const handlePark = async () => {
    if (!activeOrder) return;
    try {
      await parkOrder(activeOrder.id, parkNote.trim() || undefined);
      setActiveOrder(null); setCart([]); setSelectedTable(null);
      setParkNote(""); setShowParkModal(false); setMainView("tables");
      setTables(await getPosTables());
    } catch (e) { setError(e instanceof Error ? e.message : "Park failed"); setShowParkModal(false); }
  };

  const handleCashMovement = async () => {
    if (!session || session === "loading" || !cashAmount) return;
    setCashBusy(true);
    try {
      await recordCashMovement({ sessionId: session.id, type: cashType, reason: cashReason, amount: Number(cashAmount), note: cashNote.trim() || undefined });
      setCashAmount(""); setCashNote(""); setShowCashModal(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setCashBusy(false); }
  };

  const handleApplyDiscount = async () => {
    if (!activeOrder || !discountValue) return;
    setDiscountBusy(true);
    try {
      setActiveOrder(await applyDiscount(activeOrder.id, { type: discountType, lineId: discountType === "ITEM" ? (discountLineId ?? undefined) : undefined, value: Number(discountValue), isPercentage: discountIsPct }));
      setShowDiscountDrawer(false); setDiscountValue("");
    } catch (e) { setError(e instanceof Error ? e.message : "Discount failed"); }
    finally { setDiscountBusy(false); }
  };

  const handleClearDiscount = useCallback(async () => {
    if (!activeOrder) return;
    try { setActiveOrder(await clearDiscount(activeOrder.id)); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }, [activeOrder]);

  const handlePay = async (method: "CASH" | "CARD") => {
    if (nipStatus === "invalid") { setError("Invalid NIP checksum"); return; }
    setPaying(true); setError("");
    try {
      let order = activeOrder;
      if (!order) {
        order = await createOrder({ tableId: selectedTable?.id, orderType, customerName: customerName.trim() || undefined, customerPhone: customerPhone.trim() || undefined, deliveryAddress: deliveryAddress.trim() || undefined, specialRequests: specialRequests.trim() || undefined, covers: covers ? Number(covers) : undefined, orderNote: orderNote.trim() || undefined, lines: cart.map(l => ({ menuItemId: l.menuItemId, quantity: l.quantity })) });
      } else {
        for (const l of cart) order = await addLine(order.id, { menuItemId: l.menuItemId, quantity: l.quantity });
      }
      setActiveOrder(await payOrder(order.id, { paymentMethod: method, amountTendered: tendered ? Number(tendered) : undefined, tipAmount: tip > 0 ? tip : undefined, buyerNip: buyerNip.trim() || undefined }));
      setCart([]); setBuyerNip(""); setTendered(""); setTip(0);
      setMainView("tables"); setTables(await getPosTables());
    } catch (e) { setError(e instanceof Error ? e.message : "Payment failed"); }
    finally { setPaying(false); }
  };

  const handlePayMulti = async () => {
    if (nipStatus === "invalid") { setError("Invalid NIP"); return; }
    setPayBusy(true); setError("");
    try {
      let order = activeOrder;
      if (!order) {
        order = await createOrder({ tableId: selectedTable?.id, orderType, customerName: customerName.trim() || undefined, customerPhone: customerPhone.trim() || undefined, deliveryAddress: deliveryAddress.trim() || undefined, specialRequests: specialRequests.trim() || undefined, covers: covers ? Number(covers) : undefined, orderNote: orderNote.trim() || undefined, lines: cart.map(l => ({ menuItemId: l.menuItemId, quantity: l.quantity })) });
      }
      setActiveOrder(await payOrderMulti(order.id, { payments: payLegs.map(l => ({ method: l.method, amount: Number(l.amount) })), tipAmount: tip > 0 ? tip : undefined, buyerNip: buyerNip.trim() || undefined }));
      setCart([]); setBuyerNip(""); setTendered(""); setTip(0);
      setPayLegs([{ method: "CASH", amount: "" }]); setShowPayModal(false);
      setMainView("tables"); setTables(await getPosTables());
    } catch (e) { setError(e instanceof Error ? e.message : "Payment failed"); }
    finally { setPayBusy(false); }
  };

  const handleInitiateQr = async () => {
    if (!activeOrder) return;
    setQrBusy(true);
    try {
      const tx = await initiateQrPayment(activeOrder.id, selectedCurrency);
      setQrTx(tx); setShowQrModal(true);
      const poll = setInterval(async () => {
        try {
          const u = await getQrStatus(tx.id); setQrTx(u);
          if (u.status === "CONFIRMED") {
            clearInterval(poll); setShowQrModal(false); setCart([]); setTip(0);
            setMainView("tables"); setTables(await getPosTables());
          } else if (u.status !== "PENDING") clearInterval(poll);
        } catch { clearInterval(poll); }
      }, 3000);
    } catch (e) { setError(e instanceof Error ? e.message : "QR failed"); }
    finally { setQrBusy(false); }
  };

  // ── Session gate ──────────────────────────────────────────────────────────
  if (session === "loading" || loading) {
    return <div className="flex items-center justify-center min-h-screen bg-[#0F172A]"><Spinner label="Loading POS…" /></div>;
  }
  if (!session) return <SessionGate onOpen={setSession} />;

  const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // ── Main UI ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-[#0F172A] text-white overflow-hidden select-none">

      {/* ── Modals ── */}
      {showCloseModal && <CloseModal session={session} onClosed={() => { setSession(null); setShowCloseModal(false); setCart([]); }} onCancel={() => setShowCloseModal(false)} />}

      {showParkModal && (
        <Modal title="Park Bill" onClose={() => setShowParkModal(false)}>
          <label className="block mb-4 text-sm text-[#94A3B8]">Note (optional)
            <input type="text" value={parkNote} onChange={e => setParkNote(e.target.value)} autoFocus placeholder="e.g. Waiting for dessert"
              className="mt-1.5 w-full bg-[#0F172A] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#6366F1]" />
          </label>
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowParkModal(false)} className="flex-1 py-2.5 rounded-lg border border-white/10 text-[#94A3B8] text-sm hover:bg-white/5">Cancel</button>
            <button type="button" onClick={handlePark} className="flex-1 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm">Park Bill</button>
          </div>
        </Modal>
      )}

      {showCashModal && (
        <Modal title="Cash Drawer" onClose={() => setShowCashModal(false)}>
          <div className="flex gap-2 mb-4">
            {(["OUT", "IN"] as const).map(t => (
              <button key={t} type="button" onClick={() => setCashType(t)}
                className={`flex-1 py-2.5 rounded-lg font-semibold text-sm border transition ${cashType === t ? (t === "OUT" ? "bg-red-500/20 border-red-500/50 text-red-300" : "bg-emerald-500/20 border-emerald-500/50 text-emerald-300") : "border-white/10 text-[#64748B] hover:bg-white/5"}`}>
                {t === "OUT" ? "− Withdrawal" : "+ Deposit"}
              </button>
            ))}
          </div>
          <label className="block mb-3 text-sm text-[#94A3B8]">Amount (PLN)
            <input type="number" min={0.01} step={0.01} value={cashAmount} onChange={e => setCashAmount(e.target.value)} autoFocus
              className="mt-1.5 w-full bg-[#0F172A] border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#6366F1]" />
          </label>
          <label className="block mb-3 text-sm text-[#94A3B8]">Reason
            <select value={cashReason} onChange={e => setCashReason(e.target.value)}
              className="mt-1.5 w-full bg-[#0F172A] border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none">
              <option value="BANK_DEPOSIT">Bank deposit</option>
              <option value="SUPPLIER_PAYMENT">Supplier payment</option>
              <option value="PETTY_CASH">Petty cash</option>
              <option value="CHANGE_FUND">Change fund</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
          <label className="block mb-5 text-sm text-[#94A3B8]">Note (optional)
            <input type="text" value={cashNote} onChange={e => setCashNote(e.target.value)} placeholder="Invoice ref, etc."
              className="mt-1.5 w-full bg-[#0F172A] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#6366F1]" />
          </label>
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowCashModal(false)} className="flex-1 py-2.5 rounded-lg border border-white/10 text-[#94A3B8] text-sm hover:bg-white/5">Cancel</button>
            <button type="button" onClick={handleCashMovement} disabled={!cashAmount || cashBusy}
              className="flex-1 py-2.5 rounded-lg bg-[#6366F1] hover:bg-[#5558E8] text-white font-semibold text-sm disabled:opacity-40">
              {cashBusy ? "Saving…" : "Confirm"}
            </button>
          </div>
        </Modal>
      )}

      {showDiscountDrawer && (
        <Modal title="Apply Discount" onClose={() => setShowDiscountDrawer(false)}>
          <div className="flex gap-2 mb-4">
            {(["ORDER", "ITEM"] as const).map(t => (
              <button key={t} type="button" onClick={() => setDiscountType(t)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition ${discountType === t ? "bg-[#6366F1] border-[#6366F1] text-white" : "border-white/10 text-[#64748B] hover:bg-white/5"}`}>
                {t === "ORDER" ? "Whole order" : "One item"}
              </button>
            ))}
          </div>
          {discountType === "ITEM" && activeOrder && (
            <div className="mb-4 space-y-1.5 max-h-36 overflow-auto">
              {activeOrder.lines.map(l => (
                <button key={l.id} type="button" onClick={() => setDiscountLineId(l.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition ${discountLineId === l.id ? "border-[#6366F1] bg-[#6366F1]/10 text-white" : "border-white/10 text-[#94A3B8] hover:bg-white/5"}`}>
                  {l.quantity}× {l.itemName} — {fmt(l.lineGross ?? l.unitPrice * l.quantity)}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2 mb-4">
            {([true, false] as const).map(p => (
              <button key={String(p)} type="button" onClick={() => setDiscountIsPct(p)}
                className={`flex-1 py-2 rounded-lg text-sm border transition ${discountIsPct === p ? "bg-white/15 border-white/30 text-white" : "border-white/10 text-[#64748B] hover:bg-white/5"}`}>
                {p ? "Percent %" : "Fixed PLN"}
              </button>
            ))}
          </div>
          <label className="block mb-2 text-sm text-[#94A3B8]">
            {discountIsPct ? "Discount %" : "Discount (PLN)"}
            <input type="number" min={0} max={discountIsPct ? 100 : undefined} step={discountIsPct ? 1 : 0.01} value={discountValue}
              onChange={e => setDiscountValue(e.target.value)} autoFocus
              className="mt-1.5 w-full bg-[#0F172A] border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#6366F1]" />
          </label>
          {discountValue && <p className="text-[#10B981] text-sm mb-4">Saving: {fmt(discountIsPct ? cartTotal * Number(discountValue) / 100 : Number(discountValue))}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowDiscountDrawer(false)} className="flex-1 py-2.5 rounded-lg border border-white/10 text-[#94A3B8] text-sm">Cancel</button>
            <button type="button" onClick={() => { handleClearDiscount(); setShowDiscountDrawer(false); }} className="px-4 py-2.5 rounded-lg border border-red-500/30 text-red-400 text-sm hover:bg-red-500/10">Clear</button>
            <button type="button" onClick={handleApplyDiscount} disabled={!discountValue || discountBusy || (discountType === "ITEM" && !discountLineId)}
              className="flex-1 py-2.5 rounded-lg bg-[#6366F1] text-white font-semibold text-sm disabled:opacity-40">
              {discountBusy ? "…" : "Apply"}
            </button>
          </div>
        </Modal>
      )}

      {showOrderForm && (
        <Modal title="Order Details" onClose={() => setShowOrderForm(false)}>
          <div className="flex gap-2 mb-4">
            {(["DINE_IN", "TAKEAWAY", "DELIVERY"] as const).map(t => (
              <button key={t} type="button" onClick={() => setOrderType(t)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition ${orderType === t ? "bg-[#6366F1] border-[#6366F1] text-white" : "border-white/10 text-[#64748B] hover:bg-white/5"}`}>
                {t === "DINE_IN" ? "Dine-in" : t === "TAKEAWAY" ? "Takeaway" : "Delivery"}
              </button>
            ))}
          </div>
          {[["Customer name", customerName, setCustomerName, "Jan Kowalski"], ["Phone", customerPhone, setCustomerPhone, "+48 500 123 456"]].map(([label, value, setter, placeholder]) => (
            <label key={label as string} className="block mb-3 text-sm text-[#94A3B8]">{label as string}
              <input type="text" value={value as string} onChange={e => (setter as React.Dispatch<React.SetStateAction<string>>)(e.target.value)} placeholder={placeholder as string}
                className="mt-1.5 w-full bg-[#0F172A] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#6366F1]" />
            </label>
          ))}
          {orderType === "DELIVERY" && (
            <label className="block mb-3 text-sm text-[#94A3B8]">Delivery address *
              <input type="text" value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} placeholder="ul. Marszałkowska 1, Warszawa"
                className="mt-1.5 w-full bg-[#0F172A] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#6366F1]" />
            </label>
          )}
          <label className="block mb-5 text-sm text-[#94A3B8]">Special requests
            <textarea value={specialRequests} onChange={e => setSpecialRequests(e.target.value)} placeholder="Allergens, no onion…" rows={2}
              className="mt-1.5 w-full bg-[#0F172A] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none resize-none focus:border-[#6366F1]" />
          </label>
          <button type="button" onClick={() => setShowOrderForm(false)} className="w-full py-2.5 rounded-lg bg-[#6366F1] text-white font-semibold text-sm">Save</button>
        </Modal>
      )}

      {showQrModal && qrTx && (
        <Modal title="BLIK / QR Payment" onClose={() => setShowQrModal(false)}>
          <div className="text-center space-y-4">
            <div className="bg-white rounded-xl p-5 mx-auto w-36 h-36 flex items-center justify-center">
              <p className="text-[#0F172A] text-[10px] font-mono break-all">{qrTx.id.slice(0, 16)}</p>
            </div>
            <p className="text-2xl font-bold tabular-nums">{fmt(qrTx.amount)}</p>
            <p className={`text-sm font-semibold ${qrTx.status === "CONFIRMED" ? "text-[#10B981]" : qrTx.status === "EXPIRED" ? "text-red-400" : "text-amber-400"}`}>
              {qrTx.status === "PENDING" ? "⏳ Waiting for payment…" : qrTx.status === "CONFIRMED" ? "✓ Payment confirmed!" : qrTx.status}
            </p>
            <button type="button" onClick={async () => { if (qrTx) await cancelQrPayment(qrTx.id).catch(() => {}); setShowQrModal(false); setQrTx(null); }}
              className="text-xs text-[#64748B] hover:text-red-400">Cancel payment</button>
          </div>
        </Modal>
      )}

      {showCurrencyPicker && rates && (
        <Modal title="Select Currency" onClose={() => setShowCurrencyPicker(false)}>
          <div className="space-y-2">
            {["PLN", "EUR", "USD", "GBP"].map(c => {
              const rate = rates.rates[c] ?? 1;
              const conv = c === "PLN" ? paymentTotal : paymentTotal / rate;
              return (
                <button key={c} type="button" onClick={() => { setSelectedCurrency(c); setShowCurrencyPicker(false); }}
                  className={`w-full flex justify-between items-center px-4 py-3 rounded-xl border transition ${selectedCurrency === c ? "border-[#6366F1] bg-[#6366F1]/10" : "border-white/10 bg-white/3 hover:bg-white/5"}`}>
                  <span className="font-bold text-white">{c}</span>
                  <div className="text-right">
                    <p className="font-bold text-white tabular-nums">{conv.toFixed(2)} {c}</p>
                    {c !== "PLN" && <p className="text-[10px] text-[#475569]">1 {c} = {rate.toFixed(4)} PLN</p>}
                  </div>
                </button>
              );
            })}
          </div>
        </Modal>
      )}

      {showPayModal && (
        <Modal title="Payment Methods" onClose={() => setShowPayModal(false)}>
          <div className="flex justify-between text-sm mb-4">
            <span className="text-[#94A3B8]">Total to pay</span>
            <span className="font-bold text-[#6366F1]">{fmt(paymentTotal)}</span>
          </div>
          <div className="space-y-2 mb-3">
            {payLegs.map((leg, i) => (
              <div key={i} className="flex gap-2">
                <select value={leg.method} onChange={e => setPayLegs(p => p.map((l, j) => j === i ? { ...l, method: e.target.value } : l))}
                  className="bg-[#0F172A] border border-white/10 rounded-lg px-2 py-2 text-sm text-white flex-shrink-0 focus:outline-none">
                  {["CASH", "CARD", "VOUCHER", "BANK_TRANSFER", "OTHER"].map(m => <option key={m}>{m}</option>)}
                </select>
                <input type="number" min={0} step={0.01} placeholder="Amount" value={leg.amount}
                  onChange={e => setPayLegs(p => p.map((l, j) => j === i ? { ...l, amount: e.target.value } : l))}
                  className="flex-1 bg-[#0F172A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#6366F1]" />
                {payLegs.length > 1 && <button type="button" onClick={() => setPayLegs(p => p.filter((_, j) => j !== i))} className="text-[#475569] hover:text-red-400 px-2">×</button>}
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setPayLegs(p => [...p, { method: "CARD", amount: legRemaining > 0 ? String(Math.round(legRemaining * 100) / 100) : "" }])}
            className="text-xs text-[#6366F1] hover:underline mb-4 block">+ Add another method</button>
          <div className={`flex justify-between text-sm font-semibold rounded-lg px-3 py-2.5 mb-4 ${legRemaining <= 0.005 ? "bg-[#10B981]/10 text-[#10B981]" : "bg-amber-500/10 text-amber-400"}`}>
            <span>{legRemaining <= 0.005 ? "✓ Fully covered" : "Remaining"}</span>
            <span>{legRemaining > 0.005 ? fmt(legRemaining) : "0.00"}</span>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowPayModal(false)} className="flex-1 py-2.5 rounded-lg border border-white/10 text-[#94A3B8] text-sm">Cancel</button>
            <button type="button" onClick={handlePayMulti} disabled={legRemaining > 0.005 || payBusy || cart.length === 0}
              className="flex-1 py-2.5 rounded-lg bg-[#6366F1] text-white font-semibold text-sm disabled:opacity-40">
              {payBusy ? "Processing…" : "Confirm Payment"}
            </button>
          </div>
        </Modal>
      )}

      {showOpenBills && (
        <div className="fixed inset-y-0 left-0 z-50 w-80 bg-[#1E293B] border-r border-white/5 flex flex-col shadow-2xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <h3 className="font-bold text-white">Open Bills ({openOrders.length})</h3>
            <button type="button" onClick={() => setShowOpenBills(false)} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-[#94A3B8] flex items-center justify-center">×</button>
          </div>
          <div className="flex-1 overflow-auto">
            {openOrders.length === 0
              ? <p className="text-[#475569] text-sm text-center py-10">No open bills</p>
              : openOrders.map(o => {
                const tbl = tables.find(t => t.id === o.tableId);
                const age = Math.round((Date.now() - new Date(o.openedAt).getTime()) / 60000);
                return (
                  <button key={o.id} type="button" onClick={async () => {
                    if (o.status === "PARKED") await resumeOrder(o.id).catch(() => {});
                    setSelectedTable(tbl ?? null); setMainView("menu"); setShowOpenBills(false);
                  }} className="w-full text-left px-5 py-3.5 hover:bg-white/3 border-b border-white/5 transition">
                    <div className="flex justify-between mb-1">
                      <span className="font-semibold text-sm text-white">{tbl?.name ?? "Take-away"}</span>
                      <span className="text-xs text-[#475569]">{age}m ago</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-[#64748B]">{o.lines.length} items · <span className={o.status === "PARKED" ? "text-amber-400" : "text-emerald-400"}>{o.status}</span></span>
                      <span className="text-sm font-bold text-[#6366F1]">{fmt(o.totalGross)}</span>
                    </div>
                  </button>
                );
              })}
          </div>
          <div className="px-5 py-3 border-t border-white/5">
            <button onClick={loadOpenOrders} className="w-full py-2 text-xs text-[#64748B] hover:text-[#94A3B8] rounded-lg hover:bg-white/5 transition">Refresh</button>
          </div>
        </div>
      )}

      {/* ── Top bar ── */}
      <header className="flex items-center gap-3 px-4 h-14 bg-[#1E293B] border-b border-white/5 shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mr-4">
          <div className="w-7 h-7 bg-[#6366F1] rounded-lg flex items-center justify-center text-xs font-black">S</div>
          <span className="font-bold text-sm tracking-tight hidden sm:block">Saffron POS</span>
        </div>

        {/* Table / order type badge */}
        <div className="flex items-center gap-2">
          {selectedTable
            ? <span className="px-3 py-1 bg-[#6366F1]/15 text-[#818CF8] rounded-full text-xs font-semibold border border-[#6366F1]/20">{selectedTable.name}</span>
            : mainView === "menu" ? <span className="px-3 py-1 bg-white/5 text-[#64748B] rounded-full text-xs">Take-away</span> : null}
          <button type="button" onClick={() => setShowOrderForm(true)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${orderType !== "DINE_IN" ? "bg-blue-500/15 text-blue-300 border-blue-500/20" : "bg-white/5 text-[#64748B] border-white/10 hover:bg-white/8"}`}>
            {orderType === "DELIVERY" ? "🛵 Delivery" : orderType === "TAKEAWAY" ? "📦 Takeaway" : "Dine-in"}
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 px-3 py-1 bg-red-500/10 text-red-400 text-xs rounded-full border border-red-500/20 max-w-xs truncate">
            <span className="truncate">{error}</span>
            <button type="button" onClick={() => setError("")} className="shrink-0 hover:text-red-300">×</button>
          </div>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-xs text-[#475569] tabular-nums mr-2 hidden md:block">{timeStr}</span>

          <button type="button" onClick={() => setShowOpenBills(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/8 text-[#94A3B8] hover:text-white text-xs transition">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            <span className="hidden sm:block">Bills</span>
            {openOrders.length > 0 && <span className="bg-[#6366F1] text-white text-[10px] font-bold px-1.5 rounded-full">{openOrders.length}</span>}
          </button>

          {cart.length > 0 && activeOrder && (
            <button type="button" onClick={() => setShowDiscountDrawer(true)}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/8 text-[#94A3B8] hover:text-white text-xs transition hidden sm:block">
              % Disc
            </button>
          )}
          {cart.length > 0 && activeOrder && (
            <button type="button" onClick={() => setShowParkModal(true)}
              className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-medium transition">
              Park
            </button>
          )}

          <button type="button" onClick={() => setShowCashModal(true)}
            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/8 text-[#94A3B8] hover:text-white text-xs transition">
            Cash
          </button>

          <div className="w-px h-5 bg-white/10 mx-1" />

          <button type="button" onClick={() => window.open("/pos/display", "_blank")} title="Customer display"
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/8 text-[#64748B] hover:text-[#94A3B8] flex items-center justify-center transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" /></svg>
          </button>
          <button type="button" onClick={() => window.open("/pos/waiter", "_blank")} title="Waiter app"
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/8 text-[#64748B] hover:text-[#94A3B8] flex items-center justify-center transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" /></svg>
          </button>
          <button type="button" onClick={() => { window.location.href = "/"; }}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/8 text-[#64748B] hover:text-[#94A3B8] flex items-center justify-center transition" title="Back to admin">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></svg>
          </button>
          <button type="button" onClick={() => setShowCloseModal(true)}
            className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium transition ml-1">
            Close
          </button>
        </div>
      </header>

      {/* ── 3-column body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left: Category sidebar ── */}
        <aside className="w-52 bg-[#1E293B] border-r border-white/5 flex flex-col overflow-hidden shrink-0">
          {/* View toggle */}
          <div className="px-3 py-3 border-b border-white/5">
            <div className="flex rounded-lg overflow-hidden bg-[#0F172A] p-0.5">
              <button type="button" onClick={() => setMainView("tables")}
                className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition ${mainView === "tables" ? "bg-[#1E293B] text-white shadow" : "text-[#475569] hover:text-[#94A3B8]"}`}>
                Tables
              </button>
              <button type="button" onClick={() => setMainView("menu")}
                className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition ${mainView === "menu" ? "bg-[#1E293B] text-white shadow" : "text-[#475569] hover:text-[#94A3B8]"}`}>
                Menu
              </button>
            </div>
          </div>

          {/* Categories */}
          {mainView === "menu" && (
            <nav className="flex-1 overflow-auto py-2 space-y-0.5 px-2">
              <button type="button" onClick={() => setActiveCat(null)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition ${!activeCat ? "bg-[#6366F1] text-white" : "text-[#64748B] hover:bg-white/5 hover:text-[#94A3B8]"}`}>
                <span className="text-base">☰</span>
                <span>All items</span>
                <span className={`ml-auto text-xs tabular-nums ${!activeCat ? "text-white/60" : "text-[#334155]"}`}>{menu.length}</span>
              </button>
              {categories.map(c => {
                const count = menu.filter(i => i.categoryId === c.id).length;
                const active = activeCat === c.id;
                return (
                  <button key={c.id} type="button" onClick={() => setActiveCat(c.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition ${active ? "bg-[#6366F1] text-white" : "text-[#64748B] hover:bg-white/5 hover:text-[#94A3B8]"}`}>
                    <span className="truncate">{c.name}</span>
                    <span className={`ml-auto text-xs tabular-nums shrink-0 ${active ? "text-white/60" : "text-[#334155]"}`}>{count}</span>
                  </button>
                );
              })}
            </nav>
          )}

          {/* Area filter for tables */}
          {mainView === "tables" && areas.length > 0 && (
            <nav className="flex-1 overflow-auto py-2 space-y-0.5 px-2">
              <button type="button" onClick={() => setAreaFilter(null)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition ${!areaFilter ? "bg-[#6366F1] text-white" : "text-[#64748B] hover:bg-white/5 hover:text-[#94A3B8]"}`}>
                All areas
              </button>
              {areas.map(a => (
                <button key={a} type="button" onClick={() => setAreaFilter(a)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition ${areaFilter === a ? "bg-[#6366F1] text-white" : "text-[#64748B] hover:bg-white/5 hover:text-[#94A3B8]"}`}>
                  {a}
                </button>
              ))}
            </nav>
          )}

          {/* Session info */}
          <div className="px-3 py-3 border-t border-white/5">
            <p className="text-[10px] text-[#334155] truncate">
              Since {new Date(session.openedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </aside>

        {/* ── Center: Tables / Menu grid ── */}
        <main className="flex-1 overflow-auto bg-[#0F172A]">

          {/* Tables view */}
          {mainView === "tables" && (
            <div className="p-5">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="font-bold text-white">Floor Plan</h2>
                  <p className="text-xs text-[#475569] mt-0.5">
                    {filteredTables.filter(t => !t.occupied).length} free · {filteredTables.filter(t => t.occupied).length} occupied
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
                {filteredTables.map(t => (
                  <button key={t.id} type="button"
                    onClick={async () => {
                      setSelectedTable(t);
                      if (t.occupied && t.openOrderId) {
                        try {
                          const resumed = await resumeOrder(t.openOrderId);
                          setActiveOrder(resumed);
                          setCart(resumed.lines.map(l => ({ menuItemId: l.menuItemId ?? l.id, itemName: l.itemName, unitPrice: l.unitPrice, vatRatePct: l.vatRatePct, quantity: l.quantity })));
                        } catch {}
                      }
                      setMainView("menu");
                    }}
                    className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-1 text-sm font-semibold border transition active:scale-95 ${
                      t.occupied
                        ? "bg-amber-500/8 border-amber-500/20 text-amber-400 hover:bg-amber-500/15"
                        : "bg-[#1E293B] border-white/5 text-[#94A3B8] hover:bg-[#263244] hover:text-white hover:border-white/10"
                    } ${selectedTable?.id === t.id ? "ring-2 ring-[#6366F1] ring-offset-2 ring-offset-[#0F172A]" : ""}`}>
                    <span className="text-base">{t.name}</span>
                    <span className="text-[10px] font-normal opacity-50">{t.seats} seats</span>
                    {t.occupied && <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                  </button>
                ))}
                <button type="button" onClick={() => { setSelectedTable(null); setMainView("menu"); }}
                  className="aspect-square rounded-xl flex flex-col items-center justify-center gap-1 bg-[#1E293B] border border-dashed border-white/10 text-[#475569] hover:text-[#64748B] hover:bg-[#263244] transition active:scale-95">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
                  <span className="text-[10px] font-medium">Take-away</span>
                </button>
              </div>
            </div>
          )}

          {/* Menu grid */}
          {mainView === "menu" && (
            <div className="p-4">
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {filteredMenu.map(item => {
                  const inCart = cart.find(l => l.menuItemId === item.id);
                  return (
                    <button key={item.id} type="button" onClick={() => addToCart(item)}
                      className={`relative flex flex-col rounded-xl overflow-hidden border text-left transition active:scale-95 group ${
                        inCart
                          ? "border-[#6366F1]/40 bg-[#6366F1]/5 ring-1 ring-[#6366F1]/20"
                          : "border-white/5 bg-[#1E293B] hover:border-white/10 hover:bg-[#263244]"
                      }`}>
                      {/* In-cart badge */}
                      {inCart && (
                        <div className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-[#6366F1] text-white text-xs font-bold flex items-center justify-center shadow-lg">
                          {inCart.quantity}
                        </div>
                      )}
                      {/* Image */}
                      {item.imagePath
                        ? <img src={`/api/uploads/${item.imagePath}`} alt="" className="w-full aspect-[4/3] object-cover" />
                        : (
                          <div className="w-full aspect-[4/3] bg-[#0F172A] flex items-center justify-center">
                            <svg className="w-8 h-8 text-[#334155]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.87c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513m-3-4.87v-1.5m-6 1.5v-1.5m12 9.75l-1.5.75a3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0L3 16.5m15-3.38a48.474 48.474 0 00-6-.37c-2.032 0-4.034.125-6 .37m12 0c.39.049.777.102 1.163.16 1.07.16 1.837 1.049 1.837 2.13v1.96c0 .445-.168.87-.47 1.192l-1.04 1.04a2.25 2.25 0 01-3.182 0L9 17.13a2.25 2.25 0 01-.659-1.591v-1.96c0-1.08.768-1.97 1.837-2.13A48.4 48.4 0 0112 11.5c.656 0 1.305.02 1.944.058" /></svg>
                          </div>
                        )
                      }
                      {/* Info */}
                      <div className="p-2.5 flex flex-col gap-0.5">
                        <p className="text-xs font-semibold text-white line-clamp-2 leading-tight">{item.name}</p>
                        {/* Happy hour */}
                        {item.isHappyHour && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full w-fit">
                            ⚡ {item.happyHourName ?? "Happy Hour"}
                          </span>
                        )}
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                          <span className="text-sm font-bold text-[#6366F1]">{fmt(item.sellPrice)}</span>
                          {item.isHappyHour && item.originalPrice && item.originalPrice !== item.sellPrice && (
                            <span className="text-[10px] text-[#334155] line-through">{fmt(item.originalPrice)}</span>
                          )}
                        </div>
                        {/* Allergens */}
                        {item.allergens && (
                          <p className="text-[9px] text-red-400/70 truncate">{item.allergens}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </main>

        {/* ── Right: Order panel ── */}
        <aside className="w-80 xl:w-96 bg-[#1E293B] border-l border-white/5 flex flex-col shrink-0">

          {/* Order header */}
          <div className="px-5 py-4 border-b border-white/5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-white text-sm">{selectedTable ? selectedTable.name : "Take-away"}</p>
                <p className="text-[#475569] text-xs mt-0.5">
                  {covers ? `${covers} covers · ` : ""}{orderType !== "DINE_IN" ? orderType.replace("_", " ") : "Current order"}
                </p>
              </div>
              {cartCount > 0 && (
                <span className="bg-[#6366F1]/15 text-[#818CF8] text-xs font-semibold px-2.5 py-1 rounded-full">{cartCount} items</span>
              )}
            </div>
          </div>

          {/* Order lines */}
          <div className="flex-1 overflow-auto px-4 py-3">
            {cart.length === 0
              ? (
                <div className="flex flex-col items-center justify-center h-full text-center pb-10">
                  <div className="w-14 h-14 rounded-2xl bg-[#263244] flex items-center justify-center mb-3">
                    <svg className="w-7 h-7 text-[#334155]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" /></svg>
                  </div>
                  <p className="text-[#334155] text-sm font-medium">No items yet</p>
                  <p className="text-[#263244] text-xs mt-1">Add items from the menu</p>
                </div>
              )
              : (
                <div className="space-y-1">
                  {cart.map(line => (
                    <div key={line.menuItemId} className="flex items-center gap-3 py-2.5 border-b border-white/3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{line.itemName}</p>
                        <p className="text-xs text-[#475569]">{fmt(line.unitPrice)} each</p>
                      </div>
                      {/* Qty controls */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button type="button" onClick={() => adjustQty(line.menuItemId, -1)}
                          className="w-7 h-7 rounded-lg bg-[#0F172A] hover:bg-white/10 text-[#94A3B8] hover:text-white flex items-center justify-center text-sm font-bold transition">−</button>
                        <span className="w-6 text-center text-sm font-semibold text-white tabular-nums">{line.quantity}</span>
                        <button type="button" onClick={() => adjustQty(line.menuItemId, 1)}
                          className="w-7 h-7 rounded-lg bg-[#0F172A] hover:bg-white/10 text-[#94A3B8] hover:text-white flex items-center justify-center text-sm font-bold transition">+</button>
                      </div>
                      <span className="text-sm font-bold text-white tabular-nums w-14 text-right shrink-0">
                        {fmt(line.unitPrice * line.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              )
            }
          </div>

          {/* Payment section */}
          <div className="px-4 py-4 border-t border-white/5 space-y-3">
            {/* Tip */}
            {cartTotal > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-[#475569] mr-1">Tip</span>
                {[0, 5, 10, 15].map(pct => {
                  const v = pct === 0 ? 0 : Math.round(cartTotal * pct) / 100;
                  return (
                    <button key={pct} type="button" onClick={() => setTip(v)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition ${tip === v ? "bg-[#6366F1] border-[#6366F1] text-white" : "border-white/10 text-[#475569] hover:border-white/20 hover:text-[#94A3B8]"}`}>
                      {pct === 0 ? "None" : `+${pct}%`}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Totals */}
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-[#475569]">
                <span>Subtotal</span><span className="tabular-nums">{fmt(cartTotal - cartVat)}</span>
              </div>
              <div className="flex justify-between text-[#475569]">
                <span>VAT</span><span className="tabular-nums">{fmt(cartVat)}</span>
              </div>
              {tip > 0 && <div className="flex justify-between text-[#475569]">
                <span>Tip</span><span className="tabular-nums">+{fmt(tip)}</span>
              </div>}
              <div className="flex items-center justify-between pt-1.5 border-t border-white/5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-base">Total</span>
                  {rates && (
                    <button type="button" onClick={() => setShowCurrencyPicker(true)}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 hover:bg-white/10 text-[#64748B] transition">
                      {selectedCurrency} ▾
                    </button>
                  )}
                </div>
                <div className="text-right">
                  <span className="font-bold text-[#6366F1] text-xl tabular-nums">
                    {selectedCurrency === "PLN" || !rates
                      ? fmt(paymentTotal)
                      : `${(paymentTotal / (rates.rates[selectedCurrency] ?? 1)).toFixed(2)} ${selectedCurrency}`}
                  </span>
                  {selectedCurrency !== "PLN" && rates && (
                    <p className="text-[10px] text-[#334155] tabular-nums">{fmt(paymentTotal)} PLN</p>
                  )}
                </div>
              </div>
            </div>

            {/* Cash tendered */}
            {cartTotal > 0 && (
              <div className="flex gap-2 items-center">
                <input type="number" min={0} step={0.01} value={tendered} onChange={e => setTendered(e.target.value)}
                  placeholder="Cash tendered"
                  className="flex-1 bg-[#0F172A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-[#334155] tabular-nums focus:outline-none focus:border-[#6366F1]" />
                {change !== null && tendered !== "" && (
                  <span className={`text-sm font-bold tabular-nums px-2.5 py-2 rounded-lg ${change >= 0 ? "bg-[#10B981]/10 text-[#10B981]" : "bg-red-500/10 text-red-400"}`}>
                    {change >= 0 ? fmt(change) : `-${fmt(Math.abs(change))}`}
                  </span>
                )}
              </div>
            )}

            {/* NIP */}
            <div>
              <input type="text" value={buyerNip} onChange={e => setBuyerNip(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="NIP (B2B receipt — optional)"
                className={`w-full bg-[#0F172A] border rounded-lg px-3 py-2 text-sm text-white placeholder-[#334155] focus:outline-none ${nipStatus === "valid" ? "border-[#10B981]/40" : nipStatus === "invalid" ? "border-red-500/40" : "border-white/10 focus:border-[#6366F1]"}`} />
              {nipStatus === "valid" && <p className="text-[10px] text-[#10B981] mt-1 pl-1">✓ Valid NIP</p>}
              {nipStatus === "invalid" && <p className="text-[10px] text-red-400 mt-1 pl-1">✗ Invalid checksum</p>}
            </div>

            {/* Primary payment buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => handlePay("CASH")}
                disabled={cart.length === 0 || paying || nipStatus === "invalid"}
                className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#10B981] hover:bg-[#0D9668] text-white font-bold text-sm transition disabled:opacity-40 active:scale-95">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75" /></svg>
                {paying ? "…" : "Cash"}
              </button>
              <button type="button" onClick={() => handlePay("CARD")}
                disabled={cart.length === 0 || paying || nipStatus === "invalid"}
                className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#6366F1] hover:bg-[#5558E8] text-white font-bold text-sm transition disabled:opacity-40 active:scale-95">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>
                {paying ? "…" : "Card"}
              </button>
            </div>

            {/* Secondary actions */}
            <div className="flex gap-2">
              <button type="button" onClick={() => { setPayLegs([{ method: "CASH", amount: "" }]); setShowPayModal(true); }}
                disabled={cart.length === 0 || nipStatus === "invalid"}
                className="flex-1 py-2 rounded-lg border border-white/10 text-[#64748B] hover:text-[#94A3B8] hover:border-white/20 text-xs font-medium transition disabled:opacity-30">
                Split payment
              </button>
              <button type="button" onClick={handleInitiateQr}
                disabled={cart.length === 0 || qrBusy || nipStatus === "invalid"}
                className="flex-1 py-2 rounded-lg border border-white/10 text-[#64748B] hover:text-[#94A3B8] hover:border-white/20 text-xs font-medium transition disabled:opacity-30">
                {qrBusy ? "…" : "BLIK / QR"}
              </button>
            </div>

            {cart.length > 0 && (
              <button type="button" onClick={() => setCart([])}
                className="w-full py-1.5 text-[10px] text-[#334155] hover:text-[#475569] transition">
                Clear order
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
