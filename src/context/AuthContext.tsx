import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { api } from "../api/client";
import type { User } from "../types";

/** Thrown by {@link AuthCtx.login} when the user has 2FA enabled but no
 *  code was supplied. The login page should catch this, prompt for the
 *  code, then call {@code login(username, password, code)} again. */
export class TwoFactorRequiredError extends Error {
  constructor() {
    super("Two-factor authentication required");
    this.name = "TwoFactorRequiredError";
  }
}

type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string, totpCode?: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }
    api<{ user: User }>("/auth/me")
      .then((r) => setUser(r.user))
      .catch(() => localStorage.removeItem("token"))
      .finally(() => setLoading(false));
  }, []);

  const login = async (username: string, password: string, totpCode?: string) => {
    // We bypass the generic api() helper here because we need access to
    // both the body and status code so we can distinguish the 2FA-required
    // response from a plain "invalid credentials". The helper collapses both
    // into a single Error.
    const API_BASE =
      (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "/api";
    const r = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username.trim(),
        password,
        totpCode: totpCode || undefined,
      }),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) {
      if (r.status === 401 && body && body.requires2fa === true) {
        throw new TwoFactorRequiredError();
      }
      throw new Error(typeof body?.error === "string" ? body.error : "Login failed");
    }
    const res = body as { token: string; user: User };
    localStorage.setItem("token", res.token);
    setUser(res.user);
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    const res = await api<{ token: string; user: User }>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    localStorage.setItem("token", res.token);
    setUser(res.user);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, changePassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside provider");
  return ctx;
}
