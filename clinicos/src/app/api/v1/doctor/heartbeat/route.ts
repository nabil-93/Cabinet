import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, err } from "@/lib/supabase/helpers";

function detectDevice(ua: string): string {
  if (/mobile|android|iphone|ipad/i.test(ua)) return "mobile";
  return "desktop";
}

// Called every 30s by any authenticated staff member to maintain online presence
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err("Non authentifié", 401);

  // Check previous online state to detect new sessions
  const { data: prev } = await supabase
    .from("profiles")
    .select("is_online, name, role, last_login_at")
    .eq("id", user.id)
    .single();

  const now = new Date().toISOString();
  const wasOffline = !prev?.is_online;

  await supabase
    .from("profiles")
    .update({ is_online: true, last_seen_at: now, last_login_at: now })
    .eq("id", user.id);

  // Log new session if user was offline (new connection from any device)
  if (wasOffline) {
    const ua = req.headers.get("user-agent") ?? "";
    const device = detectDevice(ua);
    await supabase.from("activity_logs").insert({
      user_id: user.id,
      user_name: prev?.name ?? user.email ?? "",
      user_role: prev?.role ?? "",
      action: "login",
      entity_type: "session",
      entity_label: "Connexion",
      details: { device, userAgent: ua.slice(0, 200), via: "heartbeat" },
    });
  }

  return ok({ online: true });
}

// Called on page unload to immediately mark as offline
export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err("Non authentifié", 401);

  await supabase
    .from("profiles")
    .update({ is_online: false, last_seen_at: new Date().toISOString() })
    .eq("id", user.id);

  return ok({ online: false });
}
