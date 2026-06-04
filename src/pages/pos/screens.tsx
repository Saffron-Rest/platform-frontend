import { useState } from "react";
import { openSession, type PosOrder, type PosSession, type PosTable } from "../../api/pos";
import { fmt } from "../../lib/calc";
import { IconBag, IconList, IconSearch, IconTable, IconTruck } from "./icons";
import type { usePosController } from "./usePosController";
import { orderLabel } from "./utils";
import {
  PosActionCard,
  PosAlert,
  PosBtn,
  PosInput,
  PosLabel,
  PosMoney,
  PosNumpad,
  PosPageChrome,
  PosQtyControl,
  PosRoot,
  PosShell,
  PosSteps,
  PosTextarea,
  PosTopBar,
} from "./ui";

type C = ReturnType<typeof usePosController>;

// ─── Clock (live) ─────────────────────────────────────────────────────────────

function LiveClock() {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
  useState(() => {
    const id = setInterval(() => {
      setTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    }, 10_000);
    return () => clearInterval(id);
  });
  return <span className="pos-clock">{time}</span>;
}

// ─── Session open ──────────────────────────────────────────────────────────────

export function SessionOpenScreen({
  onOpen,
  onLogout,
}: {
  onOpen: (s: PosSession) => void;
  onLogout?: () => void;
}) {
  const [float_, setFloat] = useState("0");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const presets = [0, 100, 200, 500];

  const submit = async () => {
    setBusy(true);
    setErr("");
    try {
      onOpen(await openSession(Number(float_) || 0));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
      setBusy(false);
    }
  };

  return (
    <PosRoot>
      <div className="pos-session-layout">
        {/* Brand side */}
        <div className="pos-session-brand">
          <p style={{ fontSize: "0.8125rem", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600, marginBottom: "1rem", opacity: 0.75 }}>
            Point of sale
          </p>
          <h1>Saffron</h1>
          <p style={{ marginTop: "0.75rem", maxWidth: "18rem", fontSize: "0.9375rem" }}>
            Fast ordering, clear checkout, built for your team.
          </p>
        </div>

        {/* Form side */}
        <div className="pos-session-form-side">
          <div className="pos-card" style={{ width: "100%", maxWidth: "22rem", padding: "2rem" }}>
            <p style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--pos-orange)", marginBottom: "0.25rem" }}>
              Register
            </p>
            <h2 style={{ fontSize: "1.625rem", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "0.25rem" }}>
              Open Register
            </h2>
            <p style={{ color: "var(--pos-muted)", fontSize: "0.875rem", marginBottom: "1.75rem" }}>
              Count your opening float
            </p>

            {err && (
              <p style={{ color: "var(--pos-red)", fontSize: "0.875rem", marginBottom: "1rem" }}>{err}</p>
            )}

            <PosLabel>Opening float (PLN)</PosLabel>
            <PosInput
              type="number"
              min={0}
              value={float_}
              onChange={e => setFloat(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submit()}
              style={{ fontSize: "1.875rem", fontWeight: 800, textAlign: "center", marginBottom: "0.875rem", height: "4rem" }}
              autoFocus
            />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.5rem", marginBottom: "1.5rem" }}>
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

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                style={{ display: "block", width: "100%", textAlign: "center", marginTop: "1rem", fontSize: "0.8125rem", color: "var(--pos-muted)", background: "none", border: "none", cursor: "pointer" }}
              >
                ← Back to PIN
              </button>
            )}
          </div>
        </div>
      </div>
    </PosRoot>
  );
}

// ─── Register chip — topbar button for inner screens ──────────────────────────

function RegisterChip({ c }: { c: C }) {
  const open = c.session !== null && c.session !== "loading";
  return (
    <button
      type="button"
      onClick={() => c.setModal(open ? "close-shift" : "open-register")}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.35rem",
        padding: "0.3rem 0.75rem",
        borderRadius: "999px",
        border: "1.5px solid var(--pos-border-med)",
        background: "var(--pos-surface-2)",
        color: "var(--pos-muted)",
        fontSize: "0.75rem",
        fontWeight: 600,
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
        flexShrink: 0,
        transition: "background 0.12s",
      }}
    >
      {open ? "Close register" : "Open register"}
    </button>
  );
}

// ─── Hub ──────────────────────────────────────────────────────────────────────

