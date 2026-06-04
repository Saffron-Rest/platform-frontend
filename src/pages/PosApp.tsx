import { useEffect, useState } from "react";
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
  SessionOpenScreen,
  TablesScreen,
} from "./pos/screens";
import { PinScreen } from "./pos/PinScreen";
import { usePosController } from "./pos/usePosController";

const POS_TOKEN_KEY = "pos_token";

export function PosApp() {
  // POS uses its own token key so it doesn't collide with the main platform JWT.
  const [posToken, setPosToken] = useState<string | null>(() =>
    localStorage.getItem(POS_TOKEN_KEY)
  );

  const handlePinAuth = (token: string) => {
    localStorage.setItem(POS_TOKEN_KEY, token);
    // Also set as the main token so all api() calls work
    localStorage.setItem("token", token);
    setPosToken(token);
  };

  // Keep the main "token" in sync when pos_token is cleared (shift end)
  useEffect(() => {
    if (!posToken) {
      localStorage.removeItem(POS_TOKEN_KEY);
      localStorage.removeItem("token");
    }
  }, [posToken]);

  // Show PIN screen when no token
  if (!posToken) {
    return <PinScreen onAuth={handlePinAuth} />;
  }

  return <PosAppInner onLogout={() => setPosToken(null)} />;
}

function PosAppInner({ onLogout }: { onLogout: () => void }) {
  const c = usePosController();

  // When the shift is closed, clear POS auth and show PIN screen again
  const handleSessionClosed = () => {
    c.setSession(null);
    onLogout();
  };

  if (c.session === "loading" || c.loading) {
    return (
      <PosRoot>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
          <Spinner label="Loading POS…" />
        </div>
      </PosRoot>
    );
  }

  // 401 from the server means the token expired — return to PIN screen
  if (c.error === "401" || c.error?.includes("Unauthorized")) {
    onLogout();
    return null;
  }

  if (!c.session) {
    return <SessionOpenScreen onOpen={c.setSession} />;
  }

  return (
    <>
      {c.screen === "hub" && <HubScreen c={c} />}
      {c.screen === "tables" && <TablesScreen c={c} />}
      {c.screen === "delivery" && <DeliveryScreen c={c} />}
      {c.screen === "order" && <OrderScreen c={c} />}
      {c.screen === "checkout" && <CheckoutScreen c={c} />}
      {c.screen === "open-orders" && <OpenOrdersScreen c={c} />}
      <PosModals c={c} session={c.session} onShiftClosed={handleSessionClosed} />
    </>
  );
}
