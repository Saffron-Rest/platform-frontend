import { useEffect, useState } from "react";
import { getScheduledCashiers, pinAuth, type PosCashierToday } from "../../api/pos";
import { PosRoot } from "./ui";

type Props = {
  onAuth: (token: string, cashier: { id: string; name: string }) => void;
};

function initials(name: string) {
  return name.split(" ").map(p => p[0] ?? "").slice(0, 2).join("").toUpperCase();
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5)  return "Good night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// ─── Illustration (saffron tones on warm light bg) ───────────────────────────

function RestaurantIllustration() {
  const o = "rgba(154 69 32 / ";   // saffron-dark base
  const s = "rgba(196 92 38 / ";   // saffron base

  return (
    <svg viewBox="0 0 400 420" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", maxWidth: 360, display: "block" }}>

      {/* Background rings */}
      <circle cx="200" cy="230" r="190" fill={`${s}0.06)`} />
      <circle cx="200" cy="230" r="155" fill={`${s}0.07)`} />
      <circle cx="200" cy="230" r="118" fill={`${s}0.08)`} />

      {/* Plate shadow */}
      <ellipse cx="200" cy="340" rx="118" ry="13" fill={`${o}0.12)`} />

      {/* Plate outer */}
      <circle cx="200" cy="292" r="118" fill={`${s}0.1)`} stroke={`${s}0.35)`} strokeWidth="1.5" />
      {/* Plate inner */}
      <circle cx="200" cy="292" r="98"  fill={`${s}0.07)`} stroke={`${s}0.2)`}  strokeWidth="1" />

      {/* Cloche / dome */}
      <path
        d="M 88 292 C 88 197 124 150 200 147 C 276 150 312 197 312 292 Z"
        fill={`${s}0.16)`}
        stroke={`${o}0.45)`}
        strokeWidth="1.5"
      />
      {/* Dome highlight */}
      <path
        d="M 108 262 C 110 212 138 174 185 164"
        stroke={`${s}0.3)`}
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
      />

      {/* Handle base */}
      <rect x="185" y="130" width="30" height="20" rx="4"
        fill={`${s}0.3)`} stroke={`${o}0.5)`} strokeWidth="1.5" />
      {/* Handle knob */}
      <circle cx="200" cy="124" r="10"
        fill={`${s}0.45)`} stroke={`${o}0.65)`} strokeWidth="1.5" />

      {/* Fork */}
      <g transform="translate(62,168) rotate(-6)">
        <rect x="-4" y="55"  width="8" height="88" rx="4" fill={`${o}0.65)`} />
        <rect x="-4" y="30"  width="8" height="28" rx="2" fill={`${o}0.65)`} />
        <rect x="-7" y="-28" width="3" height="60" rx="1.5" fill={`${o}0.65)`} />
        <rect x="-2.5" y="-28" width="3" height="60" rx="1.5" fill={`${o}0.65)`} />
        <rect x="2"  y="-28" width="3" height="60" rx="1.5" fill={`${o}0.65)`} />
        <rect x="6.5" y="-28" width="3" height="60" rx="1.5" fill={`${o}0.65)`} />
      </g>

      {/* Spoon */}
      <g transform="translate(338,168) rotate(6)">
        <rect x="-4" y="55" width="8" height="88" rx="4" fill={`${o}0.65)`} />
        <rect x="-4" y="20" width="8" height="38" rx="2" fill={`${o}0.65)`} />
        <ellipse cx="0" cy="0" rx="14" ry="22" fill={`${o}0.65)`} />
        <ellipse cx="-3" cy="-5" rx="5" ry="8" fill={`${s}0.3)`} />
      </g>

      {/* Steam */}
      <path d="M 175 147 Q 163 122 174 100 Q 185 78 174 56" stroke={`${s}0.45)`} strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <path d="M 200 142 Q 188 114 200 90 Q 212 66 200 44" stroke={`${s}0.38)`} strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <path d="M 225 147 Q 237 122 226 100 Q 215 78 226 56" stroke={`${s}0.3)`}  strokeWidth="3.5" strokeLinecap="round" fill="none" />

      {/* Stars */}
      <path d="M108 78 l3-8 3 8 8 3-8 3-3 8-3-8-8-3z" fill={`${o}0.7)`} />
      <path d="M296 58 l2.5-6 2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5z" fill={`${o}0.6)`} />
      <path d="M340 148 l2-5 2 5 5 2-5 2-2 5-2-5-5-2z" fill={`${o}0.5)`} />

      {/* Decorative dots */}
      <circle cx="96"  cy="190" r="3.5" fill={`${s}0.45)`} />
      <circle cx="310" cy="168" r="3"   fill={`${s}0.4)`}  />
      <circle cx="72"  cy="290" r="2.5" fill={`${s}0.32)`} />
      <circle cx="330" cy="260" r="2.5" fill={`${s}0.32)`} />
      <circle cx="150" cy="388" r="2"   fill={`${s}0.25)`} />
      <circle cx="255" cy="382" r="2.5" fill={`${s}0.25)`} />
      <circle cx="136" cy="90"  r="2"   fill={`${o}0.4)`}  />
      <circle cx="268" cy="78"  r="2.5" fill={`${o}0.35)`} />
    </svg>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export function PinScreen({ onAuth }: Props) {
  const [cashiers, setCashiers] = useState<PosCashierToday[]>([]);
  const [selected, setSelected] = useState<PosCashierToday | null>(null);
  const [pin, setPin]           = useState("");
  const [error, setError]       = useState("");
  const [busy, setBusy]         = useState(false);
  const [time, setTime]         = useState(() =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );

  useEffect(() => {
    getScheduledCashiers().then(setCashiers).catch(() => setCashiers([]));
    const id = setInterval(() =>
      setTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))
    , 15_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (pin.length === 4 && selected) doAuth(pin);
  }, [pin]); // eslint-disable-line react-hooks/exhaustive-deps

  const doAuth = async (p: string) => {
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
    setError("");
    if (key === "⌫") return setPin(p => p.slice(0, -1));
    if (pin.length < 4) setPin(p => p + key);
  };

  const selectCashier = (c: PosCashierToday) => {
    if (!c.hasPin) return;
    setSelected(c);
    setPin("");
    setError("");
  };

  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric",
  });

  return (
    <PosRoot>
      <div style={S.shell}>

        {/* ── LEFT — warm light brand panel ───────────────────────────── */}
        <div style={S.left}>
          <div style={S.leftHeader}>
            <div style={S.logoBox}>S</div>
            <span style={S.logoName}>Saffron</span>
          </div>

          <div style={S.illus}>
            <RestaurantIllustration />
          </div>

          <div style={S.leftFooter}>
            <p style={S.tagline}>Ready for service</p>
            <p style={S.taglineSub}>Select your name and enter your PIN</p>
          </div>
        </div>

        {/* ── RIGHT — PIN form ─────────────────────────────────────────── */}
        <div style={S.right}>
          <div style={S.rightInner}>

            {/* Greeting */}
            <div style={S.greeting}>
              <p style={S.greetingMain}>{greeting()}</p>
              <div style={S.greetingRow}>
                <span style={S.greetingDate}>{dateLabel}</span>
                <span style={S.greetingTime}>{time}</span>
              </div>
            </div>

            {/* Cashier chips */}
            <div>
              <p style={S.sectionLabel}>
                {cashiers.length === 0 ? "No cashiers scheduled today" : "Who are you?"}
              </p>
              {cashiers.length > 0 && (
                <div style={S.chips}>
                  {cashiers.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectCashier(c)}
                      title={!c.hasPin ? "No PIN — ask your manager" : undefined}
                      style={{
                        ...S.chip,
                        ...(selected?.id === c.id ? S.chipActive  : {}),
                        ...(!c.hasPin            ? S.chipDisabled : {}),
                      }}
                    >
                      <span style={{ ...S.chipAvatar, ...(selected?.id === c.id ? S.chipAvatarActive : {}) }}>
                        {initials(c.name)}
                      </span>
                      <span style={S.chipName}>{c.name.split(" ")[0]}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* PIN zone */}
            <div style={S.pinZone}>
              <div style={S.pinStatusRow}>
                {selected ? (
                  <span style={S.pinFor}>
                    PIN for{" "}
                    <strong style={{ color: "var(--color-saffron-dark)" }}>
                      {selected.name}
                    </strong>
                  </span>
                ) : (
                  <span style={{ ...S.pinFor, opacity: 0.4 }}>← Select your name above</span>
                )}
                {selected && (
                  <button
                    type="button"
                    style={S.changeBtn}
                    onClick={() => { setSelected(null); setPin(""); setError(""); }}
                  >
                    Change
                  </button>
                )}
              </div>

              {/* Dots */}
              <div style={S.dots}>
                {[0, 1, 2, 3].map(i => (
                  <div
                    key={i}
                    style={{
                      ...S.dot,
                      ...(i < pin.length ? S.dotFilled  : {}),
                      ...(!selected      ? S.dotInactive : {}),
                    }}
                  />
                ))}
              </div>

              {error && <div style={S.errorBox}>{error}</div>}

              {/* Numpad */}
              <div style={S.numpad}>
                {(["1","2","3","4","5","6","7","8","9","","0","⌫"] as const).map((key, i) =>
                  key === "" ? <div key={i} /> : (
                    <button
                      key={key}
                      type="button"
                      disabled={!selected || busy}
                      onClick={() => press(key)}
                      style={{
                        ...S.numKey,
                        ...(key === "⌫"          ? S.numKeyBack : {}),
                        ...(!selected || busy    ? S.numKeyOff  : {}),
                      }}
                    >
                      {busy && pin.length === 4 ? "…" : key}
                    </button>
                  )
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </PosRoot>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  shell: {
    display: "flex",
    minHeight: "100vh",
    fontFamily: "var(--font-sans)",
  },

  /* LEFT — warm light amber panel */
  left: {
    flex: "0 0 45%",
    display: "flex",
    flexDirection: "column",
    background: "linear-gradient(148deg, #fef6ed 0%, #fde4c0 55%, #f8cfa0 100%)",
    padding: "1.75rem",
    overflow: "hidden",
  },
  leftHeader: {
    display: "flex",
    alignItems: "center",
    gap: "0.625rem",
    flexShrink: 0,
  },
  logoBox: {
    width: "2.25rem",
    height: "2.25rem",
    borderRadius: "0.75rem",
    background: "rgba(196 92 38 / 0.15)",
    border: "1.5px solid rgba(196 92 38 / 0.25)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    fontSize: "1.125rem",
    color: "var(--color-saffron-dark)",
    flexShrink: 0,
  },
  logoName: {
    fontFamily: "var(--font-display)",
    fontSize: "1.5rem",
    fontWeight: 400,
    letterSpacing: "-0.025em",
    color: "var(--color-saffron-dark)",
  },
  illus: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "1rem 0",
  },
  leftFooter: {
    flexShrink: 0,
    paddingBottom: "0.5rem",
  },
  tagline: {
    fontSize: "1.375rem",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    color: "var(--color-saffron-dark)",
    margin: 0,
    lineHeight: 1.2,
  },
  taglineSub: {
    fontSize: "0.875rem",
    color: "rgba(154 69 32 / 0.65)",
    margin: "0.375rem 0 0",
    lineHeight: 1.5,
  },

  /* RIGHT — clean white form */
  right: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#ffffff",
    padding: "2rem 1.5rem",
    overflow: "auto",
  },
  rightInner: {
    width: "100%",
    maxWidth: "22rem",
    display: "flex",
    flexDirection: "column",
    gap: "1.5rem",
  },

  greeting: {
    paddingBottom: "1.125rem",
    borderBottom: "1.5px solid rgba(26 20 16 / 0.07)",
  },
  greetingMain: {
    fontSize: "1.5rem",
    fontWeight: 700,
    letterSpacing: "-0.025em",
    color: "#1a1410",
    margin: 0,
    lineHeight: 1.2,
  },
  greetingRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: "0.3rem",
  },
  greetingDate: { fontSize: "0.8125rem", color: "#7d7268", fontWeight: 500 },
  greetingTime: { fontSize: "0.8125rem", color: "#7d7268", fontWeight: 600, fontVariantNumeric: "tabular-nums" },

  sectionLabel: {
    fontSize: "0.6875rem",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#7d7268",
    marginBottom: "0.625rem",
  },
  chips: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.5rem",
  },
  chip: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.4375rem 0.875rem 0.4375rem 0.5rem",
    borderRadius: "999px",
    border: "1.5px solid rgba(26 20 16 / 0.1)",
    background: "#f9f7f4",
    cursor: "pointer",
    fontFamily: "var(--font-sans)",
    transition: "transform 0.1s, border-color 0.12s, background 0.12s",
    boxShadow: "0 1px 2px rgba(26 20 16 / 0.05)",
  },
  chipActive: {
    borderColor: "var(--color-saffron)",
    background: "var(--color-saffron-light)",
    transform: "scale(1.03)",
  },
  chipDisabled: { opacity: 0.38, cursor: "not-allowed" },
  chipAvatar: {
    width: "1.75rem",
    height: "1.75rem",
    borderRadius: "999px",
    background: "rgba(26 20 16 / 0.08)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "0.625rem",
    fontWeight: 800,
    color: "#3c332a",
    flexShrink: 0,
  },
  chipAvatarActive: { background: "var(--color-saffron)", color: "#fff" },
  chipName: { fontSize: "0.875rem", fontWeight: 600, color: "#1a1410" },

  pinZone: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  pinStatusRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pinFor: { fontSize: "0.875rem", color: "#3c332a" },
  changeBtn: {
    fontSize: "0.8125rem",
    fontWeight: 600,
    color: "var(--color-saffron)",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 0,
    fontFamily: "var(--font-sans)",
  },
  dots: {
    display: "flex",
    gap: "0.875rem",
    justifyContent: "center",
    padding: "0.25rem 0",
  },
  dot: {
    width: "0.9375rem",
    height: "0.9375rem",
    borderRadius: "999px",
    border: "2px solid rgba(196 92 38 / 0.28)",
    background: "transparent",
    transition: "background 0.15s, border-color 0.15s, transform 0.1s",
  },
  dotFilled: {
    background: "var(--color-saffron)",
    borderColor: "var(--color-saffron)",
    transform: "scale(1.18)",
  },
  dotInactive: { borderColor: "rgba(26 20 16 / 0.1)" },
  errorBox: {
    padding: "0.625rem 1rem",
    borderRadius: "0.75rem",
    background: "rgba(155 34 38 / 0.07)",
    border: "1px solid rgba(155 34 38 / 0.18)",
    color: "#9b2226",
    fontSize: "0.8125rem",
    fontWeight: 500,
    textAlign: "center",
  },
  numpad: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "0.5rem",
  },
  numKey: {
    height: "3.75rem",
    borderRadius: "1rem",
    border: "1.5px solid rgba(26 20 16 / 0.09)",
    background: "#f9f7f4",
    color: "#1a1410",
    fontSize: "1.375rem",
    fontWeight: 700,
    fontFamily: "var(--font-sans)",
    cursor: "pointer",
    boxShadow: "0 1px 3px rgba(26 20 16 / 0.06)",
    transition: "transform 0.09s, background 0.1s",
  },
  numKeyBack: { fontSize: "1.125rem", color: "#7d7268" },
  numKeyOff: { opacity: 0.32, cursor: "not-allowed", boxShadow: "none" },
};
