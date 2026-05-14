import api from "./api";
import Cookies from "js-cookie";

export interface LoginRequest { email: string; password: string; }
export interface RegisterRequest { name: string; email: string; password: string; role: string; phone?: string; specialty?: string; }
export interface AuthResponse { token: string; role: string; name: string; email: string; id: string; mustChangePassword: boolean; avatarUrl?: string | null; }

const COOKIE_OPTS = { expires: 7, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const };

export const authService = {
  async login(data: LoginRequest): Promise<AuthResponse> {
    const res = await api.post<AuthResponse>("/auth/login", data);
    const user = res.data;
    Cookies.set("clinicos_token", user.token, COOKIE_OPTS);
    Cookies.set("clinicos_user", JSON.stringify({ id: user.id, name: user.name, email: user.email, role: user.role, mustChangePassword: user.mustChangePassword, avatarUrl: user.avatarUrl ?? null }), COOKIE_OPTS);
    return user;
  },

  async register(data: RegisterRequest): Promise<AuthResponse> {
    const res = await api.post<AuthResponse>("/auth/register", data);
    const user = res.data;
    Cookies.set("clinicos_token", user.token, COOKIE_OPTS);
    Cookies.set("clinicos_user", JSON.stringify({ id: user.id, name: user.name, email: user.email, role: user.role, mustChangePassword: user.mustChangePassword, avatarUrl: user.avatarUrl ?? null }), COOKIE_OPTS);
    return user;
  },

  logout() {
    Cookies.remove("clinicos_token");
    Cookies.remove("clinicos_user");
    window.location.href = "/login";
  },

  getToken(): string | undefined {
    return Cookies.get("clinicos_token");
  },

  getCurrentUser(): { id: string; name: string; email: string; role: string; mustChangePassword: boolean } | null {
    try {
      const raw = Cookies.get("clinicos_user");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  isAuthenticated(): boolean {
    return !!Cookies.get("clinicos_token");
  },
};
