import { useState } from "react";
import { openSession, type PosOrder, type PosSession, type PosTable } from "../../api/pos";
import { fmt } from "../../lib/calc";
import { IconBag, IconCash, IconCard, IconList, IconSearch, IconTable, IconTruck } from "./icons";
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
  PosTextarea,
} from "./ui";

type C = ReturnType<typeof usePosController>;

// ─── Shift start ──────────────────────────────────────────────────────────────

export function SessionOpenScreen({ onOpen }: { onOpen: (s: PosSession) => void }) {
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
      <div className="pos-session-split">
        <div className="pos-session-brand">
          <p style={{ opacity: 0.85, fontSize: "0.875rem", marginBottom: "0.5rem" }}>Restaurant point of sale</p>
          <h1>Saffron</h1>
          <p style={{ opacity: 0.75, marginTop: "1rem", maxWidth: "16rem", lineHeight: 1.5 }}>
            Fast ordering, clear checkout, built for your team.
          </p>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            background: "var(--pos-bg)",
          }}
        >
          <div className="pos-card" style={{ width: "100%", maxWidth: "22rem", padding: "2rem" }}>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.25rem" }}>Start shift</h2>
            <p style={{ color: "var(--pos-muted)", fontSize: "0.875rem", marginBottom: "1.5rem" }}>Count cash in the drawer</p>
            {err && <p style={{ color: "var(--color-danger)", fontSize: "0.875rem", marginBottom: "1rem" }}>{err}</p>}
            <PosLabel>Opening float (PLN)</PosLabel>
            <PosInput
              type="number"
              min={0}
              value={float_}
              onChange={e => setFloat(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submit()}
              style={{ fontSize: "1.75rem", fontWeight: 800, textAlign: "center", marginBottom: "1rem" }}
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
              {busy ? "Opening…" : "Open shift"}
            </PosBtn>
          </div>
        </div>
      </div>
    </PosRoot>
  );
}

// ─── Hub ──────────────────────────────────────────────────────────────────────

