import axios, { AxiosError } from "axios";
import Cookies from "js-cookie";
import { toast } from "sonner";

// Next.js API routes → toujours relatif (marche en local et sur Vercel)
const BASE_URL = "/api/v1";

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

// ── Attacher le JWT à chaque requête ──
api.interceptors.request.use((config) => {
  const token = Cookies.get("clinicos_token");
  if (token && token !== "demo-token") {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Gérer les erreurs de réponse ──
api.interceptors.response.use(
  (res) => res,
  (error: AxiosError<{ error?: string; message?: string }>) => {
    const status = error.response?.status;

    if (status === 401) {
      Cookies.remove("clinicos_token");
      Cookies.remove("clinicos_user");
      if (typeof window !== "undefined" && !window.location.pathname.includes("/login")) {
        window.location.href = "/login";
      }
    } else if (status === 403) {
      toast.error("Accès refusé");
    } else if (status && status >= 500) {
      toast.error("Erreur serveur");
    }

    return Promise.reject(error);
  }
);

export default api;
