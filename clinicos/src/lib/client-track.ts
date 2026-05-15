/**
 * client-track.ts — Client-side activity tracking helper
 * Logs user actions to /api/v1/activity (POST)
 * Never throws — silently fails
 */

import { createClient } from "@/lib/supabase/client";

// ─── Deduplication cache for navigation events ────────────────────────────────
let _lastNavPath = "";
let _lastNavTime = 0;
const NAV_DEDUP_MS = 2000;

// ─── Core tracker ─────────────────────────────────────────────────────────────
export async function trackActivity(
  action: string,
  entityType?: string,
  entityLabel?: string,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get user profile from metadata
    const meta = user.user_metadata ?? {};
    const userId = user.id;
    const userName: string = meta.full_name ?? meta.name ?? user.email ?? "Utilisateur";
    const userRole: string = meta.role ?? "user";

    const device = typeof window !== "undefined"
      ? (window.innerWidth < 768 ? "mobile" : "desktop")
      : "unknown";

    await fetch("/api/v1/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        userName,
        userRole,
        action,
        entityType: entityType ?? null,
        entityId: null,
        entityLabel: entityLabel ?? null,
        details: { ...details, device },
      }),
    });
  } catch {
    // Silently fail — tracking must never break the UI
  }
}

// ─── Navigation tracker (with deduplication) ──────────────────────────────────
export async function trackNavigation(from: string, to: string): Promise<void> {
  const now = Date.now();
  if (to === _lastNavPath && now - _lastNavTime < NAV_DEDUP_MS) return;

  _lastNavPath = to;
  _lastNavTime = now;

  await trackActivity(
    "page_view",
    "page",
    to,
    { from, to }
  );
}

// ─── Download tracker ─────────────────────────────────────────────────────────
export async function trackDownload(
  type: "excel" | "pdf" | "image" | string,
  filename: string,
  count?: number
): Promise<void> {
  const actionMap: Record<string, string> = {
    excel: "export_excel",
    pdf:   "export_pdf",
    image: "export_image",
  };
  const action = actionMap[type] ?? `export_${type}`;

  await trackActivity(
    action,
    "file",
    filename,
    { filename, ...(count !== undefined ? { count } : {}) }
  );
}

// ─── Click tracker ────────────────────────────────────────────────────────────
export async function trackClick(
  element: string,
  details?: Record<string, unknown>
): Promise<void> {
  await trackActivity("click_" + element, "ui", element, details);
}
