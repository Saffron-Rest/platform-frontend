import { useState, FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";
import { Card } from "../components/ui/Card";

export function ChangePassword() {
  const { user, loading, changePassword, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.mustChangePassword) return <Navigate to="/" replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }
    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 py-12 bg-[var(--color-cream)]">
      <div className="max-w-md mx-auto w-full">
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--color-saffron-dark)] mb-2">
          Set a new password
        </h1>
        <p className="text-[var(--color-muted)] mb-6 text-sm">
          You must choose a new password before using the app.
        </p>
        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <Alert variant="error">{error}</Alert>}
            <label className="field-label">
              Current password (temporary)
              <input
                type="password"
                required
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="field-input"
              />
            </label>
            <label className="field-label">
              New password
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="field-input"
              />
            </label>
            <label className="field-label">
              Confirm new password
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="field-input"
              />
            </label>
            <Button type="submit" fullWidth disabled={submitting}>
              {submitting ? "Saving…" : "Update password"}
            </Button>
            <Button type="button" variant="secondary" fullWidth onClick={logout}>
              Sign out
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
