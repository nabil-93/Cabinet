import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, err } from "@/lib/supabase/helpers";

function detectDevice(ua: string): string {
  if (/mobile|android|iphone|ipad/i.test(ua)) return "mobile";
  return "desktop";
}

// Called every 28s by any authenticated staff member to maintain online presence
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err("Non authentifié", 401);

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, role")
    .eq("id", user.id)
    .single();

  const now = new Date().toISOString();

  await supabase
    .from("profiles")
    .update({ is_online: true, last_seen_at: now, last_login_at: now })
    .eq("id", user.id);

  // Log a new session only if no login was recorded in the last 20 minutes
  // This prevents flooding from page navigation (offline→online in < 1s)
  const twentyMinAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  const { count: recentLogins } = await supabase
    .from("activity_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("action", "login")
    .gte("created_at", twentyMinAgo);

  if ((recentLogins ?? 1) === 0) {
    const ua = req.headers.get("user-agent") ?? "";
    const device = detectDevice(ua);
    await supabase.from("activity_logs").insert({
      user_id: user.id,
      user_name: profile?.name ?? user.email ?? "",
      user_role: profile?.role ?? "",
      action: "login",
      entity_type: "session",
      entity_label: "Connexion",
      details: { device, userAgent: ua.slice(0, 200) },
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
