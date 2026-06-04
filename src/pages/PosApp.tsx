import { useState } from "react";
import "./pos/pos.css";
import { Spinner } from "../components/ui/Spinner";
import { PosModals } from "./pos/modals";
import { PosRoot } from "./pos/ui";
import {
  CheckoutScreen,
  DeliveryScreen,
  HubScreen,
  OpenOrdersScreen,
  OrderScreen,
  TablesScreen,
} from "./pos/screens";
import { PinScreen } from "./pos/PinScreen";
import { usePosController } from "./pos/usePosController";

const POS_TOKEN_KEY = "pos_token";

export function PosApp() {
  const [authed, setAuthed] = useState(() => !!localStorage.getItem(POS_TOKEN_KEY));

  const handlePinAuth = (token: string) => {
    localStorage.setItem(POS_TOKEN_KEY, token);
    localStorage.setItem("token", token);
    setAuthed(true);
  };

  const handleLogout = () => {
    localStorage.removeItem(POS_TOKEN_KEY);
    localStorage.removeItem("token");
    setAuthed(false);
  };

  if (!authed) return <PinScreen onAuth={handlePinAuth} />;

  return <PosAppInner onLogout={handleLogout} />;
}

function PosAppInner({ onLogout }: { onLogout: () => void }) {
  const c = usePosController();

  // Register closed → stay on hub showing "Open Register"
  const handleShiftClosed = () => {
    c.setSession(null);
    c.setScreen("hub");
  };

  if (c.session === "loading" || c.loading) {
    return (
      <PosRoot>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
          <Spinner label="Loading…" />
        </div>
      </PosRoot>
    );
  }

  // Hub is always the entry point — it handles both open and closed register states
  return (
    <>
      {c.screen === "hub"         && <HubScreen c={c} onLogout={onLogout} />}
      {c.screen === "tables"      && <TablesScreen c={c} />}
      {c.screen === "delivery"    && <DeliveryScreen c={c} />}
      {c.screen === "order"       && <OrderScreen c={c} />}
      {c.screen === "checkout"    && <CheckoutScreen c={c} />}
      {c.screen === "open-orders" && <OpenOrdersScreen c={c} />}
      {c.session && (
        <PosModals c={c} session={c.session} onShiftClosed={handleShiftClosed} />
      )}
    </>
  );
}
