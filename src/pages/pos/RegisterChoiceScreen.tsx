import { useEffect, useState } from "react";
import { closeSession, getCurrentSession, type PosSession } from "../../api/pos";
import { fmt } from "../../lib/calc";
import { PosRoot } from "./ui";

type Props = {
  cashier: { id: string; name: string };
  onOpenRegister: () => void;
  onBack: () => void;
};

function initials(name: string) {
  return name.split(" ").map(p => p[0] ?? "").slice(0, 2).join("").toUpperCase();
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconOpenRegister() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
    </svg>
  );
}

function IconCloseRegister() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export function RegisterChoiceScreen({ cashier, onOpenRegister, onBack }: Props) {
  const [session, setSession]   = useState<PosSession | null | "loading">("loading");
  const [view, setView]         = useState<"choice" | "close-confirm">("choice");
  const [float_, setFloat]      = useState("0");
  const [closing, setClosing]   = useState(false);
  const [error, setError]       = useState("");

  useEffect(() => {
    getCurrentSession().then(setSession).catch(() => setSession(null));
  }, []);

  const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const hasSession = session !== null && session !== "loading";

  // ── Close register flow ────────────────────────────────────────────────────

  const confirmClose = async () => {
    if (!hasSession) return;
    setClosing(true);
    setError("");
    try {
      await closeSession((session as PosSession).id, Number(float_) || 0);
      onBack();                       // return to PIN screen — shift is over
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not close register");
    } finally {
      setClosing(false);
    }
  };

  // ── Render: close confirmation ─────────────────────────────────────────────

  if (view === "close-confirm") {
    return (
      <PosRoot>
        <div style={S.shell}>
          <div style={S.card}>

            {/* Header */}
            <div style={S.closeHeader}>
              <button type="button" style={S.backLink} onClick={() => { setView("choice"); setError(""); }}>
                ← Back
              </button>
              <h2 style={S.closeTitle}>Close Register</h2>
            </div>

            {/* Session info */}
            {hasSession && (
              <div style={S.sessionInfo}>
                <div style={S.sessionRow}>
                  <span style={S.sessionLabel}>Opening float</span>
                  <span style={S.sessionValue}>{fmt((session as PosSession).openingFloat)}</span>
                </div>
                {(session as PosSession).cashSalesTotal != null && (
                  <div style={S.sessionRow}>
                    <span style={S.sessionLabel}>Cash sales</span>
                    <span style={S.sessionValue}>{fmt((session as PosSession).cashSalesTotal!)}</span>
                  </div>
                )}
                {(session as PosSession).cardSalesTotal != null && (
                  <div style={S.sessionRow}>
                    <span style={S.sessionLabel}>Card sales</span>
                    <span style={S.sessionValue}>{fmt((session as PosSession).cardSalesTotal!)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Float input */}
            <div style={{ marginBottom: "1.25rem" }}>
              <label style={S.fieldLabel}>Cash in drawer now (PLN)</label>
              <input
                type="number"
                min={0}
                autoFocus
                value={float_}
                onChange={e => setFloat(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !closing && confirmClose()}
                style={S.floatInput}
              />
              {/* Quick float presets */}
              <div style={S.presets}>
                {[0, 100, 200, 500].map(p => (
                  <button
                    key={p}
                    type="button"
                    style={{
                      ...S.preset,
                      ...(Number(float_) === p ? S.presetActive : {}),
                    }}
                    onClick={() => setFloat(String(p))}
                  >
                    {p === 0 ? "0" : fmt(p)}
                  </button>
                ))}
              </div>
            </div>

            {error && <div style={S.errorBox}>{error}</div>}

            <button
              type="button"
              style={S.closeConfirmBtn}
              disabled={closing}
              onClick={confirmClose}
            >
              {closing ? "Closing…" : "Confirm close register"}
            </button>
          </div>
        </div>
      </PosRoot>
    );
  }

  // ── Render: main choice ────────────────────────────────────────────────────

  return (
    <PosRoot>
      <div style={S.shell}>
        <div style={S.card}>

          {/* Cashier identity */}
          <div style={S.identity}>
            <div style={S.avatar}>{initials(cashier.name)}</div>
            <div>
              <p style={S.welcomeText}>Welcome back</p>
              <p style={S.cashierName}>{cashier.name}</p>
            </div>
            <span style={S.clock}>{time}</span>
          </div>

          <p style={S.prompt}>What would you like to do?</p>

          {/* Choice tiles */}
          <div style={S.tiles}>
            {/* Open Register */}
            <button type="button" style={S.tile} onClick={onOpenRegister}>
              <div style={{ ...S.tileIcon, ...S.tileIconOpen }}>
                <IconOpenRegister />
              </div>
              <p style={S.tileTitle}>Open Register</p>
              <p style={S.tileSub}>
                {hasSession ? "Continue your shift" : "Start your shift"}
              </p>
            </button>

            {/* Close Register */}
            <button
              type="button"
              style={{
                ...S.tile,
                ...S.tileClose,
                ...(!hasSession ? S.tileDisabled : {}),
              }}
              disabled={!hasSession || session === null}
              onClick={() => { setView("close-confirm"); setError(""); }}
              title={!hasSession ? "No open register to close" : undefined}
            >
              <div style={{ ...S.tileIcon, ...S.tileIconClose }}>
                <IconCloseRegister />
              </div>
              <p style={S.tileTitle}>Close Register</p>
              <p style={S.tileSub}>
                {session === "loading"
                  ? "Checking…"
                  : hasSession
                    ? "End your shift"
                    : "No open session"}
              </p>
            </button>
          </div>

          {/* Back to PIN */}
          <button type="button" style={S.notYouBtn} onClick={onBack}>
            Not you? ← Back to PIN
          </button>
        </div>
      </div>
    </PosRoot>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#ede8df",
    padding: "1.5rem",
    fontFamily: "var(--font-sans)",
  },
  card: {
    width: "100%",
    maxWidth: "28rem",
    background: "#fff",
    borderRadius: "1.5rem",
    padding: "2rem",
    boxShadow: "0 2px 8px rgba(26 20 16 / 0.08), 0 16px 48px rgba(26 20 16 / 0.1)",
  },

  /* Identity row */
  identity: {
    display: "flex",
    alignItems: "center",
    gap: "0.875rem",
    marginBottom: "1.5rem",
    paddingBottom: "1.25rem",
    borderBottom: "1.5px solid rgba(26 20 16 / 0.07)",
  },
  avatar: {
    width: "3rem",
    height: "3rem",
    borderRadius: "999px",
    background: "var(--color-saffron-light)",
    border: "2px solid rgba(196 92 38 / 0.2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    fontSize: "0.9375rem",
    color: "var(--color-saffron-dark)",
    flexShrink: 0,
  },
  welcomeText: {
    fontSize: "0.75rem",
    color: "#7d7268",
    fontWeight: 500,
    margin: 0,
  },
  cashierName: {
    fontSize: "1.125rem",
    fontWeight: 700,
    letterSpacing: "-0.015em",
    color: "#1a1410",
    margin: 0,
    lineHeight: 1.2,
  },
  clock: {
    marginLeft: "auto",
    fontSize: "0.8125rem",
    fontWeight: 600,
    color: "#7d7268",
    fontVariantNumeric: "tabular-nums",
    flexShrink: 0,
  },

  prompt: {
    fontSize: "0.8125rem",
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "#7d7268",
    marginBottom: "1rem",
  },

  /* Tiles */
  tiles: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "0.875rem",
    marginBottom: "1.5rem",
  },
  tile: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "0.875rem",
    padding: "1.375rem",
    borderRadius: "1.25rem",
    border: "1.5px solid rgba(26 20 16 / 0.1)",
    background: "#f9f7f4",
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "var(--font-sans)",
    transition: "transform 0.1s, box-shadow 0.12s, border-color 0.12s",
    boxShadow: "0 1px 3px rgba(26 20 16 / 0.06)",
  },
  tileClose: {
    /* keep same base, just differentiate via icon */
  },
  tileDisabled: {
    opacity: 0.38,
    cursor: "not-allowed",
    pointerEvents: "none",
  },
  tileIcon: {
    width: "3rem",
    height: "3rem",
    borderRadius: "0.875rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  tileIconOpen: {
    background: "rgba(45 106 79 / 0.12)",
    color: "#2d6a4f",
  },
  tileIconClose: {
    background: "rgba(155 34 38 / 0.1)",
    color: "#9b2226",
  },
  tileTitle: {
    fontSize: "1rem",
    fontWeight: 700,
    letterSpacing: "-0.01em",
    color: "#1a1410",
    margin: 0,
    lineHeight: 1.2,
  },
  tileSub: {
    fontSize: "0.8125rem",
    color: "#7d7268",
    margin: 0,
    lineHeight: 1.3,
  },

  notYouBtn: {
    width: "100%",
    textAlign: "center",
    fontSize: "0.8125rem",
    color: "#7d7268",
    background: "none",
    border: "none",
    cursor: "pointer",
    fontFamily: "var(--font-sans)",
    padding: "0.25rem",
    transition: "color 0.12s",
  },

  /* Close confirmation view */
  closeHeader: {
    display: "flex",
    alignItems: "center",
    gap: "0.875rem",
    marginBottom: "1.5rem",
    paddingBottom: "1.25rem",
    borderBottom: "1.5px solid rgba(26 20 16 / 0.07)",
  },
  backLink: {
    fontSize: "0.875rem",
    fontWeight: 600,
    color: "var(--color-saffron)",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 0,
    fontFamily: "var(--font-sans)",
    flexShrink: 0,
  },
  closeTitle: {
    fontSize: "1.25rem",
    fontWeight: 700,
    letterSpacing: "-0.015em",
    color: "#1a1410",
    margin: 0,
  },
  sessionInfo: {
    background: "#f9f7f4",
    borderRadius: "1rem",
    padding: "1rem 1.25rem",
    marginBottom: "1.25rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  sessionRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "0.875rem",
  },
  sessionLabel: { color: "#7d7268" },
  sessionValue: { fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#1a1410" },
  fieldLabel: {
    display: "block",
    fontSize: "0.6875rem",
    fontWeight: 700,
    letterSpacing: "0.07em",
    textTransform: "uppercase",
    color: "#7d7268",
    marginBottom: "0.375rem",
  },
  floatInput: {
    width: "100%",
    padding: "0.875rem 1rem",
    borderRadius: "0.875rem",
    border: "1.5px solid rgba(26 20 16 / 0.12)",
    background: "#fff",
    fontSize: "1.75rem",
    fontWeight: 800,
    textAlign: "center" as const,
    fontFamily: "var(--font-sans)",
    color: "#1a1410",
    outline: "none",
    fontVariantNumeric: "tabular-nums",
    marginBottom: "0.625rem",
  },
  presets: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "0.5rem",
  },
  preset: {
    padding: "0.375rem 0.5rem",
    borderRadius: "999px",
    border: "1.5px solid rgba(26 20 16 / 0.1)",
    background: "#f9f7f4",
    fontSize: "0.8125rem",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "var(--font-sans)",
    color: "#3c332a",
    fontVariantNumeric: "tabular-nums",
  },
  presetActive: {
    background: "#1a1410",
    color: "#fff",
    borderColor: "#1a1410",
  },
  errorBox: {
    padding: "0.625rem 1rem",
    borderRadius: "0.75rem",
    background: "rgba(155 34 38 / 0.07)",
    border: "1px solid rgba(155 34 38 / 0.18)",
    color: "#9b2226",
    fontSize: "0.8125rem",
    fontWeight: 500,
    textAlign: "center" as const,
    marginBottom: "1rem",
  },
  closeConfirmBtn: {
    width: "100%",
    padding: "0.875rem",
    borderRadius: "0.875rem",
    border: "none",
    background: "#9b2226",
    color: "#fff",
    fontSize: "0.9375rem",
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "var(--font-sans)",
    transition: "opacity 0.12s",
  },
};
