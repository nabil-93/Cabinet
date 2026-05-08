import { NextRequest, NextResponse } from "next/server";
import { createClient } from "./server";

export async function getAuthUser(req: NextRequest) {
  const supabase = await createClient();
  const token = req.headers.get("authorization")?.replace("Bearer ", "");

  if (!token || token === "demo-token") return null;

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function getSupabase() {
  return createClient();
}
