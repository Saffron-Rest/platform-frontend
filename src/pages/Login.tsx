import { useState, FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";

export function Login() {
  const { user, login, loading } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) return null;
  if (user?.mustChangePassword) return <Navigate to="/change-password" replace />;
  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <div className="hidden md:flex md:w-[42%] lg:w-[38%] bg-[var(--color-ink)] text-white p-10 flex-col justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-4xl lg:text-5xl tracking-tight">
            Saffron
          </h1>
          <p className="text-white/60 mt-3 text-lg max-w-xs leading-relaxed">
            Daily cash flow, shift reports, payroll, and treasury — in one place.
          </p>
        </div>
        <p className="text-white/40 text-sm">Restaurant operations made simple</p>
      </div>

      <div className="flex-1 flex flex-col justify-center px-6 py-12 bg-[var(--color-cream)]">
        <div className="max-w-md mx-auto w-full">
          <div className="md:hidden mb-8">
            <h1 className="font-[family-name:var(--font-display)] text-4xl text-[var(--color-saffron-dark)]">
              Saffron
            </h1>
            <p className="text-[var(--color-muted)] mt-2">Sign in to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="surface-card p-6 md:p-8 space-y-5">
            <h2 className="hidden md:block text-xl font-bold">Sign in</h2>
            {error && <Alert variant="error">{error}</Alert>}
            <label className="field-label">
              Username
              <input
                type="text"
                required
                autoComplete="username"
                autoCapitalize="none"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="field-input"
                placeholder="your.username"
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
                className="field-input"
              />
            </label>
            <Button type="submit" fullWidth disabled={submitting} className="py-3.5">
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
