"use client";
import Cookies from "js-cookie";

export interface AuthUser {
  name: string;
  email: string;
  role: "admin" | "doctor" | "assistant" | "patient";
}

export function getAuthUser(): AuthUser | null {
  try {
    const raw = Cookies.get("clinicos_user");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return !!Cookies.get("clinicos_token");
}

export function hasRole(user: AuthUser | null, roles: string[]): boolean {
  if (!user) return false;
  return roles.includes(user.role);
}