export function HubScreen({ c, onLogout }: { c: C; onLogout?: () => void }) {
  const sessionOpen = c.session !== null && c.session !== "loading";
  const busyTables  = c.tables.filter(t => t.occupied).length;
  const freeTables  = c.tables.length - busyTables;

  const shiftMinutes = sessionOpen
    ? Math.round((Date.now() - new Date((c.session as PosSession).openedAt).getTime()) / 60000)
    : 0;
  const shiftLabel = shiftMinutes >= 60
    ? `${Math.floor(shiftMinutes / 60)}h ${shiftMinutes % 60}m`
    : `${shiftMinutes}m`;

  return (
    <PosRoot>
      <PosShell>
        {/* Header */}
        <header style={{ display: "flex", alignItems: "center", gap: "0.75rem", height: "var(--pos-topbar-h)", padding: "0 1rem", background: "var(--pos-surface)", borderBottom: "1px solid var(--pos-border)", flexShrink: 0 }}>
          <div style={{ width: "2.25rem", height: "2.25rem", borderRadius: "0.75rem", background: "linear-gradient(145deg, var(--pos-orange), var(--pos-orange-dk))", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: "1.125rem", flexShrink: 0 }}>
            S
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--pos-orange)", lineHeight: 1 }}>POS</p>
            <h1 style={{ fontSize: "1.125rem", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2, fontFamily: "var(--font-display)" }}>New order</h1>
          </div>
          <LiveClock />
        </header>

        {c.error && (
          <div style={{ padding: "0 1rem" }}>
            <PosAlert message={c.error} onDismiss={() => c.setError("")} />
          </div>
        )}

        {/* Body */}
        <div className="pos-hub-body">
          {/* Session stats — informational only, shown when register is open */}
          {sessionOpen && (
            <div className="pos-hub-stats">
              <div className="pos-hub-stat">
                <span className="pos-hub-stat__dot" style={{ background: "var(--pos-green)" }} />
                {freeTables} free
              </div>
              {busyTables > 0 && (
                <div className="pos-hub-stat">
                  <span className="pos-hub-stat__dot" style={{ background: "var(--pos-orange)" }} />
                  {busyTables} in service
                </div>
              )}
              <div className="pos-hub-stat">
                <span className="pos-hub-stat__dot" style={{ background: "var(--pos-muted)" }} />
                Shift {shiftLabel}
              </div>
            </div>
          )}

          {/* Action cards — always fully accessible */}
          <div className="pos-hub-grid">
            <PosActionCard
              title="Dine in"
              subtitle={`${freeTables} table${freeTables !== 1 ? "s" : ""} free`}
              icon={<IconTable />}
              iconBg="var(--pos-orange-bg)"
              onClick={c.startTableService}
            />
            <PosActionCard
              title="Quick sale"
              subtitle="Counter or takeaway"
              icon={<IconBag />}
              iconBg="var(--pos-green-bg)"
              onClick={c.startQuickSale}
            />
            <PosActionCard
              title="Delivery"
              subtitle="Customer details first"
              icon={<IconTruck />}
              iconBg="var(--pos-blue-bg)"
              onClick={c.startDelivery}
            />
            <PosActionCard
              title="Open orders"
              subtitle="Resume a bill"
              icon={<IconList />}
              iconBg="var(--pos-surface-3)"
              onClick={() => { c.loadOpenOrders(); c.setScreen("open-orders"); }}
            />
          </div>
        </div>

        {/* Footer — register toggle sits alongside the other tools */}
        <div className="pos-footer-tools">
          <PosBtn variant="ghost" onClick={() => c.setModal("cash")}>Cash</PosBtn>
          <PosBtn variant="ghost" onClick={() => window.open("/pos/display", "_blank")}>Display</PosBtn>
          <PosBtn variant="ghost" onClick={() => window.open("/pos/waiter", "_blank")}>Waiter</PosBtn>
          {sessionOpen
            ? <PosBtn variant="danger" onClick={() => c.setModal("close-shift")}>Close Register</PosBtn>
            : <PosBtn variant="cash"   onClick={() => c.setModal("open-register")}>Open Register</PosBtn>
          }
        </div>

        <button
          type="button"
          onClick={onLogout}
          style={{ display: "block", width: "100%", textAlign: "center", padding: "0.5rem", fontSize: "0.75rem", color: "var(--pos-muted)", background: "none", border: "none", cursor: "pointer" }}
        >
          ← Logout / switch cashier
        </button>
      </PosShell>
    </PosRoot>
  );
}

// ─── Tables ───────────────────────────────────────────────────────────────────

