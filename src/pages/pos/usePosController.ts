import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addLine,
  applyDiscount,
  clearDiscount,
  createOrder,
  getCurrentSession,
  getExchangeRates,
  getOpenOrders,
  getPosMenu,
  getPosTables,
  getQrStatus,
  initiateQrPayment,
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
} from "../../api/pos";
import { emptyDraft, type CartLine, type OrderDraft, type PosScreen } from "./types";
import { cartTotals, nipValid } from "./utils";

export function usePosController() {
  const [session, setSession] = useState<PosSession | null | "loading">("loading");
  const [menu, setMenu] = useState<PosMenuItem[]>([]);
  const [tables, setTables] = useState<PosTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [screen, setScreen] = useState<PosScreen>("hub");
  const [draft, setDraft] = useState<OrderDraft>(emptyDraft);
  const [openOrders, setOpenOrders] = useState<PosOrder[]>([]);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [menuSearch, setMenuSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  const [tip, setTip] = useState(0);
  const [buyerNip, setBuyerNip] = useState("");
  const [tendered, setTendered] = useState("");
  const [paying, setPaying] = useState(false);
  const [payBusy, setPayBusy] = useState(false);
  const [payLegs, setPayLegs] = useState([{ method: "CASH", amount: "" }]);
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState("PLN");
  const [qrTx, setQrTx] = useState<PosQrTransaction | null>(null);
  const [qrBusy, setQrBusy] = useState(false);
  const [barcodeBuffer, setBarcodeBuffer] = useState("");

  const [modal, setModal] = useState<
    | null
    | "open-register"
    | "close-shift"
    | "cash"
    | "park"
    | "discount"
    | "order-details"
    | "split-pay"
    | "qr"
    | "currency"
  >(null);
  const [parkNote, setParkNote] = useState("");
  const [cashType, setCashType] = useState<"IN" | "OUT">("OUT");
  const [cashAmount, setCashAmount] = useState("");
  const [cashReason, setCashReason] = useState("OTHER");
  const [cashNote, setCashNote] = useState("");
  const [cashBusy, setCashBusy] = useState(false);
  const [discountType, setDiscountType] = useState<"ITEM" | "ORDER">("ORDER");
  const [discountValue, setDiscountValue] = useState("");
  const [discountIsPct, setDiscountIsPct] = useState(true);
  const [discountLineId, setDiscountLineId] = useState<string | null>(null);
  const [discountBusy, setDiscountBusy] = useState(false);

  const patchDraft = useCallback((p: Partial<OrderDraft>) => setDraft(d => ({ ...d, ...p })), []);

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
    getCurrentSession().then(setSession).catch(() => setSession(null));
    loadData().finally(() => setLoading(false));
    getExchangeRates().then(setRates).catch(() => {});
    const id = setInterval(() => getPosTables().then(setTables).catch(() => {}), 30_000);
    return () => clearInterval(id);
  }, [loadData]);

  const categories = useMemo(() => {
    const seen = new Map<string, { name: string; sortOrder: number }>();
    menu.forEach(i => {
      if (!seen.has(i.categoryId)) seen.set(i.categoryId, { name: i.categoryName, sortOrder: i.categorySortOrder });
    });
    return [...seen.entries()]
      .sort((a, b) => a[1].sortOrder - b[1].sortOrder)
      .map(([id, { name }]) => ({ id, name }));
  }, [menu]);

  const filteredMenu = useMemo(() => {
    let items = activeCat ? menu.filter(i => i.categoryId === activeCat) : menu;
    const q = menuSearch.trim().toLowerCase();
    if (q) items = items.filter(i => i.name.toLowerCase().includes(q) || (i.sku ?? "").toLowerCase().includes(q));
    return items;
  }, [menu, activeCat, menuSearch]);

  const areas = useMemo(() => {
    const s = new Set<string>();
    tables.forEach(t => {
      if (t.area) s.add(t.area);
    });
    return [...s].sort();
  }, [tables]);

  const filteredTables = areaFilter ? tables.filter(t => t.area === areaFilter) : tables;
  const totals = cartTotals(draft.cart, tip);
  const nipStatus = buyerNip.length === 0 ? "empty" : nipValid(buyerNip) ? "valid" : "invalid";
  const legTotal = payLegs.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const legRemaining = totals.total - legTotal;
  const change = tendered ? Number(tendered) - totals.total : null;

  const goHub = useCallback(() => {
    setScreen("hub");
    setDraft(emptyDraft());
    setTip(0);
    setBuyerNip("");
    setTendered("");
    setMenuSearch("");
    setActiveCat(null);
    setError("");
  }, []);

  const addToCart = useCallback((item: PosMenuItem) => {
    setDraft(d => {
      const ex = d.cart.find(l => l.menuItemId === item.id);
      const cart: CartLine[] = ex
        ? d.cart.map(l => (l.menuItemId === item.id ? { ...l, quantity: l.quantity + 1 } : l))
        : [...d.cart, { menuItemId: item.id, itemName: item.name, unitPrice: item.sellPrice, vatRatePct: item.vatRatePct, quantity: 1 }];
      return { ...d, cart };
    });
  }, []);

  const adjustQty = useCallback((menuItemId: string, delta: number) => {
    setDraft(d => ({
      ...d,
      cart: d.cart
        .map(l => (l.menuItemId === menuItemId ? { ...l, quantity: l.quantity + delta } : l))
        .filter(l => l.quantity > 0),
    }));
  }, []);

  const loadOpenOrders = useCallback(async () => {
    try {
      setOpenOrders(await getOpenOrders());
    } catch {
      /* ignore */
    }
  }, []);

  const startQuickSale = useCallback(() => {
    setDraft({ ...emptyDraft(), orderType: "TAKEAWAY" });
    setScreen("order");
  }, []);

  const startDelivery = useCallback(() => {
    setDraft({ ...emptyDraft(), orderType: "DELIVERY" });
    setScreen("delivery");
  }, []);

  const startTableService = useCallback(() => {
    setDraft({ ...emptyDraft(), orderType: "DINE_IN" });
    setScreen("tables");
  }, []);

  const selectTable = useCallback(
    async (table: PosTable) => {
      const next: OrderDraft = { ...emptyDraft(), orderType: "DINE_IN", table };
      if (table.occupied && table.openOrderId) {
        try {
          const order = await resumeOrder(table.openOrderId);
          next.activeOrder = order;
          next.cart = order.lines.map(l => ({
            menuItemId: l.menuItemId ?? l.id,
            itemName: l.itemName,
            unitPrice: l.unitPrice,
            vatRatePct: l.vatRatePct,
            quantity: l.quantity,
          }));
          next.orderType = order.orderType as OrderDraft["orderType"];
          next.covers = order.covers ? String(order.covers) : "";
          next.orderNote = order.orderNote ?? "";
        } catch {
          /* continue with empty cart */
        }
      }
      setDraft(next);
      setScreen("order");
    },
    [],
  );

  const resumeOpenOrder = useCallback(async (order: PosOrder) => {
    const tbl = tables.find(t => t.id === order.tableId) ?? null;
    if (order.status === "PARKED") await resumeOrder(order.id).catch(() => {});
    setDraft({
      ...emptyDraft(),
      table: tbl,
      orderType: (order.orderType as OrderDraft["orderType"]) || "DINE_IN",
      activeOrder: order,
      cart: order.lines.map(l => ({
        menuItemId: l.menuItemId ?? l.id,
        itemName: l.itemName,
        unitPrice: l.unitPrice,
        vatRatePct: l.vatRatePct,
        quantity: l.quantity,
      })),
      customerName: order.customerName ?? "",
      customerPhone: order.customerPhone ?? "",
      deliveryAddress: order.deliveryAddress ?? "",
      specialRequests: order.specialRequests ?? "",
      covers: order.covers ? String(order.covers) : "",
      orderNote: order.orderNote ?? "",
    });
    setScreen("order");
  }, [tables]);

  const mkOrder = useCallback(async () => {
    if (draft.activeOrder) return draft.activeOrder;
    return createOrder({
      tableId: draft.table?.id,
      orderType: draft.orderType,
      customerName: draft.customerName.trim() || undefined,
      customerPhone: draft.customerPhone.trim() || undefined,
      deliveryAddress: draft.deliveryAddress.trim() || undefined,
      specialRequests: draft.specialRequests.trim() || undefined,
      covers: draft.covers ? Number(draft.covers) : undefined,
      orderNote: draft.orderNote.trim() || undefined,
      lines: draft.cart.map(l => ({ menuItemId: l.menuItemId, quantity: l.quantity })),
    });
  }, [draft]);

  const goCheckout = useCallback(() => {
    if (draft.cart.length === 0) return;
    setScreen("checkout");
  }, [draft.cart.length]);

  const afterPayment = useCallback(async () => {
    setTables(await getPosTables());
    goHub();
  }, [goHub]);

  const syncLinesAndPay = useCallback(
    async (pay: (orderId: string) => Promise<PosOrder>) => {
      if (nipStatus === "invalid") {
        setError("Invalid NIP");
        return;
      }
      const hadOrder = !!draft.activeOrder;
      setPaying(true);
      setError("");
      try {
        let order = await mkOrder();
        if (hadOrder) {
          for (const l of draft.cart) {
            order = await addLine(order.id, { menuItemId: l.menuItemId, quantity: l.quantity });
          }
        }
        await pay(order.id);
        await afterPayment();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Payment failed");
      } finally {
        setPaying(false);
      }
    },
    [nipStatus, mkOrder, draft.activeOrder, draft.cart, afterPayment],
  );

  const payCash = useCallback(
    () =>
      syncLinesAndPay(id =>
        payOrder(id, {
          paymentMethod: "CASH",
          amountTendered: tendered ? Number(tendered) : undefined,
          tipAmount: tip > 0 ? tip : undefined,
          buyerNip: buyerNip.trim() || undefined,
        }),
      ),
    [syncLinesAndPay, tendered, tip, buyerNip],
  );

  const payCard = useCallback(
    () =>
      syncLinesAndPay(id =>
        payOrder(id, {
          paymentMethod: "CARD",
          tipAmount: tip > 0 ? tip : undefined,
          buyerNip: buyerNip.trim() || undefined,
        }),
      ),
    [syncLinesAndPay, tip, buyerNip],
  );

  /** Generic single-method payment — handles Card, BLIK, Wolt, Bolt, Glovo, Uber Eats, etc. */
  const payMethod = useCallback(
    (method: string, amountTendered?: number) =>
      syncLinesAndPay(id =>
        payOrder(id, {
          paymentMethod: method,
          amountTendered: amountTendered,
          tipAmount: tip > 0 ? tip : undefined,
          buyerNip: buyerNip.trim() || undefined,
        }),
      ),
    [syncLinesAndPay, tip, buyerNip],
  );

  const payMulti = useCallback(async () => {
    if (nipStatus === "invalid") {
      setError("Invalid NIP");
      return;
    }
    setPayBusy(true);
    setError("");
    try {
      const order = await mkOrder();
      await payOrderMulti(order.id, {
        payments: payLegs.map(l => ({ method: l.method, amount: Number(l.amount) })),
        tipAmount: tip > 0 ? tip : undefined,
        buyerNip: buyerNip.trim() || undefined,
      });
      setModal(null);
      setPayLegs([{ method: "CASH", amount: "" }]);
      await afterPayment();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setPayBusy(false);
    }
  }, [nipStatus, mkOrder, payLegs, tip, buyerNip, afterPayment]);

  const parkBill = useCallback(async () => {
    setError("");
    try {
      const hadOrder = !!draft.activeOrder;
      let order = await mkOrder();
      if (hadOrder) {
        for (const l of draft.cart) {
          order = await addLine(order.id, { menuItemId: l.menuItemId, quantity: l.quantity });
        }
      }
      patchDraft({ activeOrder: order });
      await parkOrder(order.id, parkNote.trim() || undefined);
      setModal(null);
      setParkNote("");
      setTables(await getPosTables());
      goHub();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not park bill");
    }
  }, [mkOrder, draft.activeOrder, draft.cart, parkNote, goHub, patchDraft]);

  const handleCashMovement = useCallback(async () => {
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
      setModal(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cash movement failed");
    } finally {
      setCashBusy(false);
    }
  }, [session, cashAmount, cashType, cashReason, cashNote]);

  const applyDiscountFn = useCallback(async () => {
    if (!discountValue) return;
    setDiscountBusy(true);
    try {
      let order = draft.activeOrder;
      if (!order) {
        order = await mkOrder();
        patchDraft({ activeOrder: order });
      }
      const updated = await applyDiscount(order.id, {
        type: discountType,
        lineId: discountType === "ITEM" ? (discountLineId ?? undefined) : undefined,
        value: Number(discountValue),
        isPercentage: discountIsPct,
      });
      patchDraft({ activeOrder: updated });
      setModal(null);
      setDiscountValue("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Discount failed");
    } finally {
      setDiscountBusy(false);
    }
  }, [draft.activeOrder, discountValue, discountType, discountLineId, discountIsPct, patchDraft, mkOrder]);

  const clearDiscountFn = useCallback(async () => {
    if (!draft.activeOrder) return;
    try {
      patchDraft({ activeOrder: await clearDiscount(draft.activeOrder.id) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }, [draft.activeOrder, patchDraft]);

  const startQr = useCallback(async () => {
    setQrBusy(true);
    try {
      const hadOrder = !!draft.activeOrder;
      let order = await mkOrder();
      if (hadOrder) {
        for (const l of draft.cart) {
          order = await addLine(order.id, { menuItemId: l.menuItemId, quantity: l.quantity });
        }
      }
      patchDraft({ activeOrder: order });
      const tx = await initiateQrPayment(order.id, selectedCurrency);
      setQrTx(tx);
      setModal("qr");
      const poll = setInterval(async () => {
        try {
          const u = await getQrStatus(tx.id);
          setQrTx(u);
          if (u.status === "CONFIRMED") {
            clearInterval(poll);
            setModal(null);
            await afterPayment();
          } else if (u.status !== "PENDING") clearInterval(poll);
        } catch {
          clearInterval(poll);
        }
      }, 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "QR payment failed");
    } finally {
      setQrBusy(false);
    }
  }, [mkOrder, draft.activeOrder, draft.cart, selectedCurrency, afterPayment, patchDraft]);

  useEffect(() => {
    if (screen !== "order") return;
    const onKey = async (e: KeyboardEvent) => {
      if (e.key === "Enter" && barcodeBuffer.length >= 3) {
        const code = barcodeBuffer;
        setBarcodeBuffer("");
        const item = await searchByBarcode(code);
        if (item) {
          addToCart(item);
          setError("");
        } else setError(`Barcode not found: ${code}`);
      } else if (e.key.length === 1) setBarcodeBuffer(p => p + e.key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, barcodeBuffer, addToCart]);

  useEffect(() => {
    if (screen !== "order") setBarcodeBuffer("");
  }, [screen]);

  const stepIndex =
    screen === "hub"
      ? -1
      : screen === "tables" || screen === "delivery"
        ? 0
        : screen === "order"
          ? 1
          : screen === "checkout"
            ? 2
            : -1;

  return {
    session,
    setSession,
    menu,
    tables,
    loading,
    error,
    setError,
    screen,
    setScreen,
    draft,
    patchDraft,
    openOrders,
    activeCat,
    setActiveCat,
    menuSearch,
    setMenuSearch,
    areaFilter,
    setAreaFilter,
    tip,
    setTip,
    buyerNip,
    setBuyerNip,
    tendered,
    setTendered,
    paying,
    payBusy,
    payLegs,
    setPayLegs,
    rates,
    selectedCurrency,
    setSelectedCurrency,
    qrTx,
    setQrTx,
    qrBusy,
    modal,
    setModal,
    parkNote,
    setParkNote,
    cashType,
    setCashType,
    cashAmount,
    setCashAmount,
    cashReason,
    setCashReason,
    cashNote,
    setCashNote,
    cashBusy,
    discountType,
    setDiscountType,
    discountValue,
    setDiscountValue,
    discountIsPct,
    setDiscountIsPct,
    discountLineId,
    setDiscountLineId,
    discountBusy,
    categories,
    filteredMenu,
    areas,
    filteredTables,
    totals,
    nipStatus,
    legTotal,
    legRemaining,
    change,
    stepIndex,
    goHub,
    addToCart,
    adjustQty,
    loadOpenOrders,
    startQuickSale,
    startDelivery,
    startTableService,
    selectTable,
    resumeOpenOrder,
    goCheckout,
    payCash,
    payCard,
    payMethod,
    payMulti,
    parkBill,
    handleCashMovement,
    applyDiscountFn,
    clearDiscountFn,
    startQr,
    loadData,
  };
}
