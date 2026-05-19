import { useState, FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";

export function Login() {
  const { user, login, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 py-12 bg-[var(--color-cream)]">
      <div className="max-w-md mx-auto w-full">
        <div className="mb-8">
          <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-5xl text-[var(--color-saffron-dark)]">
            Saffron
          </h1>
          <p className="text-[var(--color-muted)] mt-2">Daily cash flow for your restaurant</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl p-6 md:p-8 shadow-lg shadow-black/5 border border-black/5 space-y-5"
        >
          {error && <Alert variant="error">{error}</Alert>}
          <label className="field-label">
            Email
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field-input text-lg"
              placeholder="you@restaurant.com"
            />
          </label>
          <label className="field-label">
            Password
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field-input text-lg"
            />
          </label>
          <Button type="submit" fullWidth disabled={submitting} className="py-4 text-lg">
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-8 text-xs text-[var(--color-muted)] text-center leading-relaxed">
          Demo accounts
          <br />
          <span className="font-mono text-[11px]">admin@saffron.local</span> / admin123
          <br />
          <span className="font-mono text-[11px]">manager@saffron.local</span> / manager123
          <br />
          <span className="font-mono text-[11px]">cashier@saffron.local</span> / cashier123
        </p>
      </div>
    </div>
  );
}