export function HubScreen({ c }: { c: C }) {
  const busy = c.tables.filter(t => t.occupied).length;
  const free = c.tables.length - busy;

  return (
    <PosRoot>
      <PosShell>
        <header style={{ padding: "1.5rem 1.5rem 1rem", background: "var(--pos-surface)", borderBottom: "1px solid var(--pos-border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", maxWidth: "42rem", margin: "0 auto" }}>
            <div
              style={{
                width: "2.5rem",
                height: "2.5rem",
                borderRadius: "0.75rem",
                background: "linear-gradient(145deg,var(--color-saffron),var(--color-saffron-dark))",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                fontSize: "1.125rem",
              }}
            >
              S
            </div>
            <div>
              <p style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-saffron)" }}>
                POS
              </p>
              <h1 style={{ fontSize: "1.375rem", fontWeight: 700, fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}>
                New order
              </h1>
            </div>
            <span className="pos-clock" style={{ marginLeft: "auto" }}>
              {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          {c.error && (
            <div style={{ maxWidth: "42rem", margin: "1rem auto 0" }}>
              <PosAlert message={c.error} onDismiss={() => c.setError("")} />
            </div>
          )}
          <p style={{ maxWidth: "42rem", margin: "0.75rem auto 0", color: "var(--pos-muted)", fontSize: "0.875rem" }}>
            {free} tables free · {busy} in service
          </p>
        </header>

        <div style={{ flex: 1, overflow: "auto" }}>
          <div className="pos-hub-grid">
            <PosActionCard
              title="Dine in"
              subtitle="Choose a table, then add items"
              icon={<IconTable />}
              iconBg="var(--color-saffron-light)"
              onClick={c.startTableService}
            />
            <PosActionCard
              title="Quick sale"
              subtitle="Counter or takeaway"
              icon={<IconBag />}
              iconBg="rgb(45 106 79 / 0.12)"
              onClick={c.startQuickSale}
            />
            <PosActionCard
              title="Delivery"
              subtitle="Customer details first"
              icon={<IconTruck />}
              iconBg="rgb(14 116 144 / 0.12)"
              onClick={c.startDelivery}
            />
            <PosActionCard
              title="Open orders"
              subtitle="Continue a bill"
              icon={<IconList />}
              iconBg="var(--pos-surface-2)"
              onClick={() => {
                c.loadOpenOrders();
                c.setScreen("open-orders");
              }}
            />
          </div>
        </div>

        <div className="pos-footer-tools">
          <PosBtn variant="ghost" className="!w-auto flex-1" onClick={() => c.setModal("cash")}>
            Cash
          </PosBtn>
          <PosBtn variant="ghost" className="!w-auto flex-1" onClick={() => window.open("/pos/display", "_blank")}>
            Display
          </PosBtn>
          <PosBtn variant="ghost" className="!w-auto flex-1" onClick={() => window.open("/pos/waiter", "_blank")}>
            Waiter
          </PosBtn>
          <PosBtn variant="danger" className="!w-auto flex-1" onClick={() => c.setModal("close-shift")}>
            End shift
          </PosBtn>
        </div>
        <button
          type="button"
          onClick={() => { window.location.href = "/"; }}
          style={{ display: "block", width: "100%", textAlign: "center", padding: "0.5rem", fontSize: "0.75rem", color: "var(--pos-muted)", background: "none", border: "none", cursor: "pointer" }}
        >
          Exit to platform
        </button>
      </PosShell>
    </PosRoot>
  );
}

// ─── Tables ───────────────────────────────────────────────────────────────────

export function TablesScreen({ c }: { c: C }) {
  return (
    <PosRoot>
      <PosPageChrome title="Select table" backLabel="Home" onBack={c.goHub} stepIndex={0} error={c.error} onDismissError={() => c.setError("")}>
        {c.areas.length > 0 && (
          <div style={{ display: "flex", gap: "0.5rem", padding: "0.75rem 1rem", overflowX: "auto", background: "var(--pos-surface)", borderBottom: "1px solid var(--pos-border)" }}>
            <button type="button" className={`pos-btn pos-btn--pill ${!c.areaFilter ? "pos-btn--pill-active" : ""}`} onClick={() => c.setAreaFilter(null)}>
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
            {c.filteredTables.map(t => (
              <button
                key={t.id}
                type="button"
                className={`pos-table ${t.occupied ? "pos-table--busy" : ""}`}
                onClick={() => c.selectTable(t)}
              >
                <span style={{ fontSize: "1.25rem" }}>{t.name}</span>
                <span style={{ fontSize: "0.6875rem", color: "var(--pos-muted)", fontWeight: 500 }}>{t.seats} seats</span>
                <span className="pos-table__status">{t.occupied ? "In use" : "Available"}</span>
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
        footer={
          <div className="pos-dock">
            <PosBtn variant="primary" disabled={!ok} onClick={() => c.setScreen("order")}>
              Continue to menu
            </PosBtn>
          </div>
        }
      >
        <div style={{ flex: 1, overflow: "auto", padding: "1.5rem", maxWidth: "28rem", margin: "0 auto", width: "100%" }}>
          <div className="pos-card" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div>
              <PosLabel>Customer name</PosLabel>
              <PosInput value={c.draft.customerName} onChange={e => c.patchDraft({ customerName: e.target.value })} placeholder="Name" />
            </div>
            <div>
              <PosLabel>Phone</PosLabel>
              <PosInput value={c.draft.customerPhone} onChange={e => c.patchDraft({ customerPhone: e.target.value })} placeholder="+48 …" />
            </div>
            <div>
              <PosLabel>Address *</PosLabel>
              <PosInput value={c.draft.deliveryAddress} onChange={e => c.patchDraft({ deliveryAddress: e.target.value })} placeholder="Street, city" />
            </div>
            <div>
              <PosLabel>Notes</PosLabel>
              <PosTextarea rows={2} value={c.draft.specialRequests} onChange={e => c.patchDraft({ specialRequests: e.target.value })} placeholder="Allergies, door code…" />
            </div>
          </div>
        </div>
      </PosPageChrome>
    </PosRoot>
  );
}

// ─── Order ────────────────────────────────────────────────────────────────────

function CartPanel({ c }: { c: C }) {
  if (c.totals.count === 0) {
    return (
      <div className="pos-cart" style={{ alignItems: "center", justifyContent: "center", color: "var(--pos-muted)", fontSize: "0.875rem", padding: "2rem" }}>
        Tap items to add
      </div>
    );
  }
  return (
    <aside className="pos-cart">
      <div style={{ padding: "1rem", borderBottom: "1px solid var(--pos-border)", fontWeight: 700, fontSize: "0.8125rem", color: "var(--pos-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Order · {c.totals.count}
      </div>
      <ul style={{ flex: 1, overflow: "auto", listStyle: "none", margin: 0, padding: 0 }}>
        {c.draft.cart.map(line => (
          <li key={line.menuItemId} className="pos-cart-line">
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 600, fontSize: "0.875rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{line.itemName}</p>
              <p style={{ fontSize: "0.75rem", color: "var(--pos-muted)" }}>{fmt(line.unitPrice)}</p>
            </div>
            <PosQtyControl qty={line.quantity} onMinus={() => c.adjustQty(line.menuItemId, -1)} onPlus={() => c.adjustQty(line.menuItemId, 1)} />
            <span style={{ fontWeight: 700, fontSize: "0.875rem", width: "3.5rem", textAlign: "right" }}>{fmt(line.unitPrice * line.quantity)}</span>
          </li>
        ))}
      </ul>
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
      <PosPageChrome
        title={label}
        backLabel="Cancel"
        onBack={leave}
        stepIndex={1}
        error={c.error}
        onDismissError={() => c.setError("")}
        footer={
          <div className="pos-dock">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <span style={{ color: "var(--pos-muted)", fontWeight: 600 }}>
                {count} {count === 1 ? "item" : "items"}
              </span>
              <PosMoney amount={subtotal} />
            </div>
            <PosBtn variant="primary" disabled={count === 0} onClick={c.goCheckout}>
              Checkout — {fmt(subtotal)}
            </PosBtn>
          </div>
        }
      >
        <div style={{ padding: "0.75rem 1rem", background: "var(--pos-surface)", borderBottom: "1px solid var(--pos-border)", position: "relative" }}>
          <span style={{ position: "absolute", left: "1.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--pos-muted)", pointerEvents: "none" }}>
            <IconSearch className="w-5 h-5" />
          </span>
          <PosInput
            type="search"
            value={c.menuSearch}
            onChange={e => c.setMenuSearch(e.target.value)}
            placeholder="Search menu or scan barcode…"
            style={{ paddingLeft: "2.75rem" }}
          />
        </div>

        <div className="pos-order-layout">
          <nav className="pos-cat-rail">
            <button type="button" className={`pos-cat-btn ${!c.activeCat ? "pos-cat-btn--active" : ""}`} onClick={() => c.setActiveCat(null)}>
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

          <div className="pos-menu-area">
            <div className="pos-product-grid">
              {c.filteredMenu.length === 0 ? (
                <p style={{ gridColumn: "1 / -1", textAlign: "center", color: "var(--pos-muted)", padding: "3rem" }}>No items found</p>
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
                        <div className="pos-product__img" style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "var(--pos-muted)", fontSize: "0.75rem" }}>
                          No image
                        </div>
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
            {count > 0 && (
              <div className="pos-cart-mobile-strip" style={{ maxHeight: "7rem", overflow: "auto", borderTop: "1px solid var(--pos-border)", background: "var(--pos-surface-2)" }}>
                {c.draft.cart.map(line => (
                  <div key={line.menuItemId} className="pos-cart-line">
                    <span style={{ flex: 1, fontSize: "0.875rem", fontWeight: 600 }}>{line.quantity}× {line.itemName}</span>
                    <PosQtyControl qty={line.quantity} onMinus={() => c.adjustQty(line.menuItemId, -1)} onPlus={() => c.adjustQty(line.menuItemId, 1)} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <CartPanel c={c} />
        </div>
      </PosPageChrome>
    </PosRoot>
  );
}

// ─── Checkout ─────────────────────────────────────────────────────────────────

export function CheckoutScreen({ c }: { c: C }) {
  const { subtotal, vat, total, count } = c.totals;

  return (
    <PosRoot>
      <PosPageChrome
        title="Checkout"
        backLabel="Menu"
        onBack={() => c.setScreen("order")}
        stepIndex={2}
        error={c.error}
        onDismissError={() => c.setError("")}
      >
        <div className="pos-checkout">
          <div style={{ overflow: "auto", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div className="pos-total-hero">
              <p style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-saffron-dark)", marginBottom: "0.25rem" }}>
                Total due
              </p>
              <PosMoney amount={total} hero />
              <p style={{ fontSize: "0.8125rem", color: "var(--pos-muted)", marginTop: "0.5rem" }}>
                {orderLabel(c.draft)} · {count} items
              </p>
            </div>

            <div className="pos-card" style={{ overflow: "hidden" }}>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: "10rem", overflow: "auto" }}>
                {c.draft.cart.map(line => (
                  <li key={line.menuItemId} style={{ display: "flex", justifyContent: "space-between", padding: "0.75rem 1rem", borderBottom: "1px solid var(--pos-border)", fontSize: "0.875rem" }}>
                    <span>
                      {line.quantity}× {line.itemName}
                    </span>
                    <span style={{ fontWeight: 700 }}>{fmt(line.unitPrice * line.quantity)}</span>
                  </li>
                ))}
              </ul>
              <div style={{ padding: "0.75rem 1rem", display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--pos-muted)" }}>
                <span>Net {fmt(subtotal - vat)}</span>
                <span>VAT {fmt(vat)}</span>
              </div>
            </div>

            <div>
              <PosLabel>Tip</PosLabel>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.5rem" }}>
                {[0, 5, 10, 15].map(pct => {
                  const v = pct === 0 ? 0 : Math.round(subtotal * pct) / 100;
                  return (
                    <button
                      key={pct}
                      type="button"
                      className={`pos-btn pos-btn--pill ${c.tip === v ? "pos-btn--pill-active" : ""}`}
                      onClick={() => c.setTip(v)}
                    >
                      {pct === 0 ? "None" : `${pct}%`}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <PosLabel>NIP (optional)</PosLabel>
              <PosInput
                inputMode="numeric"
                value={c.buyerNip}
                onChange={e => c.setBuyerNip(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="10-digit tax ID"
              />
            </div>
          </div>

          <div style={{ background: "var(--pos-surface)", borderLeft: "1px solid var(--pos-border)", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem", overflow: "auto" }}>
            <div>
              <PosLabel>Cash received</PosLabel>
              <PosInput
                readOnly
                value={c.tendered}
                placeholder="0.00"
                style={{ fontSize: "1.5rem", fontWeight: 800, textAlign: "right", marginBottom: "0.75rem" }}
              />
              <PosNumpad value={c.tendered} onChange={c.setTendered} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.75rem" }}>
                {[total, 50, 100, 200].map(amt => (
                  <button key={amt} type="button" className="pos-btn pos-btn--pill" style={{ flex: "1 1 auto" }} onClick={() => c.setTendered(String(amt))}>
                    {amt === total ? "Exact" : fmt(amt)}
                  </button>
                ))}
              </div>
              {c.change !== null && c.tendered && (
                <p style={{ marginTop: "0.75rem", fontWeight: 800, fontSize: "1.125rem", color: c.change >= 0 ? "var(--color-success)" : "var(--color-danger)" }}>
                  {c.change >= 0 ? `Change ${fmt(c.change)}` : `Short ${fmt(Math.abs(c.change))}`}
                </p>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginTop: "auto" }}>
              <PosBtn variant="cash" onClick={c.payCash} disabled={c.paying || c.nipStatus === "invalid" || count === 0}>
                <IconCash /> {c.paying ? "…" : "Cash"}
              </PosBtn>
              <PosBtn variant="primary" onClick={c.payCard} disabled={c.paying || c.nipStatus === "invalid" || count === 0}>
                <IconCard /> {c.paying ? "…" : "Card"}
              </PosBtn>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem" }}>
              <PosBtn variant="ghost" onClick={() => c.setModal("split-pay")}>
                Split
              </PosBtn>
              <PosBtn variant="ghost" onClick={c.startQr} disabled={c.qrBusy}>
                BLIK
              </PosBtn>
              <PosBtn variant="ghost" className="!text-[var(--color-saffron)]" onClick={() => c.setModal("park")}>
                Park
              </PosBtn>
            </div>
            <button type="button" onClick={() => c.setModal("order-details")} style={{ background: "none", border: "none", color: "var(--pos-muted)", fontSize: "0.75rem", cursor: "pointer" }}>
              Order notes & discount
            </button>
          </div>
        </div>
      </PosPageChrome>
    </PosRoot>
  );
}

// ─── Open orders ──────────────────────────────────────────────────────────────

export function OpenOrdersScreen({ c }: { c: C }) {
  return (
    <PosRoot>
      <PosPageChrome title="Open orders" backLabel="Home" onBack={c.goHub} stepIndex={-1} error={c.error} onDismissError={() => c.setError("")}>
        <div style={{ flex: 1, overflow: "auto", padding: "1.25rem" }}>
          {c.openOrders.length === 0 ? (
            <div style={{ textAlign: "center", padding: "4rem 1rem", color: "var(--pos-muted)" }}>
              <p style={{ fontWeight: 600 }}>Nothing open</p>
              <p style={{ fontSize: "0.875rem", marginTop: "0.5rem" }}>Parked and active bills show up here</p>
            </div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, maxWidth: "32rem", marginLeft: "auto", marginRight: "auto", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {c.openOrders.map((o: PosOrder) => {
                const tbl = c.tables.find((t: PosTable) => t.id === o.tableId);
                const age = Math.round((Date.now() - new Date(o.openedAt).getTime()) / 60000);
                const parked = o.status === "PARKED";
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      className="pos-card"
                      style={{ width: "100%", padding: "1.25rem", textAlign: "left", cursor: "pointer", border: "none" }}
                      onClick={() => c.resumeOpenOrder(o)}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <span style={{ fontWeight: 700, fontSize: "1.0625rem" }}>{tbl?.name ?? "Takeaway"}</span>
                        <span
                          style={{
                            fontSize: "0.625rem",
                            fontWeight: 800,
                            textTransform: "uppercase",
                            padding: "0.2rem 0.5rem",
                            borderRadius: "999px",
                            background: parked ? "var(--color-saffron-light)" : "rgb(45 106 79 / 0.15)",
                            color: parked ? "var(--color-saffron-dark)" : "var(--color-success)",
                          }}
                        >
                          {parked ? "Parked" : "Open"}
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.75rem", color: "var(--pos-muted)", fontSize: "0.875rem" }}>
                        <span>
                          {o.lines.length} items · {age} min
                        </span>
                        <span style={{ fontWeight: 800, color: "var(--color-saffron)" }}>{fmt(o.totalGross)}</span>
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
