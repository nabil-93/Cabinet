import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, err } from "@/lib/supabase/helpers";

const ACTION_CATEGORIES: Record<string, string[]> = {
  navigation: ["page_view", "navigate"],
  download:   ["export_excel", "export_pdf", "export_image"],
  create:     ["create"],
  update:     ["update"],
  delete:     ["delete"],
  login:      ["login", "logout"],
};

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);

    const userId     = searchParams.get("userId");
    const actionType = searchParams.get("actionType");
    const dateFrom   = searchParams.get("dateFrom");
    const search     = searchParams.get("search");
    const limitParam = parseInt(searchParams.get("limit") ?? "200", 10);
    const limit      = Math.min(isNaN(limitParam) ? 200 : limitParam, 500);

    let query = supabase
      .from("activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    // Filter by userId
    if (userId) query = query.eq("user_id", userId);

    // Filter by dateFrom
    if (dateFrom) query = query.gte("created_at", dateFrom);

    // Filter by search (entity_label ilike)
    if (search) {
      query = query.or(`entity_label.ilike.%${search}%,user_name.ilike.%${search}%`);
    }

    // Filter by actionType category
    if (actionType && actionType !== "all" && ACTION_CATEGORIES[actionType]) {
      const prefixes = ACTION_CATEGORIES[actionType];
      // Build OR filter: action = prefix OR action starts with prefix_
      const filters = prefixes.flatMap(p => [`action.eq.${p}`, `action.ilike.${p}_%`]);
      query = query.or(filters.join(","));
    }

    const { data, error } = await query;
    if (error) return err(error.message);

    return ok(data ?? []);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : "Erreur serveur", 500);
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
        user_id:      userId,
        user_name:    userName    ?? "",
        user_role:    userRole    ?? "",
        action,
        entity_type:  entityType  ?? null,
        entity_id:    entityId    ?? null,
        entity_label: entityLabel ?? null,
        details:      details     ?? null,
      })
      .select()
      .single();

    if (error) return err(error.message);

    return ok(data, 201);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : "Erreur serveur", 500);
  }
}
