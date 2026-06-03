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
import { usePosController } from "./pos/usePosController";

/**
 * Saffron POS — rebuilt UX/UI from zero.
 *
 * Flow: Hub → Where (table / delivery) → Order (menu) → Checkout (pay)
 * Visual: warm light surfaces, large touch targets, category sidebar, payment numpad.
 */
export function PosApp() {
  const c = usePosController();

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
      {c.screen === "hub" && <HubScreen c={c} />}
      {c.screen === "tables" && <TablesScreen c={c} />}
      {c.screen === "delivery" && <DeliveryScreen c={c} />}
      {c.screen === "order" && <OrderScreen c={c} />}
      {c.screen === "checkout" && <CheckoutScreen c={c} />}
      {c.screen === "open-orders" && <OpenOrdersScreen c={c} />}
      <PosModals c={c} session={c.session} />
    </>
  );
}
