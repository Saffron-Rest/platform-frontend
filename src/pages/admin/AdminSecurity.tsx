import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  beginTotpEnrollment,
  confirmTotpEnrollment,
  getTotpStatus,
  selfDisableTotp,
  type EnrollmentResponse,
  type TotpStatus,
} from "../../api/security";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { Spinner } from "../../components/ui/Spinner";
import { PageHeader } from "../../components/ui/PageHeader";

const fmt = (iso: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
};

type Phase = "STATUS" | "ENROLLING" | "DISABLING";

export function AdminSecurity() {
  const [status, setStatus] = useState<TotpStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [phase, setPhase] = useState<Phase>("STATUS");
  const [enrollment, setEnrollment] = useState<EnrollmentResponse | null>(null);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setStatus(await getTotpStatus());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const startEnroll = async () => {
    setError("");
    try {
      const e = await beginTotpEnrollment();
      setEnrollment(e);
      setCode("");
      setPhase("ENROLLING");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start enrollment");
    }
  };

  const finishEnroll = async () => {
    if (code.length < 6) { setError("Enter the 6-digit code from your authenticator"); return; }
    setSubmitting(true);
    try {
      const next = await confirmTotpEnrollment(code);
      setStatus(next);
      setInfo("Two-factor authentication is now active.");
      setEnrollment(null);
      setCode("");
      setPhase("STATUS");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setSubmitting(false);
    }
  };

  const disable = async () => {
    if (code.length < 6) { setError("Enter your current code to confirm"); return; }
    setSubmitting(true);
    try {
      const next = await selfDisableTotp(code);
      setStatus(next);
      setInfo("Two-factor authentication is now off.");
      setCode("");
      setPhase("STATUS");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Disable failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security"
        subtitle="Two-factor authentication and account access."
      />

      {error && (
        <Alert variant="error">
          <div className="flex justify-between gap-3">
            <span>{error}</span>
            <button type="button" onClick={() => setError("")} className="opacity-70 hover:opacity-100">×</button>
          </div>
        </Alert>
      )}
      {info && (
        <Alert variant="success">
          <div className="flex justify-between gap-3">
            <span>{info}</span>
            <button type="button" onClick={() => setInfo("")} className="opacity-70 hover:opacity-100">×</button>
          </div>
        </Alert>
      )}

      <Card>
        {loading ? (
          <div className="py-6"><Spinner /></div>
        ) : phase === "STATUS" ? (
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-[var(--color-ink)]">
                  {status?.enabled ? "Two-factor authentication is on" : "Two-factor authentication is off"}
                </div>
                <p className="text-sm text-[var(--color-muted)] mt-1 max-w-xl">
                  {status?.enabled
                    ? "When signing in you'll be asked for a 6-digit code from your authenticator app in addition to your password. Even if your password leaks, an attacker can't sign in without the phone in your pocket."
                    : "Adds a second step to every sign-in: a 6-digit code from an authenticator app (Google Authenticator, 1Password, Authy, etc.). Strongly recommended for admin accounts."}
                </p>
                {status?.enabled && (
                  <div className="mt-3 text-xs text-[var(--color-muted)] grid grid-cols-2 gap-x-6 gap-y-1 max-w-md">
                    <div>Enabled at</div><div className="text-[var(--color-ink)]">{fmt(status.enabledAt)}</div>
                    <div>Last used</div><div className="text-[var(--color-ink)]">{fmt(status.lastUsedAt)}</div>
                  </div>
                )}
              </div>
              <div>
                {status?.enabled ? (
                  <Button variant="ghost" onClick={() => { setCode(""); setError(""); setPhase("DISABLING"); }}>Disable 2FA</Button>
                ) : (
                  <Button onClick={startEnroll}>Enable 2FA</Button>
                )}
              </div>
            </div>
          </div>
        ) : phase === "ENROLLING" && enrollment ? (
          <div className="space-y-5">
            <div>
              <div className="text-lg font-semibold">Scan with your authenticator</div>
              <p className="text-sm text-[var(--color-muted)] max-w-xl mt-1">
                Open Google Authenticator, 1Password, Authy, or any compatible app and add a new account by scanning this QR code. Then enter the 6-digit code it shows.
              </p>
            </div>
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <div className="bg-white p-4 ring-1 ring-black/10 rounded-xl">
                <QRCodeSVG value={enrollment.otpauthUri} size={192} level="M" />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <div className="text-xs uppercase tracking-wider text-[var(--color-muted)]">Can't scan?</div>
                  <p className="text-sm text-[var(--color-muted)]">Type this secret into your app manually:</p>
                  <code className="block mt-1 font-mono text-sm bg-[var(--color-cream)] px-3 py-2 rounded select-all break-all">
                    {enrollment.secret}
                  </code>
                </div>
                <div>
                  <label className="block">
                    <div className="text-xs uppercase tracking-wider text-[var(--color-muted)] mb-1">
                      Enter code from app
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="123456"
                      className="field-input text-2xl font-mono tracking-widest text-center w-[180px]"
                      autoFocus
                    />
                  </label>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => { setPhase("STATUS"); setEnrollment(null); }}>
                    Cancel
                  </Button>
                  <Button onClick={finishEnroll} disabled={submitting || code.length < 6}>
                    {submitting ? "Verifying…" : "Enable"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : phase === "DISABLING" ? (
          <div className="space-y-4">
            <div>
              <div className="text-lg font-semibold">Disable two-factor authentication?</div>
              <p className="text-sm text-[var(--color-muted)] max-w-xl mt-1">
                Confirm with your current 6-digit code. Your account will go back to password-only — please re-enable 2FA before getting a new phone.
              </p>
            </div>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className="field-input text-2xl font-mono tracking-widest text-center w-[180px]"
              autoFocus
            />
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => { setPhase("STATUS"); setCode(""); }}>Cancel</Button>
              <Button onClick={disable} disabled={submitting || code.length < 6}>
                {submitting ? "Disabling…" : "Confirm disable"}
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      <Card>
        <div className="text-sm font-semibold mb-2">About 2FA in this app</div>
        <ul className="text-sm text-[var(--color-muted)] list-disc pl-5 space-y-1">
          <li>Codes refresh every 30 seconds. We accept the previous, current and next code so a small clock drift won't lock you out.</li>
          <li>Lost your phone? Another admin can revoke your 2FA from <strong>Admin → Team</strong>.</li>
          <li>Mobile app users will also be prompted at next sign-in.</li>
        </ul>
      </Card>
    </div>
  );
}
