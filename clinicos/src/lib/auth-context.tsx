"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import Cookies from "js-cookie";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "doctor" | "assistant" | "patient";
  mustChangePassword?: boolean;
  avatarUrl?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  setUser: () => {},
  logout: () => {},
  isLoading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const raw = Cookies.get("clinicos_user");
    if (raw) {
      try { setUserState(JSON.parse(raw)); } catch {}
    }
    setIsLoading(false);
  }, []);

  const setUser = (u: AuthUser | null) => {
    setUserState(u);
    if (u) Cookies.set("clinicos_user", JSON.stringify(u), { expires: 7 });
    else Cookies.remove("clinicos_user");
  };

  const logout = () => {
    // Log déconnexion (best-effort, pas bloquant)
    fetch("/api/v1/auth/logout", { method: "POST" }).catch(() => {});
    Cookies.remove("clinicos_token");
    Cookies.remove("clinicos_user");
    setUserState(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, setUser, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
