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
import { RegisterChoiceScreen } from "./pos/RegisterChoiceScreen";
import { usePosController } from "./pos/usePosController";

const POS_TOKEN_KEY = "pos_token";

type Stage = "pin" | "register" | "pos";

export function PosApp() {
  const [stage, setStage]   = useState<Stage>("pin");
  const [cashier, setCashier] = useState<{ id: string; name: string } | null>(null);

  // Restore session from localStorage on mount
  useEffect(() => {
    if (localStorage.getItem(POS_TOKEN_KEY)) {
      // Token already present — skip PIN, go straight to register choice
      // (cashier name will be missing but PosAppInner loads from session)
      setStage("register");
    }
  }, []);

  const handlePinAuth = (token: string, c: { id: string; name: string }) => {
    localStorage.setItem(POS_TOKEN_KEY, token);
    localStorage.setItem("token", token);
    setCashier(c);
    setStage("register");
  };

  const handleOpenRegister = () => setStage("pos");

  const handleLogout = () => {
    localStorage.removeItem(POS_TOKEN_KEY);
    localStorage.removeItem("token");
    setCashier(null);
    setStage("pin");
  };

  if (stage === "pin") {
    return <PinScreen onAuth={handlePinAuth} />;
  }

  if (stage === "register") {
    return (
      <RegisterChoiceScreen
        cashier={cashier ?? { id: "", name: "Cashier" }}
        onOpenRegister={handleOpenRegister}
        onBack={handleLogout}
      />
    );
  }

  return <PosAppInner onLogout={handleLogout} />;
}

// ─── Active POS ───────────────────────────────────────────────────────────────

function PosAppInner({ onLogout }: { onLogout: () => void }) {
  const c = usePosController();

  const handleShiftClosed = () => {
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

  if (!c.session) {
    return <SessionOpenScreen onOpen={c.setSession} />;
  }

  return (
    <>
      {c.screen === "hub"          && <HubScreen c={c} />}
      {c.screen === "tables"       && <TablesScreen c={c} />}
      {c.screen === "delivery"     && <DeliveryScreen c={c} />}
      {c.screen === "order"        && <OrderScreen c={c} />}
      {c.screen === "checkout"     && <CheckoutScreen c={c} />}
      {c.screen === "open-orders"  && <OpenOrdersScreen c={c} />}
      <PosModals c={c} session={c.session} onShiftClosed={handleShiftClosed} />
    </>
  );
}
