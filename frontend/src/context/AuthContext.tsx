import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { apiV1 as api, invalidateCache } from "../lib/api";
import { broadcast, onBroadcast } from "../lib/broadcast";

export type User = {
  id: number;
  email: string;
  name: string;
  phone?: string;
  role: string;
  fidelity_points: number;
  wallet_balance?: number;
  loyalty_spend_progress?: number;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: { email: string; password: string; name: string }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<User | null>;
  isStaff: boolean;
  isAdmin: boolean;
};

const CACHE_KEY = "kidelio_user";

function readCache(): User | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function writeCache(user: User | null) {
  try {
    if (user) localStorage.setItem(CACHE_KEY, JSON.stringify(user));
    else localStorage.removeItem(CACHE_KEY);
  } catch { /* storage quota or private browsing */ }
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Initialise from localStorage immediately — no flash of "logged out" on reload.
  const [user, setUser] = useState<User | null>(readCache);
  // Loading is false if we already have a cached user (background-validate silently).
  const [loading, setLoading] = useState(!readCache());

  const setAndCache = useCallback((u: User | null) => {
    setUser(u);
    writeCache(u);
  }, []);

  // Always validate the cached user against the server in the background.
  // On network/server errors we keep whatever is cached — only an explicit
  // null from the server (session gone) clears the user.
  const refresh = useCallback(async (): Promise<User | null> => {
    try {
      invalidateCache("/api/v1/auth/me");
      const data = await api<{ user: User | null } | User>("/auth/me");
      const next =
        data && typeof data === "object" && "user" in data
          ? (data as { user: User | null }).user
          : (data as User | null);
      setAndCache(next);
      return next;
    } catch {
      // Network error or 5xx — keep the cached user to avoid a ghost logout.
      return readCache();
    }
  }, [setAndCache]);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  // Multi-window sync 1: BroadcastChannel / storage event from other tabs.
  useEffect(() => {
    return onBroadcast((event) => {
      if (event.type === "auth") refresh();
    });
  }, [refresh]);

  // Multi-window sync 2: watch the raw cache key in localStorage so that a
  // window that was already open before login instantly reflects the new user.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== CACHE_KEY) return;
      const next = e.newValue ? (JSON.parse(e.newValue) as User) : null;
      setUser(next);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const login = async (email: string, password: string) => {
    const data = await api<{ user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    // Wipe any cache from a previous (anonymous or other) session.
    invalidateCache();
    setAndCache(data.user);
    broadcast({ type: "auth", action: "login" });
    return data.user;
  };

  const register = async (payload: { email: string; password: string; name: string }) => {
    const data = await api<{ user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    invalidateCache();
    setAndCache(data.user);
    broadcast({ type: "auth", action: "login" });
  };

  const logout = async () => {
    await api("/auth/logout", { method: "DELETE" });
    // Clear all cached per-user data (cart, addresses, orders, …) so the next
    // user can't see the previous session's data.
    invalidateCache();
    setAndCache(null);
    broadcast({ type: "auth", action: "logout" });
  };

  const isStaff = !!user && (user.role === "admin" || user.role === "employee");
  const isAdmin = user?.role === "admin";

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh, isStaff, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
