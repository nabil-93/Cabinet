import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

interface LogParams {
  supabase: SupabaseClient;
  action: string;
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
  details?: Record<string, any>;
  req?: NextRequest;
}

export function detectDevice(ua: string): "mobile" | "desktop" {
  return /mobile|android|iphone|ipad/i.test(ua) ? "mobile" : "desktop";
}

export async function logActivity({ supabase, action, entityType, entityId, entityLabel, details, req }: LogParams) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("name, role").eq("id", user.id).single();

    // Attach device info if request is provided
    let enrichedDetails = details ?? {};
    if (req) {
      const ua = req.headers.get("user-agent") ?? "";
      enrichedDetails = { ...enrichedDetails, device: detectDevice(ua) };
    }

    await supabase.from("activity_logs").insert({
      user_id: user.id,
      user_name: profile?.name || user.email || "Inconnu",
      user_role: profile?.role || "doctor",
      action,
      entity_type: entityType ?? null,
      entity_id: entityId ?? null,
      entity_label: entityLabel ?? null,
      details: enrichedDetails,
    });
  } catch {}
}
