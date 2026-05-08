import { createClient } from "@/lib/supabase/server";
import { ok, err } from "@/lib/supabase/helpers";
import { isMedicalStaff, displayRole } from "@/lib/roles";

// A doctor is "online" if they sent a heartbeat in the last 90 seconds.
const ONLINE_THRESHOLD_SECONDS = 90;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err("Non authentifié", 401);

  const threshold = new Date(Date.now() - ONLINE_THRESHOLD_SECONDS * 1000).toISOString();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, role, specialty, is_available, is_online, last_seen_at")
    .in("role", ["admin", "doctor"])
    .eq("is_online", true)
    .gte("last_seen_at", threshold)
    .order("name", { ascending: true });

  if (error) return err(error.message);

  return ok((data ?? []).map(p => ({
    userId:      p.id,
    name:        p.name,
    role:        p.role,
    displayRole: displayRole(p.role),
    specialty:   p.specialty ?? null,
    isAvailable: p.is_available ?? true,
    lastSeenAt:  p.last_seen_at,
  })));
}
