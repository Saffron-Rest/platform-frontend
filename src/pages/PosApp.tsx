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
  type PosOrder,
  type PosMenuItem,
  type PosQrTransaction,
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
  const [tip, setTip] = useState(0);
  const [showParkModal, setShowParkModal] = useState(false);
  const [parkNote, setParkNote] = useState("");
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashType, setCashType] = useState<"IN" | "OUT">("OUT");
  const [cashAmount, setCashAmount] = useState("");
  const [cashReason, setCashReason] = useState("OTHER");
  const [cashNote, setCashNote] = useState("");
  const [cashBusy, setCashBusy] = useState(false);
  const [barcodeBuffer, setBarcodeBuffer] = useState("");
  // Discount
  const [showDiscountDrawer, setShowDiscountDrawer] = useState(false);
  const [discountType, setDiscountType] = useState<"ITEM" | "ORDER">("ORDER");
  const [discountValue, setDiscountValue] = useState("");
  const [discountIsPct, setDiscountIsPct] = useState(true);
  const [discountLineId, setDiscountLineId] = useState<string | null>(null);
  const [discountBusy, setDiscountBusy] = useState(false);
  // Order form (delivery)
  const [orderType, setOrderType] = useState<"DINE_IN" | "TAKEAWAY" | "DELIVERY">("DINE_IN");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [showOrderForm, setShowOrderForm] = useState(false);
  // QR / BLIK
  const [qrTx, setQrTx] = useState<PosQrTransaction | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrBusy, setQrBusy] = useState(false);
  // Multi-currency
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState("PLN");
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  // Combined payment
  const [showPayModal, setShowPayModal] = useState(false);
  const [payLegs, setPayLegs] = useState<Array<{ method: string; amount: string }>>([{ method: "CASH", amount: "" }]);
  const [payBusy, setPayBusy] = useState(false);
  // Open bills sidebar
  const [showOpenBills, setShowOpenBills] = useState(false);
  const [openOrders, setOpenOrders] = useState<PosOrder[]>([]);

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
  const paymentTotal = cartTotal + tip;
  const change = tendered ? Number(tendered) - paymentTotal : null;
  const nipStatus = buyerNip.length === 0 ? "empty" : nipValid(buyerNip) ? "valid" : "invalid";

  // ── Barcode scanner ───────────────────────────────────────────────────────
  // Scanner devices type the barcode as keyboard input + Enter.
  // We intercept keydown globally while in menu view, buffer chars, then
  // fire the lookup on Enter.
  useEffect(() => {
    if (view !== "menu") return;
    const onKey = async (e: KeyboardEvent) => {
      if (e.key === "Enter" && barcodeBuffer.length >= 3) {
        const code = barcodeBuffer;
        setBarcodeBuffer("");
        const item = await searchByBarcode(code);
        if (item) {
          addToCart(item);
          setError("");
        } else {
          setError(`No item found for barcode: ${code}`);
        }
      } else if (e.key.length === 1) {
        setBarcodeBuffer((prev) => prev + e.key);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, barcodeBuffer]);

  // Clear buffer when switching away from menu
  useEffect(() => { if (view !== "menu") setBarcodeBuffer(""); }, [view]);

  // ── Park bill ─────────────────────────────────────────────────────────────
  const handlePark = async () => {
    if (!activeOrder) return;
    try {
      await parkOrder(activeOrder.id, parkNote.trim() || undefined);
      setActiveOrder(null);
      setCart([]);
      setSelectedTable(null);
      setParkNote("");
      setShowParkModal(false);
      setView("tables");
      const updated = await getPosTables();
      setTables(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Park failed");
      setShowParkModal(false);
    }
  };

  // ── Cash drawer ───────────────────────────────────────────────────────────
  const handleCashMovement = async () => {
    if (!session || session === "loading" || !cashAmount) return;
    setCashBusy(true);
    try {
      await recordCashMovement({
        sessionId: session.id,
        type: cashType,
        reason: cashReason,
        amount: Number(cashAmount),
        note: cashNote.trim() || undefined,
      });
      setCashAmount("");
      setCashNote("");
      setShowCashModal(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cash movement failed");
    } finally {
      setCashBusy(false);
    }
  };

  // ── Open bills ────────────────────────────────────────────────────────────
  const loadOpenOrders = useCallback(async () => {
    try { setOpenOrders(await getOpenOrders()); } catch { /* non-fatal */ }
  }, []);

  useEffect(() => { if (showOpenBills) loadOpenOrders(); }, [showOpenBills, loadOpenOrders]);

  // ── Discount ──────────────────────────────────────────────────────────────
  const handleApplyDiscount = async () => {
    if (!activeOrder || !discountValue) return;
    setDiscountBusy(true);
    try {
      const updated = await applyDiscount(activeOrder.id, {
        type: discountType,
        lineId: discountType === "ITEM" ? (discountLineId ?? undefined) : undefined,
        value: Number(discountValue),
        isPercentage: discountIsPct,
      });
      setActiveOrder(updated);
      setShowDiscountDrawer(false);
      setDiscountValue("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Discount failed");
    } finally {
      setDiscountBusy(false);
    }
  };

  const handleClearDiscount = useCallback(async () => {
    if (!activeOrder) return;
    try {
      const updated = await clearDiscount(activeOrder.id);
      setActiveOrder(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to clear discount");
    }
  }, [activeOrder]);

  // ── Combined payment ──────────────────────────────────────────────────────
  const legTotal = payLegs.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const legRemaining = paymentTotal - legTotal;

  const handlePayMulti = async () => {
    if (nipStatus === "invalid") { setError("NIP is invalid"); return; }
    setPayBusy(true);
    setError("");
    try {
      let order = activeOrder;
      if (!order) {
        order = await createOrder({
          tableId: selectedTable?.id,
          orderType,
          customerName: customerName.trim() || undefined,
          customerPhone: customerPhone.trim() || undefined,
          deliveryAddress: deliveryAddress.trim() || undefined,
          specialRequests: specialRequests.trim() || undefined,
          covers: covers ? Number(covers) : undefined,
          orderNote: orderNote.trim() || undefined,
          lines: cart.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity })),
        });
      }
      const paid = await payOrderMulti(order.id, {
        payments: payLegs.map((l) => ({ method: l.method, amount: Number(l.amount) })),
        tipAmount: tip > 0 ? tip : undefined,
        buyerNip: buyerNip.trim() || undefined,
      });
      setActiveOrder(paid);
      setCart([]);
      setBuyerNip("");
      setTendered("");
      setTip(0);
      setPayLegs([{ method: "CASH", amount: "" }]);
      setShowPayModal(false);
      setView("tables");
      const updated = await getPosTables();
      setTables(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setPayBusy(false);
    }
  };

  // ── QR / BLIK ────────────────────────────────────────────────────────────
  const handleInitiateQr = async () => {
    if (!activeOrder) return;
    setQrBusy(true);
    try {
      const tx = await initiateQrPayment(activeOrder.id, selectedCurrency);
      setQrTx(tx);
      setShowQrModal(true);
      // Start polling
      const poll = setInterval(async () => {
        try {
          const updated = await getQrStatus(tx.id);
          setQrTx(updated);
          if (updated.status === "CONFIRMED") {
            clearInterval(poll);
            setShowQrModal(false);
            setCart([]);
            setTip(0);
            setView("tables");
            const tbl = await getPosTables();
            setTables(tbl);
          } else if (updated.status === "EXPIRED" || updated.status === "CANCELLED") {
            clearInterval(poll);
          }
        } catch { clearInterval(poll); }
      }, 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "QR payment failed");
    } finally {
      setQrBusy(false);
    }
  };

  // ── Exchange rates ────────────────────────────────────────────────────────
  useEffect(() => {
    getExchangeRates().then(setRates).catch(() => {});
  }, []);

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
        tipAmount: tip > 0 ? tip : undefined,
      });
      setActiveOrder(paid);
      setCart([]);
      setBuyerNip("");
      setTendered("");
      setTip(0);
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

      {/* Park bill modal */}
      {showParkModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[var(--color-ink)] border border-white/10 rounded-2xl p-6 space-y-4 text-white">
            <h2 className="text-lg font-bold">Park bill</h2>
            <p className="text-sm text-white/60">The order will be saved. Tap the table again to resume it.</p>
            <label className="block text-sm text-white/50">
              Note (optional)
              <input
                type="text"
                value={parkNote}
                onChange={(e) => setParkNote(e.target.value)}
                placeholder="e.g. Waiting for dessert"
                className="mt-1 w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-[var(--color-saffron)]"
                autoFocus
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="ghost" onClick={() => setShowParkModal(false)}>Cancel</Button>
              <Button onClick={handlePark} className="!bg-amber-500 hover:!bg-amber-600">Park bill</Button>
            </div>
          </div>
        </div>
      )}

      {/* Cash drawer modal */}
      {showCashModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[var(--color-ink)] border border-white/10 rounded-2xl p-6 space-y-4 text-white">
            <h2 className="text-lg font-bold">Cash drawer</h2>
            <div className="grid grid-cols-2 gap-2">
              {(["OUT", "IN"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setCashType(t)}
                  className={`py-2.5 rounded-xl font-semibold text-sm border-2 transition ${
                    cashType === t
                      ? t === "OUT" ? "bg-red-500/30 border-red-400 text-red-300" : "bg-emerald-500/30 border-emerald-400 text-emerald-300"
                      : "bg-white/5 border-white/20 text-white/50"
                  }`}
                >
                  {t === "OUT" ? "− Withdrawal" : "+ Deposit"}
                </button>
              ))}
            </div>
            <label className="block text-sm text-white/50">
              Amount (PLN)
              <input
                type="number"
                min={0.01}
                step={0.01}
                value={cashAmount}
                onChange={(e) => setCashAmount(e.target.value)}
                className="mt-1 w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-[var(--color-saffron)]"
                autoFocus
              />
            </label>
            <label className="block text-sm text-white/50">
              Reason
              <select
                value={cashReason}
                onChange={(e) => setCashReason(e.target.value)}
                className="mt-1 w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none"
              >
                <option value="BANK_DEPOSIT">Bank deposit</option>
                <option value="SUPPLIER_PAYMENT">Supplier payment</option>
                <option value="PETTY_CASH">Petty cash</option>
                <option value="CHANGE_FUND">Change fund</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <label className="block text-sm text-white/50">
              Note (optional)
              <input
                type="text"
                value={cashNote}
                onChange={(e) => setCashNote(e.target.value)}
                placeholder="e.g. Invoice #456"
                className="mt-1 w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="ghost" onClick={() => setShowCashModal(false)}>Cancel</Button>
              <Button onClick={handleCashMovement} disabled={!cashAmount || cashBusy}>
                {cashBusy ? "Saving…" : "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Discount drawer */}
      {showDiscountDrawer && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md bg-[var(--color-ink)] border border-white/10 rounded-2xl p-6 space-y-4 text-white">
            <h2 className="text-lg font-bold">Apply Discount</h2>
            <div className="grid grid-cols-2 gap-2">
              {(["ORDER", "ITEM"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setDiscountType(t)}
                  className={`py-2 rounded-xl font-semibold text-sm border-2 ${discountType === t ? "bg-[var(--color-saffron)] border-[var(--color-saffron)]" : "bg-white/5 border-white/20 text-white/60"}`}>
                  {t === "ORDER" ? "Whole order" : "Single item"}
                </button>
              ))}
            </div>
            {discountType === "ITEM" && activeOrder && (
              <div className="space-y-1">
                <p className="text-xs text-white/50">Select item</p>
                {activeOrder.lines.map((l) => (
                  <button key={l.id} type="button" onClick={() => setDiscountLineId(l.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm border ${discountLineId === l.id ? "border-[var(--color-saffron)] bg-[var(--color-saffron)]/15" : "border-white/10 bg-white/5"}`}>
                    {l.quantity}× {l.itemName} — {fmt(l.lineGross ?? l.unitPrice * l.quantity)}
                  </button>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {(["true", "false"] as const).map((p) => (
                <button key={p} type="button" onClick={() => setDiscountIsPct(p === "true")}
                  className={`py-2 rounded-xl font-semibold text-sm border-2 ${discountIsPct === (p === "true") ? "bg-white/20 border-white/40" : "bg-white/5 border-white/10 text-white/50"}`}>
                  {p === "true" ? "Percentage %" : "Fixed PLN"}
                </button>
              ))}
            </div>
            <label className="block text-sm text-white/50">
              {discountIsPct ? "Discount %" : "Discount amount (PLN)"}
              <input type="number" min={0} max={discountIsPct ? 100 : undefined} step={discountIsPct ? 1 : 0.01}
                value={discountValue} onChange={(e) => setDiscountValue(e.target.value)}
                autoFocus
                className="mt-1 w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-[var(--color-saffron)]" />
            </label>
            {discountValue && (
              <p className="text-sm text-[var(--color-saffron)]">
                Saving: {fmt(discountIsPct ? cartTotal * Number(discountValue) / 100 : Number(discountValue))}
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setShowDiscountDrawer(false)} className="flex-1">Cancel</Button>
              <button type="button" onClick={() => { handleClearDiscount(); setShowDiscountDrawer(false); }}
                className="text-xs text-red-400 hover:text-red-300 px-3">Clear</button>
              <Button onClick={handleApplyDiscount} disabled={!discountValue || discountBusy || (discountType === "ITEM" && !discountLineId)} className="flex-1">
                {discountBusy ? "Applying…" : "Apply"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Combined payment modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[var(--color-ink)] border border-white/10 rounded-2xl p-6 space-y-4 text-white">
            <h2 className="text-lg font-bold">Payment methods</h2>
            <div className="text-sm text-white/60 flex justify-between">
              <span>Total to pay</span>
              <span className="font-bold text-[var(--color-saffron)]">{fmt(paymentTotal)}</span>
            </div>
            {payLegs.map((leg, i) => (
              <div key={i} className="flex gap-2 items-center">
                <select value={leg.method} onChange={(e) => setPayLegs((prev) => prev.map((l, j) => j === i ? { ...l, method: e.target.value } : l))}
                  className="bg-white/10 border border-white/20 rounded-lg px-2 py-2 text-sm text-white flex-shrink-0">
                  {["CASH", "CARD", "VOUCHER", "BANK_TRANSFER", "OTHER"].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <input type="number" min={0} step={0.01} placeholder="Amount"
                  value={leg.amount}
                  onChange={(e) => {
                    const v = e.target.value;
                    setPayLegs((prev) => prev.map((l, j) => j === i ? { ...l, amount: v } : l));
                  }}
                  className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
                {payLegs.length > 1 && (
                  <button type="button" onClick={() => setPayLegs((p) => p.filter((_, j) => j !== i))} className="text-red-400 px-1">×</button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => setPayLegs((p) => [...p, { method: "CARD", amount: legRemaining > 0 ? String(Math.round(legRemaining * 100) / 100) : "" }])}
              className="text-xs text-[var(--color-saffron-dark)] hover:underline">
              + Add another method
            </button>
            <div className={`flex justify-between text-sm font-semibold rounded-lg px-3 py-2 ${legRemaining <= 0.005 ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>
              <span>{legRemaining <= 0.005 ? "✓ Fully covered" : "Remaining"}</span>
              <span>{legRemaining > 0.005 ? fmt(legRemaining) : "0.00"}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="ghost" onClick={() => setShowPayModal(false)}>Cancel</Button>
              <Button onClick={handlePayMulti} disabled={legRemaining > 0.005 || payBusy || cart.length === 0}>
                {payBusy ? "Processing…" : "Confirm payment"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Open bills sidebar */}
      {showOpenBills && (
        <div className="fixed inset-y-0 left-0 z-50 w-72 bg-[var(--color-ink)] border-r border-white/10 flex flex-col text-white shadow-2xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <h3 className="font-bold">Open Bills ({openOrders.length})</h3>
            <button type="button" onClick={() => setShowOpenBills(false)} className="text-white/50 hover:text-white text-xl">×</button>
          </div>
          <div className="flex-1 overflow-auto">
            {openOrders.length === 0 ? (
              <p className="text-white/30 text-center py-8 text-sm">No open bills</p>
            ) : (
              openOrders.map((o) => {
                const tbl = tables.find((t) => t.id === o.tableId);
                const age = Math.round((Date.now() - new Date(o.openedAt).getTime()) / 60000);
                return (
                  <button key={o.id} type="button"
                    onClick={async () => {
                      if (o.status === "PARKED") await resumeOrder(o.id).catch(() => {});
                      setSelectedTable(tbl ?? null);
                      setView("menu");
                      setShowOpenBills(false);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-white/5 border-b border-white/5">
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-sm">{tbl?.name ?? "Take-away"}</span>
                      <span className="text-xs text-white/40">{age}m ago</span>
                    </div>
                    <div className="flex justify-between mt-0.5">
                      <span className="text-xs text-white/50">{o.lines.length} items · {o.status}</span>
                      <span className="text-sm font-bold text-[var(--color-saffron)]">{fmt(o.totalGross)}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
          <div className="px-4 py-3 border-t border-white/10">
            <Button onClick={loadOpenOrders} variant="ghost" fullWidth className="!text-xs">Refresh</Button>
          </div>
        </div>
      )}

      {/* Order form modal (delivery) */}
      {showOrderForm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[var(--color-ink)] border border-white/10 rounded-2xl p-6 space-y-4 text-white">
            <h2 className="text-lg font-bold">Order details</h2>
            <div className="grid grid-cols-3 gap-2">
              {(["DINE_IN", "TAKEAWAY", "DELIVERY"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setOrderType(t)}
                  className={`py-2 rounded-xl text-xs font-semibold border-2 ${orderType === t ? "bg-[var(--color-saffron)] border-[var(--color-saffron)]" : "bg-white/5 border-white/20 text-white/60"}`}>
                  {t === "DINE_IN" ? "Dine-in" : t === "TAKEAWAY" ? "Takeaway" : "Delivery"}
                </button>
              ))}
            </div>
            <label className="block text-sm text-white/50">Customer name{orderType === "DELIVERY" && " *"}
              <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Jan Kowalski"
                className="mt-1 w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none" />
            </label>
            <label className="block text-sm text-white/50">Phone
              <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="+48 500 123 456"
                className="mt-1 w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none" />
            </label>
            {orderType === "DELIVERY" && (
              <label className="block text-sm text-white/50">Delivery address *
                <input type="text" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="ul. Marszałkowska 1, Warszawa"
                  className="mt-1 w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none" />
              </label>
            )}
            <label className="block text-sm text-white/50">Special requests
              <textarea value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)} placeholder="Allergens, no onion, extra sauce…" rows={2}
                className="mt-1 w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none resize-none" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="ghost" onClick={() => setShowOrderForm(false)}>Cancel</Button>
              <Button onClick={() => setShowOrderForm(false)}>Save</Button>
            </div>
          </div>
        </div>
      )}

      {/* QR / BLIK modal */}
      {showQrModal && qrTx && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-[var(--color-ink)] border border-white/10 rounded-2xl p-6 space-y-4 text-white text-center">
            <h2 className="text-lg font-bold">BLIK / QR Payment</h2>
            <p className="text-white/50 text-sm">Scan with your banking app or enter the code</p>
            {/* QR placeholder — in production replace with <QRCode value={qrTx.qrPayload} /> */}
            <div className="bg-white rounded-xl p-4 mx-auto w-40 h-40 flex items-center justify-center">
              <div className="text-[var(--color-ink)] text-xs text-center break-all">{qrTx.id.slice(0, 12)}…</div>
            </div>
            <p className="text-2xl font-bold text-[var(--color-saffron)]">{fmt(qrTx.amount)}</p>
            <p className={`text-sm font-semibold ${qrTx.status === "CONFIRMED" ? "text-emerald-400" : qrTx.status === "EXPIRED" ? "text-red-400" : "text-amber-300"}`}>
              {qrTx.status === "PENDING" ? "⏳ Waiting for payment…" : qrTx.status === "CONFIRMED" ? "✓ Confirmed!" : qrTx.status}
            </p>
            <button type="button" onClick={async () => {
              if (qrTx) await cancelQrPayment(qrTx.id).catch(() => {});
              setShowQrModal(false);
              setQrTx(null);
            }} className="text-xs text-red-400 hover:text-red-300">Cancel payment</button>
          </div>
        </div>
      )}

      {/* Currency picker */}
      {showCurrencyPicker && rates && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-[var(--color-ink)] border border-white/10 rounded-2xl p-5 space-y-3 text-white">
            <h2 className="font-bold">Select currency</h2>
            {["PLN", "EUR", "USD", "GBP"].map((c) => {
              const rate = rates.rates[c] ?? 1;
              const converted = c === "PLN" ? paymentTotal : paymentTotal / rate;
              return (
                <button key={c} type="button" onClick={() => { setSelectedCurrency(c); setShowCurrencyPicker(false); }}
                  className={`w-full flex justify-between items-center px-4 py-3 rounded-xl border transition ${selectedCurrency === c ? "border-[var(--color-saffron)] bg-[var(--color-saffron)]/15" : "border-white/10 bg-white/5 hover:bg-white/10"}`}>
                  <span className="font-semibold">{c}</span>
                  <div className="text-right">
                    <p className="font-bold">{fmt(converted)} {c}</p>
                    {c !== "PLN" && <p className="text-xs text-white/40">1 {c} = {rate.toFixed(4)} PLN</p>}
                  </div>
                </button>
              );
            })}
            <button type="button" onClick={() => setShowCurrencyPicker(false)} className="w-full text-white/40 text-xs py-1 hover:text-white/60">Cancel</button>
          </div>
        </div>
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
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowOpenBills(true)}
              className="text-xs text-white/50 hover:text-white/80 px-3 py-1.5 rounded-lg border border-white/20 hover:bg-white/5"
            >
              📋 Bills {openOrders.length > 0 && `(${openOrders.length})`}
            </button>
            {cart.length > 0 && activeOrder && (
              <button
                type="button"
                onClick={() => setShowDiscountDrawer(true)}
                className="text-xs text-purple-400 hover:text-purple-300 px-3 py-1.5 rounded-lg border border-purple-400/30 hover:bg-purple-400/10"
              >
                % Discount
              </button>
            )}
            {cart.length > 0 && activeOrder && (
              <button
                type="button"
                onClick={() => setShowParkModal(true)}
                className="text-xs text-amber-400 hover:text-amber-300 px-3 py-1.5 rounded-lg border border-amber-400/30 hover:bg-amber-400/10"
              >
                🅿 Park
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowCashModal(true)}
              className="text-xs text-white/50 hover:text-white/80 px-3 py-1.5 rounded-lg border border-white/20 hover:bg-white/5"
            >
              💵 Cash drawer
            </button>
            <button
              type="button"
              onClick={() => setShowOrderForm(true)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition ${orderType !== "DINE_IN" ? "text-blue-300 border-blue-400/40 bg-blue-400/10" : "text-white/40 border-white/20 hover:bg-white/5"}`}
            >
              {orderType === "DELIVERY" ? "🛵 Delivery" : orderType === "TAKEAWAY" ? "📦 Takeaway" : "📋 Order"}
            </button>
            <button
              type="button"
              onClick={() => window.open("/pos/waiter", "_blank")}
              className="text-xs text-white/40 hover:text-white/70 px-2 py-1.5 rounded-lg hover:bg-white/5 transition"
            >
              🧑‍💼 Waiter
            </button>
            <button
              type="button"
              onClick={() => window.open("/pos/display", "_blank")}
              className="text-xs text-white/40 hover:text-white/70 px-2 py-1.5 rounded-lg hover:bg-white/5 transition"
            >
              🖥 Display
            </button>
            <button
              type="button"
              onClick={() => { window.location.href = "/"; }}
              className="text-xs text-white/40 hover:text-white/70 px-2 py-1.5 rounded-lg hover:bg-white/5 transition"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => setShowCloseModal(true)}
              className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg border border-red-400/30 hover:bg-red-400/10"
            >
              Close Shift
            </button>
          </div>
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
                  onClick={async () => {
                    setSelectedTable(t);
                    if (t.occupied && t.openOrderId) {
                      // Resume the existing order on this table
                      try {
                        const resumed = await resumeOrder(t.openOrderId);
                        setActiveOrder(resumed);
                        setCart(resumed.lines.map((l) => ({
                          menuItemId: l.menuItemId ?? l.id,
                          itemName: l.itemName,
                          unitPrice: l.unitPrice,
                          vatRatePct: l.vatRatePct,
                          quantity: l.quantity,
                        })));
                      } catch {
                        // Order might already be OPEN, just navigate
                      }
                    }
                    setView("menu");
                  }}
                  className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 text-sm font-semibold border-2 transition active:scale-95 ${
                    t.occupied
                      ? "bg-amber-500/20 border-amber-400/50 text-amber-300 hover:bg-amber-500/30"
                      : "bg-emerald-500/10 border-emerald-400/30 text-emerald-300 hover:bg-emerald-500/20"
                  } ${selectedTable?.id === t.id ? "ring-2 ring-[var(--color-saffron)]" : ""}`}
                >
                  <span>{t.name}</span>
                  <span className="text-[10px] font-normal opacity-60">{t.seats} 👤</span>
                  {t.occupied && <span className="text-[9px] text-amber-400">🅿</span>}
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
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[var(--color-saffron)] font-bold text-sm">{fmt(item.sellPrice)}</span>
                      {item.isHappyHour && item.originalPrice && item.originalPrice !== item.sellPrice && (
                        <span className="text-white/40 text-xs line-through">{fmt(item.originalPrice)}</span>
                      )}
                    </div>
                    {item.isHappyHour && (
                      <span className="text-[10px] bg-amber-500/30 text-amber-300 px-1.5 py-0.5 rounded-full mt-0.5 block">
                        ⚡ {item.happyHourName ?? "Happy Hour"} until {item.happyHourEnds}
                      </span>
                    )}
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
              <span>Bill</span>
              <span>{fmt(cartTotal)}</span>
            </div>
          </div>

          {/* Tip selector */}
          <div className="space-y-1.5">
            <p className="text-xs text-white/40 uppercase tracking-wider">Tip</p>
            <div className="grid grid-cols-4 gap-1">
              {[0, 5, 10, 15].map((pct) => {
                const tipVal = pct === 0 ? 0 : Math.round(cartTotal * pct) / 100;
                return (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setTip(tipVal)}
                    className={`py-1.5 rounded-lg text-xs font-semibold border transition ${
                      tip === tipVal
                        ? "bg-[var(--color-saffron)] border-[var(--color-saffron)] text-white"
                        : "bg-white/5 border-white/15 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    {pct === 0 ? "No tip" : `+${pct}%`}
                  </button>
                );
              })}
            </div>
            {tip > 0 && (
              <div className="flex justify-between text-xs text-white/50">
                <span>Tip</span><span>+{fmt(tip)}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-white/10 pt-1.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg">To pay</span>
                {rates && (
                  <button type="button" onClick={() => setShowCurrencyPicker(true)}
                    className="text-xs px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-white/60">
                    {selectedCurrency} ▾
                  </button>
                )}
              </div>
              <div className="text-right">
                <span className="font-bold text-lg text-[var(--color-saffron)]">
                  {selectedCurrency === "PLN" || !rates
                    ? fmt(paymentTotal)
                    : `${(paymentTotal / (rates.rates[selectedCurrency] ?? 1)).toFixed(2)} ${selectedCurrency}`}
                </span>
                {selectedCurrency !== "PLN" && rates && (
                  <p className="text-[10px] text-white/40">{fmt(paymentTotal)} PLN</p>
                )}
              </div>
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
          <button
            type="button"
            onClick={() => {
              setPayLegs([{ method: "CASH", amount: "" }]);
              setShowPayModal(true);
            }}
            disabled={cart.length === 0 || nipStatus === "invalid"}
            className="w-full py-2 text-xs font-medium text-[var(--color-saffron-dark)] hover:underline disabled:opacity-30"
          >
            Split / combined payment →
          </button>
          <button
            type="button"
            onClick={handleInitiateQr}
            disabled={cart.length === 0 || qrBusy || nipStatus === "invalid"}
            className="w-full py-2 text-xs font-medium text-white/50 hover:text-white/80 disabled:opacity-30 border border-white/10 rounded-lg hover:bg-white/5 transition"
          >
            {qrBusy ? "Generating QR…" : "📱 BLIK / QR code payment"}
          </button>

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
