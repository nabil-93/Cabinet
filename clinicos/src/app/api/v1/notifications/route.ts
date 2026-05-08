import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, err } from "@/lib/supabase/helpers";

function normalize(n: any) {
  return { id: n.id, title: n.title, message: n.message, type: n.type, read: n.read, createdAt: n.created_at };
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  const supabase = await createClient();
  let query = supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(50);
  if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query;
  if (error) return err(error.message);
  return ok((data || []).map(normalize));
}

export async function PATCH(req: NextRequest) {
  const { userId } = await req.json().catch(() => ({}));
  const supabase = await createClient();
  let query = supabase.from("notifications").update({ read: true }).eq("read", false);
  if (userId) query = query.eq("user_id", userId);
  const { error } = await query;
  if (error) return err(error.message);
  return ok({ success: true });
}
