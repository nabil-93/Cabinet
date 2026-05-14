import { createClient } from "@/lib/supabase/server";
import { ok, err } from "@/lib/supabase/helpers";

// Mark patients inactive if last_visit > 3 months ago (and they're still active)
export async function POST() {
  try {
    const supabase = await createClient();
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const cutoff = threeMonthsAgo.toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("patients")
      .update({ status: "inactive" })
      .eq("status", "active")
      .lt("last_visit", cutoff)
      .not("last_visit", "is", null)
      .select("id");

    if (error) return err(error.message);
    return ok({ inactivated: (data ?? []).length });
  } catch {
    return err("Erreur sync", 500);
  }
}
