import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, err } from "@/lib/supabase/helpers";

/**
 * Single source of truth for doctor availability.
 *
 * Primary doctor selection (consistent for ALL callers):
 *   1. The logged-in user if they are admin or doctor (they see their own status)
 *   2. Otherwise: the admin-role profile (the clinic owner / main doctor)
 *   3. Fallback: first doctor-role profile
 *
 * This ensures doctor and secretary always query the SAME database row.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return err("Non authentifié", 401);

  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, role, is_available")
    .in("role", ["admin", "doctor"])
    .order("role", { ascending: true }); // "admin" < "doctor" alphabetically → admin first

  if (error) return err(error.message);

  const profiles = (data ?? []) as Array<{ id: string; name: string; role: string; is_available: boolean }>;
  const admins  = profiles.filter(p => p.role === "admin");
  const doctors = profiles.filter(p => p.role === "doctor");

  // Consistent primary selection — same result for every caller
  const me      = profiles.find(p => p.id === user.id);
  const primary = me ?? admins[0] ?? doctors[0] ?? profiles[0];

  if (!primary) return ok({ isAvailable: true, doctorName: "Médecin", primaryId: null, all: [] });

  return ok({
    isAvailable:  primary.is_available ?? true,
    doctorName:   primary.name,
    primaryId:    primary.id,
    all: profiles.map(p => ({
      id:          p.id,
      name:        p.name,
      role:        p.role,
      isAvailable: p.is_available ?? true,
    })),
  });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return err("Non authentifié", 401);

  const body = await req.json().catch(() => ({}));
  if (typeof body.isAvailable !== "boolean") return err("isAvailable (boolean) requis", 400);

  const { data, error } = await supabase
    .from("profiles")
    .update({ is_available: body.isAvailable })
    .eq("id", user.id)
    .select("id, name, is_available")
    .single();

  if (error) return err(error.message);
  return ok({ id: data.id, name: data.name, isAvailable: data.is_available });
}
