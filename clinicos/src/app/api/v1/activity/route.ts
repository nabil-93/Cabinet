import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, err } from "@/lib/supabase/helpers";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    let query = supabase
      .from("activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (userId) query = query.eq("user_id", userId);

    const { data, error } = await query;
    if (error) return err(error.message);

    return ok(data ?? []);
  } catch (e: any) {
    return err(e.message ?? "Erreur serveur", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, userName, userRole, action, entityType, entityId, entityLabel, details } = body;

    if (!userId || !action) return err("userId et action requis");

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("activity_logs")
      .insert({
        user_id: userId,
        user_name: userName ?? "",
        user_role: userRole ?? "",
        action,
        entity_type: entityType ?? null,
        entity_id: entityId ?? null,
        entity_label: entityLabel ?? null,
        details: details ?? null,
      })
      .select()
      .single();

    if (error) return err(error.message);

    return ok(data, 201);
  } catch (e: any) {
    return err(e.message ?? "Erreur serveur", 500);
  }
}
