import { createClient } from "@/lib/supabase/server";
import { ok, err } from "@/lib/supabase/helpers";

// Appelé automatiquement à chaque chargement de la page patients
// Marque inactifs les patients sans activité depuis 3 mois
export async function POST() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("sync_inactive_patients");
    if (error) return err(error.message);
    return ok({ inactivated: data });
  } catch {
    return err("Erreur sync", 500);
  }
}
