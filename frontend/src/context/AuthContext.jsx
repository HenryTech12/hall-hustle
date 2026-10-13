import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { authApi } from "../api/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("hh_user");
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem("hh_token"));
  const [loading, setLoading] = useState(true);

  const persistSession = useCallback((newToken, newUser) => {
    localStorage.setItem("hh_token", newToken);
    localStorage.setItem("hh_user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("hh_token");
    localStorage.removeItem("hh_user");
    setToken(null);
    setUser(null);
  }, []);

  // Refresh user profile on load if we have a token, so stale localStorage
  // data (e.g. trust_score) doesn't linger indefinitely.
  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const freshUser = await authApi.me();
        if (!cancelled) {
          localStorage.setItem("hh_user", JSON.stringify(freshUser));
          setUser(freshUser);
        }
      } catch {
        if (!cancelled) logout();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    refresh();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, persistSession, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
