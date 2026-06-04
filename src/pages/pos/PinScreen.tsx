import { useEffect, useState } from "react";
import { getScheduledCashiers, pinAuth, type PosCashierToday } from "../../api/pos";
import { PosRoot } from "./ui";

type Props = {
  onAuth: (token: string, cashier: { id: string; name: string }) => void;
};

function initials(name: string) {
  return name
    .split(" ")
    .map(p => p[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function PinScreen({ onAuth }: Props) {
  const [cashiers, setCashiers] = useState<PosCashierToday[]>([]);
  const [selected, setSelected] = useState<PosCashierToday | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );

  useEffect(() => {
    getScheduledCashiers().then(setCashiers).catch(() => setCashiers([]));
    const id = setInterval(() => {
      setTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    }, 15_000);
    return () => clearInterval(id);
  }, []);

  // Auto-submit once 4 digits entered
  useEffect(() => {
    if (pin.length === 4 && selected) {
      submit(pin);
    }
  }, [pin, selected]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (p: string) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await pinAuth(p);
      onAuth(res.token, res.cashier);
    } catch {
      setError("Wrong PIN or not scheduled today");
      setPin("");
    } finally {
      setBusy(false);
    }
  };

  const press = (key: string) => {
    if (busy) return;
    if (key === "⌫") {
      setPin(p => p.slice(0, -1));
      setError("");
    } else if (pin.length < 4) {
      setPin(p => p + key);
    }
  };

  const selectCashier = (c: PosCashierToday) => {
    if (!c.hasPin) return;
    setSelected(c);
    setPin("");
    setError("");
  };

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <PosRoot>
      <div style={styles.root}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.brand}>
            <div style={styles.logo}>S</div>
            <span style={styles.brandName}>Saffron</span>
          </div>
          <span style={styles.clock}>{time}</span>
        </div>

        <div style={styles.body}>
          <p style={styles.date}>{today}</p>

          {/* Cashier grid */}
          <div style={styles.section}>
            <p style={styles.sectionLabel}>
              {cashiers.length === 0 ? "No cashiers scheduled today" : "Who are you?"}
            </p>
            <div style={styles.cashierGrid}>
              {cashiers.map(c => (
                <button
                  key={c.id}
                  type="button"
                  style={{
                    ...styles.cashierCard,
                    ...(selected?.id === c.id ? styles.cashierCardActive : {}),
                    ...(!c.hasPin ? styles.cashierCardNoPin : {}),
                  }}
                  onClick={() => selectCashier(c)}
                  title={!c.hasPin ? "No PIN set — ask your manager" : undefined}
                >
                  <div
                    style={{
                      ...styles.avatar,
                      ...(selected?.id === c.id ? styles.avatarActive : {}),
                    }}
                  >
                    {initials(c.name)}
                  </div>
                  <span style={styles.cashierName}>{c.name.split(" ")[0]}</span>
                  {!c.hasPin && <span style={styles.noPinBadge}>No PIN</span>}
                </button>
              ))}
            </div>
          </div>

          {/* PIN entry */}
          {selected && (
            <div style={styles.pinSection}>
              <p style={styles.pinPrompt}>
                PIN for <strong>{selected.name}</strong>
              </p>

              {/* Dot indicators */}
              <div style={styles.dots}>
                {[0, 1, 2, 3].map(i => (
                  <div
                    key={i}
                    style={{
                      ...styles.dot,
                      ...(i < pin.length ? styles.dotFilled : {}),
                    }}
                  />
                ))}
              </div>

              {error && <p style={styles.error}>{error}</p>}

              {/* Numpad */}
              <div style={styles.numpad}>
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((key, idx) => (
                  key === "" ? (
                    <div key={idx} />
                  ) : (
                    <button
                      key={key}
                      type="button"
                      style={{
                        ...styles.numKey,
                        ...(key === "⌫" ? styles.numKeyBack : {}),
                        ...(busy ? styles.numKeyBusy : {}),
                      }}
                      onClick={() => press(key)}
                      disabled={busy}
                    >
                      {busy && pin.length === 4 ? "…" : key}
                    </button>
                  )
                ))}
              </div>

              <button
                type="button"
                style={styles.cancelBtn}
                onClick={() => { setSelected(null); setPin(""); setError(""); }}
              >
                ← Change
              </button>
            </div>
          )}

          {!selected && cashiers.length > 0 && (
            <p style={styles.hint}>Tap your name to log in</p>
          )}
        </div>
      </div>
    </PosRoot>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    background: "linear-gradient(160deg, #2e1a0e 0%, #6b3015 40%, var(--color-saffron) 100%)",
    color: "#fff",
    fontFamily: "var(--font-sans)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "1.25rem 1.5rem",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: "0.625rem",
  },
  logo: {
    width: "2.25rem",
    height: "2.25rem",
    borderRadius: "0.75rem",
    background: "rgba(255 255 255 / 0.2)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    fontSize: "1.125rem",
  },
  brandName: {
    fontFamily: "var(--font-display)",
    fontSize: "1.375rem",
    fontWeight: 400,
    letterSpacing: "-0.02em",
    opacity: 0.95,
  },
  clock: {
    fontSize: "0.875rem",
    fontWeight: 600,
    opacity: 0.8,
    fontVariantNumeric: "tabular-nums",
  },
  body: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "1rem 1.5rem 2rem",
  },
  date: {
    fontSize: "0.875rem",
    opacity: 0.7,
    marginBottom: "2rem",
    textAlign: "center",
  },
  section: {
    width: "100%",
    maxWidth: "36rem",
  },
  sectionLabel: {
    fontSize: "0.75rem",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    opacity: 0.6,
    marginBottom: "0.875rem",
    textAlign: "center",
  },
  cashierGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.75rem",
    justifyContent: "center",
  },
  cashierCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.5rem",
    padding: "1rem 1.25rem",
    borderRadius: "1.125rem",
    border: "2px solid rgba(255 255 255 / 0.15)",
    background: "rgba(255 255 255 / 0.08)",
    backdropFilter: "blur(8px)",
    cursor: "pointer",
    transition: "transform 0.1s, background 0.15s, border-color 0.15s",
    minWidth: "5.5rem",
    fontFamily: "var(--font-sans)",
  },
  cashierCardActive: {
    background: "rgba(255 255 255 / 0.2)",
    borderColor: "rgba(255 255 255 / 0.7)",
    transform: "scale(1.04)",
  },
  cashierCardNoPin: {
    opacity: 0.45,
    cursor: "not-allowed",
  },
  avatar: {
    width: "2.75rem",
    height: "2.75rem",
    borderRadius: "999px",
    background: "rgba(255 255 255 / 0.15)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: "0.875rem",
    letterSpacing: "0.02em",
  },
  avatarActive: {
    background: "#fff",
    color: "var(--color-saffron-dark)",
  },
  cashierName: {
    fontSize: "0.875rem",
    fontWeight: 600,
    color: "#fff",
  },
  noPinBadge: {
    fontSize: "0.5625rem",
    fontWeight: 700,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    opacity: 0.6,
    marginTop: "-0.25rem",
  },
  pinSection: {
    marginTop: "2rem",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: "100%",
    maxWidth: "20rem",
  },
  pinPrompt: {
    fontSize: "0.9375rem",
    opacity: 0.85,
    marginBottom: "1.25rem",
    textAlign: "center",
  },
  dots: {
    display: "flex",
    gap: "1rem",
    marginBottom: "1rem",
  },
  dot: {
    width: "1rem",
    height: "1rem",
    borderRadius: "999px",
    border: "2px solid rgba(255 255 255 / 0.4)",
    background: "transparent",
    transition: "background 0.15s, border-color 0.15s",
  },
  dotFilled: {
    background: "#fff",
    borderColor: "#fff",
  },
  error: {
    color: "#ffc4c4",
    fontSize: "0.875rem",
    marginBottom: "0.75rem",
    textAlign: "center",
  },
  numpad: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "0.625rem",
    width: "100%",
    marginBottom: "1.25rem",
  },
  numKey: {
    height: "3.5rem",
    borderRadius: "1rem",
    border: "1.5px solid rgba(255 255 255 / 0.2)",
    background: "rgba(255 255 255 / 0.1)",
    backdropFilter: "blur(4px)",
    color: "#fff",
    fontSize: "1.375rem",
    fontWeight: 700,
    fontFamily: "var(--font-sans)",
    cursor: "pointer",
    transition: "transform 0.1s, background 0.12s",
  },
  numKeyBack: {
    fontSize: "1.125rem",
    opacity: 0.7,
  },
  numKeyBusy: {
    opacity: 0.5,
    pointerEvents: "none",
  },
  cancelBtn: {
    background: "none",
    border: "none",
    color: "rgba(255 255 255 / 0.6)",
    fontSize: "0.875rem",
    cursor: "pointer",
    padding: "0.5rem",
  },
  hint: {
    marginTop: "2.5rem",
    opacity: 0.5,
    fontSize: "0.875rem",
    textAlign: "center",
  },
};
