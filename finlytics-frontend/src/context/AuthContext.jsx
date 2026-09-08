import { createContext, useContext, useEffect, useState } from "react";
import { api, TOKEN_KEY } from "../lib/api";

const AuthContext = createContext(null);

const STORAGE_KEY = "finlytics_user";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const token = localStorage.getItem(TOKEN_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // If we have a token, keep the user; if not, still keep for backwards compat
        // but they will need to re-login to get a JWT for live mode
        setUser(parsed);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(TOKEN_KEY);
      }
    } else if (token) {
      // Token without user (edge) — clear
      localStorage.removeItem(TOKEN_KEY);
    }
    setReady(true);
  }, []);

  const persist = (u) => {
    // u contains {id, name, email, token, ...}
    const { token, ...userWithoutToken } = u;
    setUser(userWithoutToken);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userWithoutToken));
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    }
  };

  const login = async (email, password) => {
    const u = await api.login(email, password);
    persist(u);
    return u;
  };

  const signup = async (name, email, password) => {
    const u = await api.createUser(name, email, password);
    persist(u);
    return u;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TOKEN_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, ready, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
