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

// ─── Illustration ────────────────────────────────────────────────────────────

function RestaurantIllustration() {
  return (
    <svg viewBox="0 0 400 420" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", maxWidth: 380, display: "block" }}>
      {/* Background rings */}
      <circle cx="200" cy="230" r="190" fill="rgba(255,255,255,0.03)" />
      <circle cx="200" cy="230" r="155" fill="rgba(255,255,255,0.04)" />
      <circle cx="200" cy="230" r="118" fill="rgba(255,255,255,0.05)" />

      {/* Plate shadow */}
      <ellipse cx="200" cy="338" rx="118" ry="14" fill="rgba(0,0,0,0.22)" />

      {/* Plate outer ring */}
      <circle cx="200" cy="290" r="118" fill="rgba(255,255,255,0.09)" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" />
      {/* Plate inner ring */}
      <circle cx="200" cy="290" r="98" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />

      {/* Cloche / dome */}
      <path
        d="M 88 290 C 88 195 124 148 200 145 C 276 148 312 195 312 290 Z"
        fill="rgba(255,255,255,0.14)"
        stroke="rgba(255,255,255,0.38)"
        strokeWidth="1.5"
      />
      {/* Dome highlight */}
      <path
        d="M 108 260 C 110 210 138 172 185 162"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
      />

      {/* Dome handle base */}
      <rect x="185" y="128" width="30" height="20" rx="4" fill="rgba(255,255,255,0.28)" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" />
      {/* Dome handle knob */}
      <circle cx="200" cy="122" r="10" fill="rgba(255,255,255,0.45)" stroke="rgba(255,255,255,0.65)" strokeWidth="1.5" />

      {/* Fork (left) */}
      <g transform="translate(62, 168) rotate(-6)">
        {/* Handle */}
        <rect x="-4" y="55" width="8" height="88" rx="4" fill="rgba(255,255,255,0.6)" />
        {/* Neck */}
        <rect x="-4" y="30" width="8" height="28" rx="2" fill="rgba(255,255,255,0.6)" />
        {/* Tines */}
        <rect x="-7" y="-28" width="3" height="60" rx="1.5" fill="rgba(255,255,255,0.6)" />
        <rect x="-2.5" y="-28" width="3" height="60" rx="1.5" fill="rgba(255,255,255,0.6)" />
        <rect x="2" y="-28" width="3" height="60" rx="1.5" fill="rgba(255,255,255,0.6)" />
        <rect x="6.5" y="-28" width="3" height="60" rx="1.5" fill="rgba(255,255,255,0.6)" />
      </g>

      {/* Spoon (right) */}
      <g transform="translate(338, 168) rotate(6)">
        {/* Handle */}
        <rect x="-4" y="55" width="8" height="88" rx="4" fill="rgba(255,255,255,0.6)" />
        {/* Neck */}
        <rect x="-4" y="20" width="8" height="38" rx="2" fill="rgba(255,255,255,0.6)" />
        {/* Bowl */}
        <ellipse cx="0" cy="0" rx="14" ry="22" fill="rgba(255,255,255,0.6)" />
        {/* Bowl shine */}
        <ellipse cx="-3" cy="-5" rx="5" ry="8" fill="rgba(255,255,255,0.35)" />
      </g>

      {/* Steam wisps */}
      <path d="M 175 145 Q 163 120 174 98 Q 185 76 174 54" stroke="rgba(255,255,255,0.32)" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <path d="M 200 140 Q 188 112 200 88 Q 212 64 200 42" stroke="rgba(255,255,255,0.28)" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <path d="M 225 145 Q 237 120 226 98 Q 215 76 226 54" stroke="rgba(255,255,255,0.22)" strokeWidth="3.5" strokeLinecap="round" fill="none" />

      {/* Stars / sparkles */}
      {/* Star top-left */}
      <g fill="rgba(255,255,255,0.75)">
        <path d="M108 78 l3-8 3 8 8 3-8 3-3 8-3-8-8-3z" />
      </g>
      {/* Star top-right */}
      <g fill="rgba(255,255,255,0.65)">
        <path d="M296 58 l2.5-6 2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5z" />
      </g>
      {/* Star right-mid */}
      <g fill="rgba(255,255,255,0.5)">
        <path d="M340 148 l2-5 2 5 5 2-5 2-2 5-2-5-5-2z" />
      </g>

      {/* Decorative dots */}
      <circle cx="96"  cy="190" r="3.5" fill="rgba(255,255,255,0.38)" />
      <circle cx="310" cy="168" r="3"   fill="rgba(255,255,255,0.32)" />
      <circle cx="72"  cy="290" r="2.5" fill="rgba(255,255,255,0.25)" />
      <circle cx="330" cy="260" r="2.5" fill="rgba(255,255,255,0.25)" />
      <circle cx="150" cy="388" r="2"   fill="rgba(255,255,255,0.2)"  />
      <circle cx="255" cy="382" r="2.5" fill="rgba(255,255,255,0.2)"  />
      <circle cx="136" cy="90"  r="2"   fill="rgba(255,255,255,0.35)" />
      <circle cx="268" cy="78"  r="2.5" fill="rgba(255,255,255,0.3)"  />
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

  // Auto-submit on 4th digit
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

        {/* ── LEFT — brand + illustration ─────────────────────────────── */}
        <div style={S.left}>
          {/* Logo */}
          <div style={S.leftHeader}>
            <div style={S.logoBox}>S</div>
            <span style={S.logoName}>Saffron</span>
          </div>

          {/* Illustration */}
          <div style={S.illus}>
            <RestaurantIllustration />
          </div>

          {/* Tagline */}
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
            <div style={S.section}>
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
                        ...(selected?.id === c.id ? S.chipActive : {}),
                        ...(!c.hasPin ? S.chipDisabled : {}),
                      }}
                    >
                      <span
                        style={{
                          ...S.chipAvatar,
                          ...(selected?.id === c.id ? S.chipAvatarActive : {}),
                        }}
                      >
                        {initials(c.name)}
                      </span>
                      <span style={S.chipName}>{c.name.split(" ")[0]}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* PIN entry */}
            <div style={S.pinZone}>
              {/* Status line */}
              <div style={S.pinStatus}>
                {selected ? (
                  <span style={S.pinFor}>
                    PIN for <strong style={{ color: "var(--color-saffron-dark)" }}>{selected.name}</strong>
                  </span>
                ) : (
                  <span style={{ ...S.pinFor, opacity: 0.45 }}>← Select your name above</span>
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

              {/* Dot indicators */}
              <div style={S.dots} aria-label="PIN progress">
                {[0, 1, 2, 3].map(i => (
                  <div
                    key={i}
                    style={{
                      ...S.dot,
                      ...(i < pin.length ? S.dotFilled : {}),
                      ...(!selected ? S.dotInactive : {}),
                    }}
                  />
                ))}
              </div>

              {/* Error */}
              {error && (
                <div style={S.errorBox}>
                  {error}
                </div>
              )}

              {/* Numpad */}
              <div style={S.numpad}>
                {(["1","2","3","4","5","6","7","8","9","","0","⌫"] as const).map((key, i) =>
                  key === "" ? (
                    <div key={i} />
                  ) : (
                    <button
                      key={key}
                      type="button"
                      disabled={!selected || busy}
                      onClick={() => press(key)}
                      style={{
                        ...S.numKey,
                        ...(key === "⌫" ? S.numKeyBack : {}),
                        ...(!selected || busy ? S.numKeyOff : {}),
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
    minWidth: 0,
    fontFamily: "var(--font-sans)",
  },

  /* LEFT */
  left: {
    flex: "0 0 45%",
    display: "flex",
    flexDirection: "column",
    background: "linear-gradient(160deg, #1c0c04 0%, #5c2510 42%, #b84e1a 80%, #d86a1e 100%)",
    color: "#fff",
    padding: "1.75rem",
    position: "relative",
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
    background: "rgba(255 255 255 / 0.18)",
    backdropFilter: "blur(6px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    fontSize: "1.125rem",
    flexShrink: 0,
  },
  logoName: {
    fontFamily: "var(--font-display)",
    fontSize: "1.5rem",
    fontWeight: 400,
    letterSpacing: "-0.025em",
    opacity: 0.95,
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
    margin: 0,
    lineHeight: 1.2,
  },
  taglineSub: {
    fontSize: "0.875rem",
    opacity: 0.65,
    margin: "0.375rem 0 0",
    lineHeight: 1.5,
  },

  /* RIGHT */
  right: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f6f2ec",
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

  /* Greeting */
  greeting: {
    paddingBottom: "0.5rem",
    borderBottom: "1px solid rgba(26 20 16 / 0.09)",
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
    marginTop: "0.25rem",
  },
  greetingDate: {
    fontSize: "0.8125rem",
    color: "#7d7268",
    fontWeight: 500,
  },
  greetingTime: {
    fontSize: "0.8125rem",
    color: "#7d7268",
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
  },

  /* Cashier chips */
  section: {},
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
    border: "1.5px solid rgba(26 20 16 / 0.12)",
    background: "#fff",
    cursor: "pointer",
    fontFamily: "var(--font-sans)",
    transition: "transform 0.1s, border-color 0.12s, background 0.12s",
    boxShadow: "0 1px 3px rgba(26 20 16 / 0.06)",
  },
  chipActive: {
    borderColor: "var(--color-saffron)",
    background: "var(--color-saffron-light)",
    transform: "scale(1.03)",
  },
  chipDisabled: {
    opacity: 0.4,
    cursor: "not-allowed",
  },
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
    letterSpacing: "0.02em",
  },
  chipAvatarActive: {
    background: "var(--color-saffron)",
    color: "#fff",
  },
  chipName: {
    fontSize: "0.875rem",
    fontWeight: 600,
    color: "#1a1410",
  },

  /* PIN zone */
  pinZone: {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    gap: "0.75rem",
  },
  pinStatus: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pinFor: {
    fontSize: "0.875rem",
    color: "#3c332a",
  },
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
    border: "2px solid rgba(196 92 38 / 0.3)",
    background: "transparent",
    transition: "background 0.15s, border-color 0.15s, transform 0.1s",
  },
  dotFilled: {
    background: "var(--color-saffron)",
    borderColor: "var(--color-saffron)",
    transform: "scale(1.15)",
  },
  dotInactive: {
    borderColor: "rgba(26 20 16 / 0.12)",
  },
  errorBox: {
    padding: "0.625rem 1rem",
    borderRadius: "0.75rem",
    background: "rgba(155 34 38 / 0.08)",
    border: "1px solid rgba(155 34 38 / 0.2)",
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
    border: "1.5px solid rgba(26 20 16 / 0.1)",
    background: "#fff",
    color: "#1a1410",
    fontSize: "1.375rem",
    fontWeight: 700,
    fontFamily: "var(--font-sans)",
    cursor: "pointer",
    boxShadow: "0 1px 3px rgba(26 20 16 / 0.07)",
    transition: "transform 0.09s, background 0.1s",
  },
  numKeyBack: {
    fontSize: "1.125rem",
    color: "#7d7268",
  },
  numKeyOff: {
    opacity: 0.38,
    cursor: "not-allowed",
    boxShadow: "none",
  },
};