export function TablesScreen({ c }: { c: C }) {
  return (
    <PosRoot>
      <PosPageChrome
        title="Select table"
        backLabel="Home"
        onBack={c.goHub}
        stepIndex={0}
        error={c.error}
        onDismissError={() => c.setError("")}
        right={<RegisterChip c={c} />}
      >
        {c.areas.length > 0 && (
          <div className="pos-area-strip">
            <button
              type="button"
              className={`pos-btn pos-btn--pill ${!c.areaFilter ? "pos-btn--pill-active" : ""}`}
              onClick={() => c.setAreaFilter(null)}
            >
              All
            </button>
            {c.areas.map(a => (
              <button
                key={a}
                type="button"
                className={`pos-btn pos-btn--pill ${c.areaFilter === a ? "pos-btn--pill-active" : ""}`}
                onClick={() => c.setAreaFilter(a)}
              >
                {a}
              </button>
            ))}
          </div>
        )}

        <div style={{ flex: 1, overflow: "auto" }}>
          <div className="pos-table-grid">
            {c.filteredTables.map((t: PosTable) => (
              <button
                key={t.id}
                type="button"
                className={`pos-table-tile ${t.occupied ? "pos-table-tile--busy" : ""}`}
                onClick={() => c.selectTable(t)}
              >
                <span className="pos-table-tile__name">{t.name}</span>
                <span className="pos-table-tile__seats">{t.seats} seats</span>
                <span className="pos-table-tile__status">
                  {t.occupied ? "In use" : "Free"}
                </span>
              </button>
            ))}
          </div>
        </div>
      </PosPageChrome>
    </PosRoot>
  );
}

// ─── Delivery ─────────────────────────────────────────────────────────────────

