import type { SupabaseClient } from "@supabase/supabase-js";

interface LogParams {
  supabase: SupabaseClient;
  action: string;
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
  details?: Record<string, any>;
}

export async function logActivity({ supabase, action, entityType, entityId, entityLabel, details }: LogParams) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("name, role").eq("id", user.id).single();
    await supabase.from("activity_logs").insert({
      user_id: user.id,
      user_name: profile?.name || user.email || "Inconnu",
      user_role: profile?.role || "doctor",
      action,
      entity_type: entityType ?? null,
      entity_id: entityId ?? null,
      entity_label: entityLabel ?? null,
      details: details ?? {},
    });
  } catch {}
}
