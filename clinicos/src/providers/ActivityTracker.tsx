"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackNavigation } from "@/lib/client-track";

// ─── Pathname → human label map ───────────────────────────────────────────────
const PATH_LABELS: Record<string, string> = {
  "/patients":        "Patients",
  "/billing":         "Facturation",
  "/whatsapp":        "WhatsApp",
  "/analytics":       "Analytique",
  "/appointments":    "Rendez-vous",
  "/calendar":        "Calendrier",
  "/waiting-room":    "Salle d'attente",
  "/prescriptions":   "Ordonnances",
  "/ai-assistant":    "Assistant IA",
  "/activity":        "Activité",
  "/team":            "Équipe",
  "/settings":        "Paramètres",
  "/dashboard":       "Dashboard",
  "/doctor-dashboard":"Dashboard Médecin",
};

function getPageLabel(pathname: string): string {
  // Exact match
  if (PATH_LABELS[pathname]) return PATH_LABELS[pathname];
  // Prefix match (e.g. /patients/123)
  for (const [prefix, label] of Object.entries(PATH_LABELS)) {
    if (pathname.startsWith(prefix + "/")) return label;
  }
  // Fallback: capitalize last segment
  const segment = pathname.split("/").filter(Boolean).pop() ?? pathname;
  return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");
}

// ─── ActivityTracker component ────────────────────────────────────────────────
export default function ActivityTracker(): null {
  const pathname = usePathname();
  const prevPathRef = useRef<string | null>(null);

  useEffect(() => {
    const from = prevPathRef.current
      ? getPageLabel(prevPathRef.current)
      : "—";
    const to = getPageLabel(pathname);

    // Only track when path actually changed
    if (prevPathRef.current !== pathname) {
      trackNavigation(from, to);
      prevPathRef.current = pathname;
    }
  }, [pathname]);

  return null;
}
