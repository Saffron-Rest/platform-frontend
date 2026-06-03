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

// ─── NIP validation ───────────────────────────────────────────────────────────

function nipValid(nip: string) {
  const d = nip.replace(/\D/g, "");
  if (d.length !== 10) return false;
  return [6, 5, 7, 2, 3, 4, 5, 6, 7].reduce((s, v, i) => s + v * Number(d[i]), 0) % 11 === Number(d[9]);
}

// ─── Shared input style (dark context) ───────────────────────────────────────

const darkInput = "w-full bg-white/[0.06] border border-white/[0.10] rounded-xl px-3.5 py-2.5 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[var(--color-saffron)] focus:ring-1 focus:ring-[var(--color-saffron)]/25 transition";

// ─── Session gate ─────────────────────────────────────────────────────────────

function SessionGate({ onOpen }: { onOpen: (s: PosSession) => void }) {
  const [float_, setFloat] = useState("0");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setBusy(true); setErr("");
    try { onOpen(await openSession(Number(float_) || 0)); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed"); setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-[var(--color-ink)] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ background: "linear-gradient(145deg,var(--color-saffron),var(--color-saffron-dark))" }}>
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white font-[family-name:var(--font-display)] tracking-tight">Saffron POS</h1>
          <p className="text-white/45 text-sm mt-1">Open your shift to begin taking orders</p>
        </div>

        {/* Card */}
        <div className="bg-white/[0.04] rounded-2xl p-6 border border-white/[0.08]">
          {err && <div className="mb-4 px-3 py-2.5 rounded-xl bg-[var(--color-danger)]/15 text-[var(--color-danger)] text-sm border border-[var(--color-danger)]/20">{err}</div>}
          <label className="block mb-5">
            <span className="text-xs font-bold uppercase tracking-wider text-white/45">Opening cash float (PLN)</span>
            <input type="number" min={0} step={0.01} value={float_}
              onChange={e => setFloat(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submit()}
              className="mt-2 w-full bg-white/[0.06] border border-white/[0.10] rounded-xl px-4 py-3.5 text-white text-2xl text-center tabular-nums font-semibold focus:outline-none focus:border-[var(--color-saffron)] focus:ring-1 focus:ring-[var(--color-saffron)]/25" />
          </label>
          <button type="button" onClick={submit} disabled={busy}
            className="w-full text-white font-semibold py-3.5 rounded-xl transition disabled:opacity-50 text-sm"
            style={{ background: "linear-gradient(145deg,var(--color-saffron),var(--color-saffron-dark))" }}>
            {busy ? "Opening shift…" : "Open Shift"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Close session modal ──────────────────────────────────────────────────────

function CloseModal({ session, onClosed, onCancel }: { session: PosSession; onClosed: () => void; onCancel: () => void; }) {
  const [float_, setFloat] = useState("0");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async () => {
    setBusy(true); setErr("");
    try { await closeSession(session.id, Number(float_) || 0); onClosed(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed"); setBusy(false); }
  };
  return (
    <Overlay onClose={onCancel}>
      <h2 className="text-base font-bold text-white mb-1">Close Shift</h2>
      <p className="text-white/45 text-sm mb-5">Opening float: <strong className="text-white">{fmt(session.openingFloat)}</strong></p>
      {err && <ErrBox>{err}</ErrBox>}
      <label className="block mb-5">
        <span className="text-xs font-bold uppercase tracking-wider text-white/45">Closing cash count (PLN)</span>
        <input type="number" min={0} step={0.01} value={float_} onChange={e => setFloat(e.target.value)}
          className={`mt-2 text-xl text-center tabular-nums font-semibold ${darkInput}`} />
      </label>
      <p className="text-xs text-white/30 mb-5">POS totals will auto-fill your shift report.</p>
      <div className="flex gap-3">
        <GhostBtn onClick={onCancel} className="flex-1">Cancel</GhostBtn>
        <button type="button" onClick={submit} disabled={busy}
          className="flex-1 py-3 rounded-xl bg-[var(--color-danger)] hover:bg-[var(--color-danger)]/90 text-white font-semibold text-sm transition disabled:opacity-40">
          {busy ? "Closing…" : "Close Shift"}
        </button>
      </div>
    </Overlay>
  );
}

// ─── Primitive helpers ────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-[var(--color-ink)]/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#231f1c] rounded-2xl p-6 w-full max-w-md border border-white/[0.08] shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-white">{title}</h2>
          <button type="button" onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/[0.06] hover:bg-white/[0.10] text-white/50 flex items-center justify-center text-lg leading-none transition">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ErrBox({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 px-3 py-2.5 rounded-xl bg-[var(--color-danger)]/15 text-[var(--color-danger)] text-sm border border-[var(--color-danger)]/20">{children}</div>;
}

function GhostBtn({ onClick, className = "", children }: { onClick: () => void; className?: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`py-3 rounded-xl border border-white/[0.10] text-white/55 text-sm hover:bg-white/[0.05] hover:text-white/80 transition ${className}`}>
      {children}
    </button>
  );
}

function PrimaryBtn({ onClick, disabled, children, className = "" }: { onClick: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`py-3 rounded-xl text-white font-semibold text-sm transition disabled:opacity-40 active:scale-95 ${className}`}
      style={{ background: "linear-gradient(145deg,var(--color-saffron),var(--color-saffron-dark))" }}>
      {children}
    </button>
  );
}

// ─── POS App ──────────────────────────────────────────────────────────────────

export function PosApp() {
  const [session, setSession] = useState<PosSession | null | "loading">("loading");
  const [menu, setMenu] = useState<PosMenuItem[]>([]);
  const [tables, setTables] = useState<PosTable[]>([]);
  const [activeOrder, setActiveOrder] = useState<PosOrder | null>(null);
  const [selectedTable, setSelectedTable] = useState<PosTable | null>(null);
  const [cart, setCart] = useState<Array<{ menuItemId: string; itemName: string; unitPrice: number; vatRatePct: number; quantity: number }>>([]);
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
    try { const [m, t] = await Promise.all([getPosMenu(), getPosTables()]); setMenu(m); setTables(t); }
    catch (e) { setError(e instanceof Error ? e.message : "Load failed"); }
  }, []);

  useEffect(() => {
    getCurrentSession().then(setSession).catch(() => setSession(null));
    loadData().finally(() => setLoading(false));
    getExchangeRates().then(setRates).catch(() => {});
    const t = setInterval(() => getPosTables().then(setTables).catch(() => {}), 30_000);
    return () => clearInterval(t);
  }, [loadData]);

  useEffect(() => {
    if (mainView !== "menu") return;
    const onKey = async (e: KeyboardEvent) => {
      if (e.key === "Enter" && barcodeBuffer.length >= 3) {
        const code = barcodeBuffer; setBarcodeBuffer("");
        const item = await searchByBarcode(code);
        if (item) { addToCart(item); setError(""); } else setError(`Barcode not found: ${code}`);
      } else if (e.key.length === 1) setBarcodeBuffer(p => p + e.key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mainView, barcodeBuffer]);
  useEffect(() => { if (mainView !== "menu") setBarcodeBuffer(""); }, [mainView]);

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

  const loadOpenOrders = useCallback(async () => { try { setOpenOrders(await getOpenOrders()); } catch {} }, []);
  useEffect(() => { if (showOpenBills) loadOpenOrders(); }, [showOpenBills, loadOpenOrders]);

  const adjustQty = (menuItemId: string, delta: number) =>
    setCart(p => p.map(l => l.menuItemId === menuItemId ? { ...l, quantity: l.quantity + delta } : l).filter(l => l.quantity > 0));

  const addToCart = (item: PosMenuItem) => {
    setCart(p => {
      const ex = p.find(l => l.menuItemId === item.id);
      return ex ? p.map(l => l.menuItemId === item.id ? { ...l, quantity: l.quantity + 1 } : l)
        : [...p, { menuItemId: item.id, itemName: item.name, unitPrice: item.sellPrice, vatRatePct: item.vatRatePct, quantity: 1 }];
    });
    setMainView("menu");
  };

  const mkOrder = async () => {
    if (activeOrder) return activeOrder;
    return createOrder({ tableId: selectedTable?.id, orderType, customerName: customerName.trim() || undefined, customerPhone: customerPhone.trim() || undefined, deliveryAddress: deliveryAddress.trim() || undefined, specialRequests: specialRequests.trim() || undefined, covers: covers ? Number(covers) : undefined, orderNote: orderNote.trim() || undefined, lines: cart.map(l => ({ menuItemId: l.menuItemId, quantity: l.quantity })) });
  };

  const afterPay = async () => {
    setCart([]); setBuyerNip(""); setTendered(""); setTip(0);
    setMainView("tables"); setTables(await getPosTables());
  };

  const handlePay = async (method: "CASH" | "CARD") => {
    if (nipStatus === "invalid") { setError("Invalid NIP checksum"); return; }
    setPaying(true); setError("");
    try {
      let order = await mkOrder();
      if (activeOrder) for (const l of cart) order = await addLine(order.id, { menuItemId: l.menuItemId, quantity: l.quantity });
      setActiveOrder(await payOrder(order.id, { paymentMethod: method, amountTendered: tendered ? Number(tendered) : undefined, tipAmount: tip > 0 ? tip : undefined, buyerNip: buyerNip.trim() || undefined }));
      await afterPay();
    } catch (e) { setError(e instanceof Error ? e.message : "Payment failed"); }
    finally { setPaying(false); }
  };

  const handlePayMulti = async () => {
    if (nipStatus === "invalid") { setError("Invalid NIP"); return; }
    setPayBusy(true); setError("");
    try {
      const order = await mkOrder();
      setActiveOrder(await payOrderMulti(order.id, { payments: payLegs.map(l => ({ method: l.method, amount: Number(l.amount) })), tipAmount: tip > 0 ? tip : undefined, buyerNip: buyerNip.trim() || undefined }));
      setPayLegs([{ method: "CASH", amount: "" }]); setShowPayModal(false);
      await afterPay();
    } catch (e) { setError(e instanceof Error ? e.message : "Payment failed"); }
    finally { setPayBusy(false); }
  };

  const handlePark = async () => {
    if (!activeOrder) return;
    try {
      await parkOrder(activeOrder.id, parkNote.trim() || undefined);
      setActiveOrder(null); setCart([]); setSelectedTable(null); setParkNote(""); setShowParkModal(false);
      setMainView("tables"); setTables(await getPosTables());
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

  const handleInitiateQr = async () => {
    if (!activeOrder) return;
    setQrBusy(true);
    try {
      const tx = await initiateQrPayment(activeOrder.id, selectedCurrency);
      setQrTx(tx); setShowQrModal(true);
      const poll = setInterval(async () => {
        try {
          const u = await getQrStatus(tx.id); setQrTx(u);
          if (u.status === "CONFIRMED") { clearInterval(poll); setShowQrModal(false); await afterPay(); }
          else if (u.status !== "PENDING") clearInterval(poll);
        } catch { clearInterval(poll); }
      }, 3000);
    } catch (e) { setError(e instanceof Error ? e.message : "QR failed"); }
    finally { setQrBusy(false); }
  };

  if (session === "loading" || loading)
    return <div className="flex items-center justify-center min-h-screen bg-[var(--color-ink)]"><Spinner label="Loading POS…" /></div>;
  if (!session) return <SessionGate onOpen={setSession} />;

  const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // ── Shared toggle button style ─────────────────────────────────────────────
  const segBtn = (active: boolean) =>
    `flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${active ? "bg-white/[0.10] text-white shadow" : "text-white/40 hover:text-white/60"}`;

  const catBtn = (active: boolean) =>
    `w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition ${active ? "bg-white/[0.08] text-white" : "text-white/50 hover:bg-white/[0.04] hover:text-white/80"}`;

  return (
    <div className="flex flex-col h-screen bg-[var(--color-ink)] text-white overflow-hidden select-none">

      {/* ── Modals ── */}
      {showCloseModal && <CloseModal session={session} onClosed={() => { setSession(null); setShowCloseModal(false); setCart([]); }} onCancel={() => setShowCloseModal(false)} />}

      {showParkModal && (
        <Modal title="Park Bill" onClose={() => setShowParkModal(false)}>
          <label className="block mb-5 text-sm text-white/50">Note (optional)
            <input type="text" value={parkNote} onChange={e => setParkNote(e.target.value)} autoFocus placeholder="e.g. Waiting for dessert" className={`mt-1.5 ${darkInput}`} />
          </label>
          <div className="flex gap-3">
            <GhostBtn onClick={() => setShowParkModal(false)} className="flex-1">Cancel</GhostBtn>
            <button type="button" onClick={handlePark}
              className="flex-1 py-3 rounded-xl bg-[var(--color-saffron)] hover:bg-[var(--color-saffron-dark)] text-white font-semibold text-sm transition">Park Bill</button>
          </div>
        </Modal>
      )}

      {showCashModal && (
        <Modal title="Cash Drawer" onClose={() => setShowCashModal(false)}>
          <div className="flex gap-2 mb-4">
            {(["OUT", "IN"] as const).map(t => (
              <button key={t} type="button" onClick={() => setCashType(t)}
                className={`flex-1 py-2.5 rounded-xl font-semibold text-sm border transition ${cashType === t ? (t === "OUT" ? "bg-[var(--color-danger)]/20 border-[var(--color-danger)]/30 text-[var(--color-danger)]" : "bg-[var(--color-success)]/20 border-[var(--color-success)]/30 text-[var(--color-success)]") : "border-white/[0.10] text-white/40 hover:bg-white/[0.04]"}`}>
                {t === "OUT" ? "− Withdrawal" : "+ Deposit"}
              </button>
            ))}
          </div>
          <label className="block mb-3 text-sm text-white/50">Amount (PLN)
            <input type="number" min={0.01} step={0.01} value={cashAmount} onChange={e => setCashAmount(e.target.value)} autoFocus className={`mt-1.5 ${darkInput}`} />
          </label>
          <label className="block mb-3 text-sm text-white/50">Reason
            <select value={cashReason} onChange={e => setCashReason(e.target.value)} className={`mt-1.5 ${darkInput}`}>
              <option value="BANK_DEPOSIT">Bank deposit</option>
              <option value="SUPPLIER_PAYMENT">Supplier payment</option>
              <option value="PETTY_CASH">Petty cash</option>
              <option value="CHANGE_FUND">Change fund</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
          <label className="block mb-5 text-sm text-white/50">Note (optional)
            <input type="text" value={cashNote} onChange={e => setCashNote(e.target.value)} placeholder="Invoice ref…" className={`mt-1.5 ${darkInput}`} />
          </label>
          <div className="flex gap-3">
            <GhostBtn onClick={() => setShowCashModal(false)} className="flex-1">Cancel</GhostBtn>
            <PrimaryBtn onClick={handleCashMovement} disabled={!cashAmount || cashBusy} className="flex-1">
              {cashBusy ? "Saving…" : "Confirm"}
            </PrimaryBtn>
          </div>
        </Modal>
      )}

      {showDiscountDrawer && (
        <Modal title="Apply Discount" onClose={() => setShowDiscountDrawer(false)}>
          <div className="flex gap-2 mb-4">
            {(["ORDER", "ITEM"] as const).map(t => (
              <button key={t} type="button" onClick={() => setDiscountType(t)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition ${discountType === t ? "bg-[var(--color-saffron)] border-[var(--color-saffron)] text-white" : "border-white/[0.10] text-white/40 hover:bg-white/[0.04]"}`}>
                {t === "ORDER" ? "Whole order" : "One item"}
              </button>
            ))}
          </div>
          {discountType === "ITEM" && activeOrder && (
            <div className="mb-4 space-y-1.5 max-h-36 overflow-auto">
              {activeOrder.lines.map(l => (
                <button key={l.id} type="button" onClick={() => setDiscountLineId(l.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition ${discountLineId === l.id ? "border-[var(--color-saffron)] bg-[var(--color-saffron)]/10 text-white" : "border-white/[0.08] text-white/55 hover:bg-white/[0.04]"}`}>
                  {l.quantity}× {l.itemName} — {fmt(l.lineGross ?? l.unitPrice * l.quantity)}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2 mb-4">
            {([true, false] as const).map(p => (
              <button key={String(p)} type="button" onClick={() => setDiscountIsPct(p)}
                className={`flex-1 py-2 rounded-xl text-sm border transition ${discountIsPct === p ? "bg-white/[0.12] border-white/20 text-white" : "border-white/[0.08] text-white/40 hover:bg-white/[0.04]"}`}>
                {p ? "Percent %" : "Fixed PLN"}
              </button>
            ))}
          </div>
          <label className="block mb-2 text-sm text-white/50">{discountIsPct ? "Discount %" : "Discount (PLN)"}
            <input type="number" min={0} max={discountIsPct ? 100 : undefined} step={discountIsPct ? 1 : 0.01} value={discountValue} onChange={e => setDiscountValue(e.target.value)} autoFocus className={`mt-1.5 ${darkInput}`} />
          </label>
          {discountValue && <p className="text-[var(--color-success)] text-sm mb-4">Saving: {fmt(discountIsPct ? cartTotal * Number(discountValue) / 100 : Number(discountValue))}</p>}
          <div className="flex gap-2">
            <GhostBtn onClick={() => setShowDiscountDrawer(false)} className="flex-1">Cancel</GhostBtn>
            <button type="button" onClick={() => { handleClearDiscount(); setShowDiscountDrawer(false); }} className="px-4 py-3 rounded-xl border border-[var(--color-danger)]/30 text-[var(--color-danger)] text-sm hover:bg-[var(--color-danger)]/10 transition">Clear</button>
            <PrimaryBtn onClick={handleApplyDiscount} disabled={!discountValue || discountBusy || (discountType === "ITEM" && !discountLineId)} className="flex-1">
              {discountBusy ? "…" : "Apply"}
            </PrimaryBtn>
          </div>
        </Modal>
      )}

      {showOrderForm && (
        <Modal title="Order Details" onClose={() => setShowOrderForm(false)}>
          <div className="flex gap-2 mb-4">
            {(["DINE_IN", "TAKEAWAY", "DELIVERY"] as const).map(t => (
              <button key={t} type="button" onClick={() => setOrderType(t)}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition ${orderType === t ? "bg-[var(--color-saffron)] border-[var(--color-saffron)] text-white" : "border-white/[0.10] text-white/40 hover:bg-white/[0.04]"}`}>
                {t === "DINE_IN" ? "Dine-in" : t === "TAKEAWAY" ? "Takeaway" : "Delivery"}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <label className="block text-sm text-white/50">Covers
              <input type="number" min={1} value={covers} onChange={e => setCovers(e.target.value)} placeholder="2" className={`mt-1.5 ${darkInput}`} />
            </label>
            <label className="block text-sm text-white/50">Order note
              <input type="text" value={orderNote} onChange={e => setOrderNote(e.target.value)} placeholder="Allergy note…" className={`mt-1.5 ${darkInput}`} />
            </label>
          </div>
          {[["Customer name", customerName, setCustomerName, "Jan Kowalski"], ["Phone", customerPhone, setCustomerPhone, "+48 500 123 456"]].map(([label, value, setter, placeholder]) => (
            <label key={label as string} className="block mb-3 text-sm text-white/50">{label as string}
              <input type="text" value={value as string} onChange={e => (setter as React.Dispatch<React.SetStateAction<string>>)(e.target.value)} placeholder={placeholder as string} className={`mt-1.5 ${darkInput}`} />
            </label>
          ))}
          {orderType === "DELIVERY" && (
            <label className="block mb-3 text-sm text-white/50">Delivery address *
              <input type="text" value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} placeholder="ul. Marszałkowska 1, Warszawa" className={`mt-1.5 ${darkInput}`} />
            </label>
          )}
          <label className="block mb-5 text-sm text-white/50">Special requests
            <textarea value={specialRequests} onChange={e => setSpecialRequests(e.target.value)} placeholder="Allergens, no onion…" rows={2} className={`mt-1.5 resize-none ${darkInput}`} />
          </label>
          <PrimaryBtn onClick={() => setShowOrderForm(false)} className="w-full">Save</PrimaryBtn>
        </Modal>
      )}

      {showQrModal && qrTx && (
        <Modal title="BLIK / QR Payment" onClose={() => setShowQrModal(false)}>
          <div className="text-center space-y-4">
            <div className="bg-white rounded-xl p-5 mx-auto w-36 h-36 flex items-center justify-center">
              <p className="text-[var(--color-ink)] text-[10px] font-mono break-all">{qrTx.id.slice(0, 16)}</p>
            </div>
            <p className="text-2xl font-bold tabular-nums">{fmt(qrTx.amount)}</p>
            <p className={`text-sm font-semibold ${qrTx.status === "CONFIRMED" ? "text-[var(--color-success)]" : qrTx.status === "EXPIRED" ? "text-[var(--color-danger)]" : "text-[var(--color-saffron)]"}`}>
              {qrTx.status === "PENDING" ? "Waiting for payment…" : qrTx.status === "CONFIRMED" ? "✓ Payment confirmed!" : qrTx.status}
            </p>
            <button type="button" onClick={async () => { if (qrTx) await cancelQrPayment(qrTx.id).catch(() => {}); setShowQrModal(false); setQrTx(null); }}
              className="text-xs text-white/30 hover:text-[var(--color-danger)]">Cancel payment</button>
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
                  className={`w-full flex justify-between items-center px-4 py-3 rounded-xl border transition ${selectedCurrency === c ? "border-[var(--color-saffron)] bg-[var(--color-saffron)]/10" : "border-white/[0.08] hover:bg-white/[0.04]"}`}>
                  <span className="font-bold text-white">{c}</span>
                  <div className="text-right">
                    <p className="font-bold text-white tabular-nums">{conv.toFixed(2)} {c}</p>
                    {c !== "PLN" && <p className="text-[10px] text-white/30">1 {c} = {rate.toFixed(4)} PLN</p>}
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
            <span className="text-white/50">Total to pay</span>
            <span className="font-bold text-[var(--color-saffron)]">{fmt(paymentTotal)}</span>
          </div>
          <div className="space-y-2 mb-3">
            {payLegs.map((leg, i) => (
              <div key={i} className="flex gap-2">
                <select value={leg.method} onChange={e => setPayLegs(p => p.map((l, j) => j === i ? { ...l, method: e.target.value } : l))}
                  className="bg-white/[0.06] border border-white/[0.10] rounded-lg px-2 py-2 text-sm text-white shrink-0 focus:outline-none focus:border-[var(--color-saffron)]">
                  {["CASH", "CARD", "VOUCHER", "BANK_TRANSFER", "OTHER"].map(m => <option key={m}>{m}</option>)}
                </select>
                <input type="number" min={0} step={0.01} placeholder="Amount" value={leg.amount}
                  onChange={e => setPayLegs(p => p.map((l, j) => j === i ? { ...l, amount: e.target.value } : l))}
                  className={`flex-1 ${darkInput}`} />
                {payLegs.length > 1 && <button type="button" onClick={() => setPayLegs(p => p.filter((_, j) => j !== i))} className="text-white/30 hover:text-[var(--color-danger)] px-2">×</button>}
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setPayLegs(p => [...p, { method: "CARD", amount: legRemaining > 0 ? String(Math.round(legRemaining * 100) / 100) : "" }])}
            className="text-xs text-[var(--color-saffron)] hover:underline mb-4 block">+ Add another method</button>
          <div className={`flex justify-between text-sm font-semibold rounded-xl px-4 py-3 mb-4 ${legRemaining <= 0.005 ? "bg-[var(--color-success)]/15 text-[var(--color-success)]" : "bg-[var(--color-saffron)]/10 text-[var(--color-saffron)]"}`}>
            <span>{legRemaining <= 0.005 ? "✓ Fully covered" : "Remaining"}</span>
            <span>{legRemaining > 0.005 ? fmt(legRemaining) : "0.00"}</span>
          </div>
          <div className="flex gap-3">
            <GhostBtn onClick={() => setShowPayModal(false)} className="flex-1">Cancel</GhostBtn>
            <PrimaryBtn onClick={handlePayMulti} disabled={legRemaining > 0.005 || payBusy || cart.length === 0} className="flex-1">
              {payBusy ? "Processing…" : "Confirm Payment"}
            </PrimaryBtn>
          </div>
        </Modal>
      )}

      {/* Open bills sidebar */}
      {showOpenBills && (
        <div className="fixed inset-y-0 left-0 z-50 w-80 bg-[#231f1c] border-r border-white/[0.08] flex flex-col shadow-2xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <h3 className="font-bold text-white text-sm">Open Bills ({openOrders.length})</h3>
            <button type="button" onClick={() => setShowOpenBills(false)}
              className="w-8 h-8 rounded-lg bg-white/[0.06] hover:bg-white/[0.10] text-white/50 flex items-center justify-center">×</button>
          </div>
          <div className="flex-1 overflow-auto">
            {openOrders.length === 0
              ? <p className="text-white/25 text-sm text-center py-10">No open bills</p>
              : openOrders.map(o => {
                const tbl = tables.find(t => t.id === o.tableId);
                const age = Math.round((Date.now() - new Date(o.openedAt).getTime()) / 60000);
                return (
                  <button key={o.id} type="button"
                    onClick={async () => { if (o.status === "PARKED") await resumeOrder(o.id).catch(() => {}); setSelectedTable(tbl ?? null); setMainView("menu"); setShowOpenBills(false); }}
                    className="w-full text-left px-5 py-3.5 hover:bg-white/[0.04] border-b border-white/[0.05] transition">
                    <div className="flex justify-between mb-1">
                      <span className="font-semibold text-sm text-white">{tbl?.name ?? "Take-away"}</span>
                      <span className="text-xs text-white/30">{age}m ago</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-white/40">{o.lines.length} items · <span className={o.status === "PARKED" ? "text-[var(--color-saffron)]" : "text-[var(--color-success)]"}>{o.status}</span></span>
                      <span className="text-sm font-bold text-[var(--color-saffron)]">{fmt(o.totalGross)}</span>
                    </div>
                  </button>
                );
              })}
          </div>
          <div className="px-5 py-3 border-t border-white/[0.06]">
            <button onClick={loadOpenOrders} className="w-full py-2 text-xs text-white/30 hover:text-white/50 rounded-lg hover:bg-white/[0.04] transition">Refresh</button>
          </div>
        </div>
      )}

      {/* ── Top bar ── */}
      <header className="flex items-center gap-3 px-4 h-14 border-b border-white/[0.08] shrink-0" style={{ background: "rgba(26,22,20,0.95)" }}>
        {/* Logo */}
        <div className="flex items-center gap-2.5 mr-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black shadow"
            style={{ background: "linear-gradient(145deg,var(--color-saffron),var(--color-saffron-dark))" }}>S</div>
          <span className="font-bold text-sm text-white tracking-tight font-[family-name:var(--font-display)] hidden sm:block">Saffron POS</span>
        </div>

        {/* Context badges */}
        {selectedTable && (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[var(--color-saffron)]/15 text-[var(--color-saffron)] border border-[var(--color-saffron)]/20">
            {selectedTable.name}
          </span>
        )}
        <button type="button" onClick={() => setShowOrderForm(true)}
          className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${orderType !== "DINE_IN" ? "bg-[var(--color-saffron)]/15 text-[var(--color-saffron)] border-[var(--color-saffron)]/20" : "bg-white/[0.05] text-white/40 border-white/[0.08] hover:bg-white/[0.08]"}`}>
          {orderType === "DELIVERY" ? "Delivery" : orderType === "TAKEAWAY" ? "Takeaway" : "Dine-in"}
        </button>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 px-3 py-1 bg-[var(--color-danger)]/15 text-[var(--color-danger)] text-xs rounded-full border border-[var(--color-danger)]/20 max-w-xs">
            <span className="truncate">{error}</span>
            <button type="button" onClick={() => setError("")} className="shrink-0">×</button>
          </div>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-xs text-white/25 tabular-nums mr-2 hidden md:block">{timeStr}</span>

          <button type="button" onClick={() => setShowOpenBills(true)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] text-white/50 hover:text-white text-xs transition">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            Bills {openOrders.length > 0 && <span className="bg-[var(--color-saffron)] text-white text-[10px] font-bold px-1.5 rounded-full">{openOrders.length}</span>}
          </button>

          {cart.length > 0 && activeOrder && (
            <button type="button" onClick={() => setShowDiscountDrawer(true)}
              className="h-8 px-3 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] text-white/50 hover:text-white text-xs transition hidden sm:flex items-center">
              % Disc
            </button>
          )}
          {cart.length > 0 && activeOrder && (
            <button type="button" onClick={() => setShowParkModal(true)}
              className="h-8 px-3 rounded-lg bg-[var(--color-saffron)]/10 hover:bg-[var(--color-saffron)]/20 text-[var(--color-saffron)] text-xs font-medium transition">
              Park
            </button>
          )}
          <button type="button" onClick={() => setShowCashModal(true)}
            className="h-8 px-3 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] text-white/50 hover:text-white text-xs transition">
            Cash
          </button>

          <div className="w-px h-5 bg-white/[0.08] mx-1" />

          {[
            { href: "/pos/display", icon: "M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3", title: "Customer display" },
            { href: "/pos/waiter", icon: "M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3", title: "Waiter app" },
          ].map(({ href, icon, title }) => (
            <button key={href} type="button" onClick={() => window.open(href, "_blank")} title={title}
              className="w-8 h-8 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] text-white/30 hover:text-white/60 flex items-center justify-center transition">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={icon} /></svg>
            </button>
          ))}
          <button type="button" onClick={() => { window.location.href = "/"; }}
            className="w-8 h-8 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] text-white/30 hover:text-white/60 flex items-center justify-center transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></svg>
          </button>
          <button type="button" onClick={() => setShowCloseModal(true)}
            className="h-8 px-3 rounded-lg bg-[var(--color-danger)]/10 hover:bg-[var(--color-danger)]/20 text-[var(--color-danger)] text-xs font-medium transition ml-1">
            Close
          </button>
        </div>
      </header>

      {/* ── 3-column body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Category sidebar ── */}
        <aside className="w-52 border-r border-white/[0.08] flex flex-col overflow-hidden shrink-0" style={{ background: "rgba(26,22,20,0.6)" }}>
          {/* Tables / Menu toggle */}
          <div className="px-3 py-3 border-b border-white/[0.06]">
            <div className="flex bg-white/[0.04] rounded-xl p-0.5 gap-0.5">
              <button type="button" onClick={() => setMainView("tables")} className={segBtn(mainView === "tables")}>Tables</button>
              <button type="button" onClick={() => setMainView("menu")} className={segBtn(mainView === "menu")}>Menu</button>
            </div>
          </div>

          {/* Category nav */}
          {mainView === "menu" && (
            <nav className="flex-1 overflow-auto py-2 px-2 space-y-px">
              <button type="button" onClick={() => setActiveCat(null)} className={catBtn(!activeCat)}>
                {!activeCat && <span className="absolute left-0 top-2 bottom-2 w-0.5 bg-[var(--color-saffron)] rounded-r" style={{ position: "relative", width: 3, height: "100%", flexShrink: 0 }} />}
                <span className="truncate flex-1">All items</span>
                <span className="text-[11px] tabular-nums text-white/20 shrink-0">{menu.length}</span>
              </button>
              {categories.map(c => {
                const count = menu.filter(i => i.categoryId === c.id).length;
                const active = activeCat === c.id;
                return (
                  <button key={c.id} type="button" onClick={() => setActiveCat(c.id)} className={`${catBtn(active)} relative`}>
                    {active && <span className="absolute left-0 inset-y-0 w-0.5 bg-[var(--color-saffron)] rounded-r" />}
                    <span className="truncate flex-1 pl-1">{c.name}</span>
                    <span className="text-[11px] tabular-nums text-white/20 shrink-0">{count}</span>
                  </button>
                );
              })}
            </nav>
          )}

          {/* Area filter */}
          {mainView === "tables" && areas.length > 0 && (
            <nav className="flex-1 overflow-auto py-2 px-2 space-y-px">
              <button type="button" onClick={() => setAreaFilter(null)} className={catBtn(!areaFilter)}>All areas</button>
              {areas.map(a => <button key={a} type="button" onClick={() => setAreaFilter(a)} className={catBtn(areaFilter === a)}>{a}</button>)}
            </nav>
          )}

          {/* Session footer */}
          <div className="px-4 py-3 border-t border-white/[0.06]">
            <p className="text-[11px] text-white/20 truncate">
              Since {new Date(session.openedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </aside>

        {/* ── Center: Tables / Menu ── */}
        <main className="flex-1 overflow-auto bg-[var(--color-ink)]">

          {/* Tables */}
          {mainView === "tables" && (
            <div className="p-5">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="font-bold text-white text-sm">Floor Plan</h2>
                  <p className="text-xs text-white/30 mt-0.5">
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
                        try { const r = await resumeOrder(t.openOrderId); setActiveOrder(r); setCart(r.lines.map(l => ({ menuItemId: l.menuItemId ?? l.id, itemName: l.itemName, unitPrice: l.unitPrice, vatRatePct: l.vatRatePct, quantity: l.quantity }))); } catch {}
                      }
                      setMainView("menu");
                    }}
                    className={`aspect-square rounded-2xl flex flex-col items-center justify-center gap-1.5 text-sm font-semibold border transition active:scale-95 ${
                      t.occupied
                        ? "bg-[var(--color-saffron)]/8 border-[var(--color-saffron)]/20 text-[var(--color-saffron)] hover:bg-[var(--color-saffron)]/15"
                        : "bg-white/[0.03] border-white/[0.06] text-white/50 hover:bg-white/[0.06] hover:text-white/80 hover:border-white/[0.10]"
                    } ${selectedTable?.id === t.id ? "ring-2 ring-[var(--color-saffron)] ring-offset-2 ring-offset-[var(--color-ink)]" : ""}`}>
                    <span>{t.name}</span>
                    <span className="text-[10px] font-normal opacity-40">{t.seats} seats</span>
                    {t.occupied && <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-saffron)]" />}
                  </button>
                ))}
                <button type="button" onClick={() => { setSelectedTable(null); setMainView("menu"); }}
                  className="aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 bg-white/[0.03] border border-dashed border-white/[0.08] text-white/30 hover:text-white/50 hover:bg-white/[0.05] transition active:scale-95">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
                  <span className="text-[10px] font-medium">Take-away</span>
                </button>
              </div>
            </div>
          )}

          {/* Menu */}
          {mainView === "menu" && (
            <div className="p-4">
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {filteredMenu.map(item => {
                  const inCart = cart.find(l => l.menuItemId === item.id);
                  return (
                    <button key={item.id} type="button" onClick={() => addToCart(item)}
                      className={`relative flex flex-col rounded-2xl overflow-hidden border text-left transition active:scale-[0.97] group ${
                        inCart
                          ? "border-[var(--color-saffron)]/30 bg-[var(--color-saffron)]/6 ring-1 ring-[var(--color-saffron)]/15"
                          : "border-white/[0.06] bg-white/[0.03] hover:border-white/[0.10] hover:bg-white/[0.05]"
                      }`}>
                      {inCart && (
                        <div className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center shadow-md"
                          style={{ background: "linear-gradient(145deg,var(--color-saffron),var(--color-saffron-dark))" }}>
                          {inCart.quantity}
                        </div>
                      )}
                      {item.imagePath
                        ? <img src={`/api/uploads/${item.imagePath}`} alt="" className="w-full aspect-[4/3] object-cover" />
                        : (
                          <div className="w-full aspect-[4/3] bg-white/[0.03] flex items-center justify-center">
                            <svg className="w-8 h-8 text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.87c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513m-3-4.87v-1.5m-6 1.5v-1.5m12 9.75l-1.5.75a3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0L3 16.5m15-3.38a48.474 48.474 0 00-6-.37c-2.032 0-4.034.125-6 .37m12 0c.39.049.777.102 1.163.16 1.07.16 1.837 1.049 1.837 2.13v1.96c0 .445-.168.87-.47 1.192l-1.04 1.04a2.25 2.25 0 01-3.182 0L9 17.13a2.25 2.25 0 01-.659-1.591v-1.96c0-1.08.768-1.97 1.837-2.13A48.4 48.4 0 0112 11.5c.656 0 1.305.02 1.944.058" /></svg>
                          </div>
                        )
                      }
                      <div className="p-3">
                        <p className="text-xs font-semibold text-white/90 line-clamp-2 leading-tight mb-1">{item.name}</p>
                        {item.isHappyHour && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-[var(--color-saffron)] bg-[var(--color-saffron)]/10 px-1.5 py-0.5 rounded-full mb-1">
                            ⚡ {item.happyHourName ?? "Happy Hour"}
                          </span>
                        )}
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-sm font-bold text-[var(--color-saffron)]">{fmt(item.sellPrice)}</span>
                          {item.isHappyHour && item.originalPrice && item.originalPrice !== item.sellPrice && (
                            <span className="text-[10px] text-white/20 line-through">{fmt(item.originalPrice)}</span>
                          )}
                        </div>
                        {item.allergens && <p className="text-[9px] text-[var(--color-danger)]/60 truncate mt-0.5">{item.allergens}</p>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </main>

        {/* ── Order panel ── */}
        <aside className="w-80 xl:w-96 border-l border-white/[0.08] flex flex-col shrink-0" style={{ background: "rgba(26,22,20,0.6)" }}>

          {/* Header */}
          <div className="px-5 py-4 border-b border-white/[0.06]">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-white text-sm">{selectedTable ? selectedTable.name : "Take-away"}</p>
                <p className="text-white/30 text-xs mt-0.5">
                  {covers ? `${covers} covers · ` : ""}
                  {orderType !== "DINE_IN" ? orderType.replace("_", " ") : "Current order"}
                </p>
              </div>
              {cartCount > 0 && (
                <span className="bg-[var(--color-saffron)]/15 text-[var(--color-saffron)] text-xs font-semibold px-2.5 py-1 rounded-full">
                  {cartCount} items
                </span>
              )}
            </div>
          </div>

          {/* Lines */}
          <div className="flex-1 overflow-auto px-4 py-3">
            {cart.length === 0
              ? (
                <div className="flex flex-col items-center justify-center h-full pb-8">
                  <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-3">
                    <svg className="w-7 h-7 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" /></svg>
                  </div>
                  <p className="text-white/25 text-sm font-medium">No items yet</p>
                  <p className="text-white/15 text-xs mt-1">Tap any item from the menu</p>
                </div>
              )
              : cart.map(line => (
                <div key={line.menuItemId} className="flex items-center gap-3 py-2.5 border-b border-white/[0.05]">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-white/90 truncate">{line.itemName}</p>
                    <p className="text-[11px] text-white/30">{fmt(line.unitPrice)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" onClick={() => adjustQty(line.menuItemId, -1)}
                      className="w-7 h-7 rounded-lg bg-white/[0.06] hover:bg-white/[0.10] text-white/50 hover:text-white flex items-center justify-center text-sm font-bold transition">−</button>
                    <span className="w-6 text-center text-sm font-semibold text-white tabular-nums">{line.quantity}</span>
                    <button type="button" onClick={() => adjustQty(line.menuItemId, 1)}
                      className="w-7 h-7 rounded-lg bg-white/[0.06] hover:bg-white/[0.10] text-white/50 hover:text-white flex items-center justify-center text-sm font-bold transition">+</button>
                  </div>
                  <span className="text-[13px] font-bold text-white/80 tabular-nums w-14 text-right shrink-0">
                    {fmt(line.unitPrice * line.quantity)}
                  </span>
                </div>
              ))
            }
          </div>

          {/* Payment section */}
          <div className="px-4 py-4 border-t border-white/[0.06] space-y-3">
            {/* Tip */}
            {cartTotal > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-white/30 mr-1 shrink-0">Tip</span>
                {[0, 5, 10, 15].map(pct => {
                  const v = pct === 0 ? 0 : Math.round(cartTotal * pct) / 100;
                  return (
                    <button key={pct} type="button" onClick={() => setTip(v)}
                      className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold border transition ${tip === v ? "bg-[var(--color-saffron)] border-[var(--color-saffron)] text-white" : "border-white/[0.08] text-white/30 hover:border-white/[0.15] hover:text-white/50"}`}>
                      {pct === 0 ? "No tip" : `+${pct}%`}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Totals */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[13px] text-white/35">
                <span>Net</span><span className="tabular-nums">{fmt(cartTotal - cartVat)}</span>
              </div>
              <div className="flex justify-between text-[13px] text-white/35">
                <span>VAT</span><span className="tabular-nums">{fmt(cartVat)}</span>
              </div>
              {tip > 0 && <div className="flex justify-between text-[13px] text-white/35">
                <span>Tip</span><span className="tabular-nums text-[var(--color-saffron)]">+{fmt(tip)}</span>
              </div>}
              <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-base">Total</span>
                  {rates && (
                    <button type="button" onClick={() => setShowCurrencyPicker(true)}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] hover:bg-white/[0.10] text-white/40 transition">
                      {selectedCurrency} ▾
                    </button>
                  )}
                </div>
                <div className="text-right">
                  <span className="font-bold text-[var(--color-saffron)] text-xl tabular-nums">
                    {selectedCurrency === "PLN" || !rates
                      ? fmt(paymentTotal)
                      : `${(paymentTotal / (rates.rates[selectedCurrency] ?? 1)).toFixed(2)} ${selectedCurrency}`}
                  </span>
                  {selectedCurrency !== "PLN" && rates && (
                    <p className="text-[10px] text-white/20 tabular-nums">{fmt(paymentTotal)} PLN</p>
                  )}
                </div>
              </div>
            </div>

            {/* Cash tendered */}
            {cartTotal > 0 && (
              <div className="flex gap-2">
                <input type="number" min={0} step={0.01} value={tendered} onChange={e => setTendered(e.target.value)}
                  placeholder="Cash tendered"
                  className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/20 tabular-nums focus:outline-none focus:border-[var(--color-saffron)]" />
                {change !== null && tendered !== "" && (
                  <span className={`text-sm font-bold tabular-nums px-3 py-2 rounded-xl ${change >= 0 ? "bg-[var(--color-success)]/15 text-[var(--color-success)]" : "bg-[var(--color-danger)]/15 text-[var(--color-danger)]"}`}>
                    {change >= 0 ? fmt(change) : `-${fmt(Math.abs(change))}`}
                  </span>
                )}
              </div>
            )}

            {/* NIP */}
            <div>
              <input type="text" value={buyerNip} onChange={e => setBuyerNip(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="NIP (B2B receipt)"
                className={`w-full bg-white/[0.05] border rounded-xl px-3.5 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none transition ${nipStatus === "valid" ? "border-[var(--color-success)]/40 focus:border-[var(--color-success)]" : nipStatus === "invalid" ? "border-[var(--color-danger)]/40 focus:border-[var(--color-danger)]" : "border-white/[0.08] focus:border-[var(--color-saffron)]"}`} />
              {nipStatus === "valid" && <p className="text-[10px] text-[var(--color-success)] mt-1 pl-1">✓ Valid NIP</p>}
              {nipStatus === "invalid" && <p className="text-[10px] text-[var(--color-danger)] mt-1 pl-1">✗ Invalid checksum</p>}
            </div>

            {/* Primary payment */}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => handlePay("CASH")}
                disabled={cart.length === 0 || paying || nipStatus === "invalid"}
                className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[var(--color-success)] hover:bg-[var(--color-success)]/90 text-white font-bold text-sm transition disabled:opacity-40 active:scale-95">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75" /></svg>
                {paying ? "…" : "Cash"}
              </button>
              <button type="button" onClick={() => handlePay("CARD")}
                disabled={cart.length === 0 || paying || nipStatus === "invalid"}
                className="flex items-center justify-center gap-2 py-3.5 rounded-xl text-white font-bold text-sm transition disabled:opacity-40 active:scale-95"
                style={{ background: "linear-gradient(145deg,var(--color-saffron),var(--color-saffron-dark))" }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>
                {paying ? "…" : "Card"}
              </button>
            </div>

            {/* Secondary */}
            <div className="flex gap-2">
              <button type="button" onClick={() => { setPayLegs([{ method: "CASH", amount: "" }]); setShowPayModal(true); }}
                disabled={cart.length === 0 || nipStatus === "invalid"}
                className="flex-1 py-2 rounded-xl border border-white/[0.08] text-white/40 hover:text-white/60 hover:border-white/[0.14] text-xs font-medium transition disabled:opacity-30">
                Split payment
              </button>
              <button type="button" onClick={handleInitiateQr}
                disabled={cart.length === 0 || qrBusy || nipStatus === "invalid"}
                className="flex-1 py-2 rounded-xl border border-white/[0.08] text-white/40 hover:text-white/60 hover:border-white/[0.14] text-xs font-medium transition disabled:opacity-30">
                {qrBusy ? "…" : "BLIK / QR"}
              </button>
            </div>

            {cart.length > 0 && (
              <button type="button" onClick={() => setCart([])}
                className="w-full py-1 text-[11px] text-white/20 hover:text-white/35 transition">
                Clear order
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
