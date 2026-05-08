import { createClient } from "@/lib/supabase/server";
import { ok, err } from "@/lib/supabase/helpers";

// Called every 30s by the doctor to maintain online presence
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err("Non authentifié", 401);

  const { error } = await supabase
    .from("profiles")
    .update({ is_online: true, last_seen_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) return err(error.message);
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
