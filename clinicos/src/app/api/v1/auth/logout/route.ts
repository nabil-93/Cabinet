import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("profiles").select("name, role").eq("id", user.id).single();

      await supabase.from("activity_logs").insert({
        user_id:    user.id,
        user_name:  profile?.name ?? user.email ?? "",
        user_role:  profile?.role ?? "",
        action:     "logout",
        entity_type: "session",
        entity_label: "Déconnexion",
      });

      await supabase.auth.signOut();
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: true }); // toujours OK côté client
  }
}