export function DeliveryScreen({ c }: { c: C }) {
  const ok = c.draft.deliveryAddress.trim().length > 2;

  return (
    <PosRoot>
      <PosPageChrome
        title="Delivery"
        backLabel="Home"
        onBack={c.goHub}
        stepIndex={0}
        error={c.error}
        onDismissError={() => c.setError("")}
        right={<RegisterChip c={c} />}
        footer={
          <div className="pos-dock">
            <PosBtn variant="primary" disabled={!ok} onClick={() => c.setScreen("order")}>
              Continue to menu →
            </PosBtn>
          </div>
        }
      >
        <div style={{ flex: 1, overflow: "auto", padding: "1.5rem" }}>
          <div className="pos-card" style={{ padding: "1.5rem", maxWidth: "28rem", margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div>
              <PosLabel>Customer name</PosLabel>
              <PosInput value={c.draft.customerName} onChange={e => c.patchDraft({ customerName: e.target.value })} placeholder="Name" />
            </div>
            <div>
              <PosLabel>Phone</PosLabel>
              <PosInput value={c.draft.customerPhone} onChange={e => c.patchDraft({ customerPhone: e.target.value })} placeholder="+48 …" inputMode="tel" />
            </div>
            <div>
              <PosLabel>Delivery address *</PosLabel>
              <PosInput value={c.draft.deliveryAddress} onChange={e => c.patchDraft({ deliveryAddress: e.target.value })} placeholder="Street, number, city" />
            </div>
            <div>
              <PosLabel>Notes</PosLabel>
              <PosTextarea
                rows={2}
                value={c.draft.specialRequests}
                onChange={e => c.patchDraft({ specialRequests: e.target.value })}
                placeholder="Allergies, door code…"
              />
            </div>
          </div>
        </div>
      </PosPageChrome>
    </PosRoot>
  );
}

// ─── Order ────────────────────────────────────────────────────────────────────

function CartPanel({ c }: { c: C }) {
  const { count, subtotal, vat, total } = c.totals;

  return (
    <aside className="pos-cart-panel">
      <div className="pos-cart-panel__hd">
        <span className="pos-cart-panel__title">Order</span>
        {count > 0 && <span className="pos-cart-panel__badge">{count}</span>}
      </div>

      <div className="pos-cart-body">
        {count === 0 ? (
          <div className="pos-cart-empty">
            <span className="pos-cart-empty__icon">🛒</span>
            <span>Tap items to add</span>
          </div>
        ) : (
          c.draft.cart.map(line => (
            <div key={line.menuItemId} className="pos-cart-line">
              <div className="pos-cart-line__info">
                <p className="pos-cart-line__name">{line.itemName}</p>
                <p className="pos-cart-line__unit">{fmt(line.unitPrice)} each</p>
              </div>
              <PosQtyControl
                qty={line.quantity}
                onMinus={() => c.adjustQty(line.menuItemId, -1)}
                onPlus={() => c.adjustQty(line.menuItemId, 1)}
              />
              <span className="pos-cart-line__total">{fmt(line.unitPrice * line.quantity)}</span>
            </div>
          ))
        )}
      </div>

      {count > 0 && (
        <div className="pos-cart-footer">
          <div className="pos-cart-totals">
            <div className="pos-cart-totals__row">
              <span>Subtotal</span>
              <span>{fmt(subtotal)}</span>
            </div>
            <div className="pos-cart-totals__row">
              <span>VAT</span>
              <span>{fmt(vat)}</span>
            </div>
            <div className="pos-cart-totals__grand">
              <span>Total</span>
              <span className="pos-cart-totals__grand-amt">{fmt(total)}</span>
            </div>
          </div>
          <div className="pos-cart-cta">
            <PosBtn variant="primary" onClick={c.goCheckout}>
              Checkout — {fmt(total)}
            </PosBtn>
          </div>
        </div>
      )}
    </aside>
  );
}

export function OrderScreen({ c }: { c: C }) {
  const label = orderLabel(c.draft);
  const { count, subtotal } = c.totals;

  const leave = () => {
    if (c.draft.cart.length > 0 && !confirm("Discard this order?")) return;
    c.goHub();
  };

  return (
    <PosRoot>
      <PosShell>
        {/* Topbar */}
        <PosTopBar title={label} backLabel="Cancel" onBack={leave} right={<RegisterChip c={c} />} />
        <PosSteps steps={["Where", "Order", "Pay"]} current={1} />
        {c.error && <PosAlert message={c.error} onDismiss={() => c.setError("")} />}

        {/* Search bar */}
        <div className="pos-search-bar">
          <IconSearch className="pos-search-icon w-5 h-5" />
          <PosInput
            type="search"
            value={c.menuSearch}
            onChange={e => c.setMenuSearch(e.target.value)}
            placeholder="Search menu or scan barcode…"
            style={{ border: "none", boxShadow: "none", background: "transparent", padding: "0.5rem 0" }}
          />
        </div>

        {/* 3-panel order layout */}
        <div className="pos-order-layout">
          {/* Category rail */}
          <nav className="pos-cat-rail">
            <button
              type="button"
              className={`pos-cat-btn ${!c.activeCat ? "pos-cat-btn--active" : ""}`}
              onClick={() => c.setActiveCat(null)}
            >
              All
            </button>
            {c.categories.map(cat => (
              <button
                key={cat.id}
                type="button"
                className={`pos-cat-btn ${c.activeCat === cat.id ? "pos-cat-btn--active" : ""}`}
                onClick={() => c.setActiveCat(cat.id)}
              >
                {cat.name}
              </button>
            ))}
          </nav>

          {/* Menu area */}
          <div className="pos-menu-area">
            <div className="pos-menu-scroll">
              <div className="pos-product-grid">
                {c.filteredMenu.length === 0 ? (
                  <p style={{ gridColumn: "1 / -1", textAlign: "center", color: "var(--pos-muted)", padding: "3rem 1rem" }}>
                    No items found
                  </p>
                ) : (
                  c.filteredMenu.map(item => {
                    const inCart = c.draft.cart.find(l => l.menuItemId === item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`pos-product ${inCart ? "pos-product--selected" : ""}`}
                        onClick={() => c.addToCart(item)}
                      >
                        {inCart && <span className="pos-product__qty">{inCart.quantity}</span>}
                        {item.imagePath ? (
                          <img src={`/api/uploads/${item.imagePath}`} alt="" className="pos-product__img" />
                        ) : (
                          <div className="pos-product__placeholder">🍽</div>
                        )}
                        <div className="pos-product__body">
                          <p className="pos-product__name">{item.name}</p>
                          <p className="pos-product__price">{fmt(item.sellPrice)}</p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Mobile cart strip */}
            {count > 0 && (
              <div className="pos-cart-strip">
                {c.draft.cart.map(line => (
                  <div key={line.menuItemId} className="pos-cart-line">
                    <span style={{ flex: 1, fontSize: "0.875rem", fontWeight: 600 }}>
                      {line.quantity}× {line.itemName}
                    </span>
                    <PosQtyControl
                      qty={line.quantity}
                      onMinus={() => c.adjustQty(line.menuItemId, -1)}
                      onPlus={() => c.adjustQty(line.menuItemId, 1)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Desktop cart panel */}
          <CartPanel c={c} />
        </div>

        {/* Mobile-only checkout dock (hidden on desktop where CartPanel shows) */}
        <div className="pos-dock pos-dock--order-mobile">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.625rem" }}>
            <span style={{ color: "var(--pos-muted)", fontWeight: 600, fontSize: "0.875rem" }}>
              {count} {count === 1 ? "item" : "items"}
            </span>
            <PosMoney amount={subtotal} />
          </div>
          <PosBtn variant="primary" disabled={count === 0} onClick={c.goCheckout}>
            Checkout — {fmt(subtotal)}
          </PosBtn>
        </div>
      </PosShell>
    </PosRoot>
  );
}

// ─── Checkout helpers ─────────────────────────────────────────────────────────

const PRIMARY_METHODS = [
  { id: "CASH", label: "Cash",   emoji: "💵", color: "#2d6a4f", bg: "rgba(45 106 79 / 0.1)" },
  { id: "CARD", label: "Card",   emoji: "💳", color: "#1e5fa8", bg: "rgba(30 95 168 / 0.1)" },
  { id: "BLIK", label: "BLIK",   emoji: "📱", color: "#6c3aad", bg: "rgba(108 58 173 / 0.1)" },
] as const;

const PLATFORM_METHODS = [
  { id: "WOLT",       label: "Wolt",       dot: "#009de0" },
  { id: "BOLT_FOOD",  label: "Bolt Food",  dot: "#34c759" },
  { id: "GLOVO",      label: "Glovo",      dot: "#ff9500" },
  { id: "UBER_EATS",  label: "Uber Eats",  dot: "#050505" },
] as const;

type PayView = "select" | "cash" | "confirm";

// ─── Checkout ─────────────────────────────────────────────────────────────────

export function CheckoutScreen({ c }: { c: C }) {
  const { subtotal, vat, total, count } = c.totals;

  const [payView, setPayView]             = useState<PayView>("select");
  const [pendingMethod, setPendingMethod] = useState<string>("CARD");
  const [customTipInput, setCustomTipInput] = useState("");
  const [showCustomTip, setShowCustomTip] = useState(false);
  const [splitN, setSplitN]               = useState(2);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const selectMethod = (id: string) => {
    if (id === "CASH") {
      c.setTendered("");
      setPayView("cash");
    } else {
      setPendingMethod(id);
      setPayView("confirm");
    }
  };

  const applyCustomTip = () => {
    const v = parseFloat(customTipInput);
    if (!isNaN(v) && v >= 0) c.setTip(Math.round(v * 100) / 100);
    setShowCustomTip(false);
    setCustomTipInput("");
  };

  const openSplitBill = () => {
    const perPerson = Math.round((total / splitN) * 100) / 100;
    c.setPayLegs(
      Array.from({ length: splitN }, () => ({ method: "CASH", amount: String(perPerson) }))
    );
    c.setModal("split-pay");
  };

  const canPay = !c.paying && c.nipStatus !== "invalid" && count > 0;
  const cashOk = canPay && c.change !== null && c.change >= 0;

  const pendingLabel = [...PRIMARY_METHODS, ...PLATFORM_METHODS].find(m => m.id === pendingMethod)?.label ?? pendingMethod;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <PosRoot>
      <PosShell>
        <PosTopBar title="Checkout" backLabel="Menu" onBack={() => c.setScreen("order")} right={<RegisterChip c={c} />} />
        <PosSteps steps={["Where", "Order", "Pay"]} current={2} />
        {c.error && <PosAlert message={c.error} onDismiss={() => c.setError("")} />}

        <div className="pos-checkout-shell">

          {/* ── LEFT: order summary ────────────────────────────────── */}
          <div className="pos-checkout-review">

            {/* Item list */}
            <div className="pos-card" style={{ overflow: "hidden" }}>
              <ul className="pos-checkout-items">
                {c.draft.cart.map(line => (
                  <li key={line.menuItemId} className="pos-checkout-item">
                    <span style={{ color: "var(--pos-muted)", minWidth: "1.5rem", textAlign: "right", flexShrink: 0 }}>{line.quantity}×</span>
                    <span style={{ flex: 1 }}>{line.itemName}</span>
                    <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmt(line.unitPrice * line.quantity)}</span>
                  </li>
                ))}
              </ul>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "0.625rem 1rem", borderTop: "1px solid var(--pos-border)", fontSize: "0.8125rem", color: "var(--pos-muted)", fontVariantNumeric: "tabular-nums" }}>
                <span>Net {fmt(subtotal - vat)}</span>
                <span style={{ textAlign: "center" }}>VAT {fmt(vat)}</span>
                <span style={{ textAlign: "right" }}>Sub {fmt(subtotal)}</span>
              </div>
            </div>

            {/* Tip */}
            <div>
              <PosLabel>Tip</PosLabel>
              <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
                {[0, 5, 10, 15].map(pct => {
                  const v = pct === 0 ? 0 : Math.round(subtotal * pct) / 100;
                  return (
                    <button
                      key={pct}
                      type="button"
                      className={`pos-btn pos-btn--pill ${c.tip === v && !showCustomTip ? "pos-btn--pill-active" : ""}`}
                      onClick={() => { c.setTip(v); setShowCustomTip(false); setCustomTipInput(""); }}
                    >
                      {pct === 0 ? "None" : `${pct}%`}
                    </button>
                  );
                })}
                <button
                  type="button"
                  className={`pos-btn pos-btn--pill ${showCustomTip ? "pos-btn--pill-active" : ""}`}
                  onClick={() => setShowCustomTip(v => !v)}
                >
                  Custom
                </button>
              </div>

              {showCustomTip && (
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.625rem" }}>
                  <PosInput
                    type="number"
                    min={0}
                    value={customTipInput}
                    onChange={e => setCustomTipInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && applyCustomTip()}
                    placeholder="Amount (PLN)"
                    autoFocus
                    style={{ flex: 1 }}
                  />
                  <button type="button" className="pos-btn pos-btn--primary" style={{ width: "5rem" }} onClick={applyCustomTip}>
                    Apply
                  </button>
                </div>
              )}
            </div>

            {/* Total = subtotal + tip */}
            <div style={{ background: "var(--pos-surface)", borderRadius: "var(--pos-r-lg)", border: "1px solid var(--pos-border)", padding: "1rem 1.25rem" }}>
              {c.tip > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", color: "var(--pos-muted)", marginBottom: "0.5rem", fontVariantNumeric: "tabular-nums" }}>
                  <span>Subtotal</span><span>{fmt(subtotal)}</span>
                </div>
              )}
              {c.tip > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", color: "var(--pos-muted)", marginBottom: "0.5rem", fontVariantNumeric: "tabular-nums" }}>
                  <span>Tip</span><span>+ {fmt(c.tip)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: c.tip > 0 ? "1.5px solid var(--pos-border)" : "none", paddingTop: c.tip > 0 ? "0.5rem" : 0 }}>
                <span style={{ fontSize: "1rem", fontWeight: 700 }}>Total</span>
                <span style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--pos-orange)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{fmt(total)}</span>
              </div>
            </div>

            {/* NIP */}
            <div>
              <PosLabel>NIP / Tax ID (optional)</PosLabel>
              <PosInput
                inputMode="numeric"
                value={c.buyerNip}
                onChange={e => c.setBuyerNip(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="10-digit tax ID"
                style={c.nipStatus === "invalid" ? { borderColor: "var(--pos-red)" } : undefined}
              />
            </div>

            {/* Order notes */}
            <button
              type="button"
              onClick={() => c.setModal("order-details")}
              style={{ fontSize: "0.8125rem", color: "var(--pos-muted)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", textAlign: "left" }}
            >
              Order notes & discount
            </button>
          </div>

          {/* ── RIGHT: payment panel ───────────────────────────────── */}
          <div className="pos-checkout-pay">

            {/* ── View: method selection ─────────────────────────── */}
            {payView === "select" && (
              <>
                <div className="pos-pay-section">
                  <p style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--pos-muted)", marginBottom: "0.875rem" }}>
                    Payment method
                  </p>

                  {/* Primary methods */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.625rem", marginBottom: "0.75rem" }}>
                    {PRIMARY_METHODS.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        disabled={!canPay}
                        onClick={() => selectMethod(m.id)}
                        style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.5rem", padding: "1.125rem 0.5rem", borderRadius: "var(--pos-r-lg)", border: `1.5px solid ${m.bg}`, background: m.bg, cursor: "pointer", fontFamily: "var(--font-sans)", transition: "transform 0.1s", opacity: canPay ? 1 : 0.45 }}
                      >
                        <span style={{ fontSize: "1.625rem" }}>{m.emoji}</span>
                        <span style={{ fontSize: "0.875rem", fontWeight: 700, color: m.color }}>{m.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Delivery platforms */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.5rem" }}>
                    {PLATFORM_METHODS.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        disabled={!canPay}
                        onClick={() => selectMethod(m.id)}
                        style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.3rem", padding: "0.75rem 0.25rem", borderRadius: "var(--pos-r)", border: "1.5px solid var(--pos-border)", background: "var(--pos-surface)", cursor: "pointer", fontFamily: "var(--font-sans)", transition: "transform 0.1s", opacity: canPay ? 1 : 0.45 }}
                      >
                        <span style={{ width: "0.625rem", height: "0.625rem", borderRadius: "999px", background: m.dot, flexShrink: 0 }} />
                        <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--pos-ink-2)", textAlign: "center", lineHeight: 1.2 }}>{m.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Split options */}
                <div className="pos-pay-section">
                  <p style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--pos-muted)", marginBottom: "0.875rem" }}>
                    Split
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.625rem" }}>
                    {/* Split payment */}
                    <button
                      type="button"
                      disabled={!canPay}
                      onClick={() => c.setModal("split-pay")}
                      style={{ padding: "0.875rem 0.625rem", borderRadius: "var(--pos-r)", border: "1.5px solid var(--pos-border)", background: "var(--pos-surface)", cursor: "pointer", fontFamily: "var(--font-sans)", textAlign: "center" }}
                    >
                      <div style={{ fontSize: "1.25rem" }}>✂️</div>
                      <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--pos-ink)", marginTop: "0.25rem" }}>Split payment</div>
                      <div style={{ fontSize: "0.6875rem", color: "var(--pos-muted)" }}>Multiple methods</div>
                    </button>

                    {/* Split bill */}
                    <button
                      type="button"
                      disabled={!canPay}
                      onClick={openSplitBill}
                      style={{ padding: "0.875rem 0.625rem", borderRadius: "var(--pos-r)", border: "1.5px solid var(--pos-border)", background: "var(--pos-surface)", cursor: "pointer", fontFamily: "var(--font-sans)", textAlign: "center" }}
                    >
                      <div style={{ fontSize: "1.25rem" }}>👥</div>
                      <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--pos-ink)", marginTop: "0.25rem" }}>Split bill</div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.375rem", marginTop: "0.375rem" }}>
                        <button type="button" onClick={e => { e.stopPropagation(); setSplitN(n => Math.max(2, n - 1)); }} style={{ width: "1.25rem", height: "1.25rem", borderRadius: "999px", border: "1px solid var(--pos-border)", background: "var(--pos-surface-2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.875rem", fontWeight: 700, flexShrink: 0 }}>−</button>
                        <span style={{ fontSize: "0.875rem", fontWeight: 700, minWidth: "1.25rem", textAlign: "center" }}>{splitN}</span>
                        <button type="button" onClick={e => { e.stopPropagation(); setSplitN(n => Math.min(10, n + 1)); }} style={{ width: "1.25rem", height: "1.25rem", borderRadius: "999px", border: "1px solid var(--pos-border)", background: "var(--pos-surface-2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.875rem", fontWeight: 700, flexShrink: 0 }}>+</button>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="pos-pay-secondary">
                  <PosBtn variant="ghost" onClick={c.startQr} disabled={c.qrBusy}>BLIK QR</PosBtn>
                  <PosBtn variant="ghost" onClick={() => c.setModal("park")} style={{ color: "var(--pos-orange)" }}>Park bill</PosBtn>
                  <PosBtn variant="ghost" onClick={() => c.setScreen("order")}>Back</PosBtn>
                </div>
              </>
            )}

            {/* ── View: cash numpad ──────────────────────────────── */}
            {payView === "cash" && (
              <>
                <div className="pos-pay-section">
                  <button type="button" onClick={() => { setPayView("select"); c.setTendered(""); }} style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--pos-orange)", background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: "0.875rem", fontFamily: "var(--font-sans)" }}>
                    ← Choose different method
                  </button>
                  <PosLabel>Cash received</PosLabel>
                  <div className={`pos-tendered-display ${!c.tendered ? "pos-tendered-display--empty" : ""}`}>
                    {c.tendered || "0.00"}
                  </div>
                </div>

                <div className="pos-pay-section">
                  <PosNumpad value={c.tendered} onChange={c.setTendered} />
                  <div className="pos-quick-amounts">
                    {[total, 50, 100, 200].map(amt => (
                      <button key={amt} type="button" className="pos-quick-amount" onClick={() => c.setTendered(String(amt))}>
                        {amt === total ? "Exact" : fmt(amt)}
                      </button>
                    ))}
                  </div>
                  {c.change !== null && c.tendered && (
                    <div className={`pos-change ${c.change >= 0 ? "pos-change--ok" : "pos-change--short"}`}>
                      {c.change >= 0 ? `Change  ${fmt(c.change)}` : `Short  ${fmt(Math.abs(c.change))}`}
                    </div>
                  )}
                </div>

                <div style={{ padding: "0 1.25rem 1.25rem" }}>
                  <button
                    type="button"
                    disabled={!cashOk || c.paying}
                    onClick={c.payCash}
                    style={{ width: "100%", minHeight: "3.5rem", borderRadius: "var(--pos-r)", border: "none", background: cashOk ? "var(--pos-green)" : "var(--pos-surface-3)", color: cashOk ? "#fff" : "var(--pos-muted)", fontSize: "1rem", fontWeight: 700, cursor: cashOk ? "pointer" : "default", fontFamily: "var(--font-sans)", transition: "background 0.15s" }}
                  >
                    {c.paying ? "Processing…" : cashOk ? `Confirm — ${fmt(total)}` : "Enter amount"}
                  </button>
                </div>
              </>
            )}

            {/* ── View: non-cash confirmation ────────────────────── */}
            {payView === "confirm" && (
              <>
                <div className="pos-pay-section">
                  <button type="button" onClick={() => setPayView("select")} style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--pos-orange)", background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: "1.5rem", fontFamily: "var(--font-sans)" }}>
                    ← Choose different method
                  </button>

                  {/* Method + amount */}
                  <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
                    <p style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--pos-muted)", marginBottom: "0.5rem" }}>
                      {pendingLabel}
                    </p>
                    <p style={{ fontSize: "2.75rem", fontWeight: 800, color: "var(--pos-ink)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em", lineHeight: 1 }}>
                      {fmt(total)}
                    </p>
                    {c.tip > 0 && (
                      <p style={{ fontSize: "0.875rem", color: "var(--pos-muted)", marginTop: "0.5rem" }}>
                        incl. {fmt(c.tip)} tip
                      </p>
                    )}
                  </div>
                </div>

                <div style={{ padding: "0 1.25rem 1.25rem", marginTop: "auto" }}>
                  <button
                    type="button"
                    disabled={!canPay || c.paying}
                    onClick={() => c.payMethod(pendingMethod)}
                    style={{ width: "100%", minHeight: "3.5rem", borderRadius: "var(--pos-r)", border: "none", background: "var(--pos-green)", color: "#fff", fontSize: "1rem", fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-sans)", boxShadow: "0 2px 10px rgba(45 106 79 / 0.3)", transition: "opacity 0.12s", opacity: canPay ? 1 : 0.45 }}
                  >
                    {c.paying ? "Processing…" : `Confirm ${pendingLabel} — ${fmt(total)}`}
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      </PosShell>
    </PosRoot>
  );
}

// ─── Open orders ──────────────────────────────────────────────────────────────

export function OpenOrdersScreen({ c }: { c: C }) {
  return (
    <PosRoot>
      <PosPageChrome
        title="Open orders"
        backLabel="Home"
        onBack={c.goHub}
        stepIndex={-1}
        error={c.error}
        onDismissError={() => c.setError("")}
        right={<RegisterChip c={c} />}
      >
        <div style={{ flex: 1, overflow: "auto", padding: "1.25rem" }}>
          {c.openOrders.length === 0 ? (
            <div style={{ textAlign: "center", padding: "4rem 1rem", color: "var(--pos-muted)" }}>
              <p style={{ fontSize: "2rem", marginBottom: "0.75rem", opacity: 0.4 }}>📋</p>
              <p style={{ fontWeight: 700, fontSize: "1.0625rem" }}>Nothing open</p>
              <p style={{ fontSize: "0.875rem", marginTop: "0.375rem" }}>Parked and active bills show up here</p>
            </div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, maxWidth: "34rem", marginLeft: "auto", marginRight: "auto", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {c.openOrders.map((o: PosOrder) => {
                const tbl = c.tables.find((t: PosTable) => t.id === o.tableId);
                const age = Math.round((Date.now() - new Date(o.openedAt).getTime()) / 60000);
                const ageLabel = age >= 60 ? `${Math.floor(age / 60)}h ${age % 60}m` : `${age}m`;
                const parked = o.status === "PARKED";

                return (
                  <li key={o.id}>
                    <button type="button" className="pos-order-card" onClick={() => c.resumeOpenOrder(o)}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <span style={{ fontWeight: 700, fontSize: "1.0625rem" }}>{tbl?.name ?? "Takeaway"}</span>
                          <span className={`pos-badge ${parked ? "pos-badge--parked" : "pos-badge--open"}`}>
                            {parked ? "Parked" : "Open"}
                          </span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.625rem", color: "var(--pos-muted)", fontSize: "0.875rem" }}>
                          <span>{o.lines.length} items · {ageLabel}</span>
                          <span style={{ fontWeight: 800, color: "var(--pos-orange)", fontVariantNumeric: "tabular-nums" }}>
                            {fmt(o.totalGross)}
                          </span>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PosPageChrome>
    </PosRoot>
  );
}
