import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, err } from "@/lib/supabase/helpers";

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { error } = await supabase.from("consultations").delete().eq("id", id);
  if (error) return err(error.message);
  return ok({ success: true });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const supabase = await createClient();

  const update: Record<string, any> = {};
  if (body.date      !== undefined) update.date       = body.date;
  if (body.time      !== undefined) update.time       = body.time;
  if (body.type      !== undefined) update.type       = body.type;
  if (body.diagnosis !== undefined) update.diagnosis  = body.diagnosis;
  if (body.notes     !== undefined) update.notes      = body.notes;
  if (body.treatment !== undefined) update.treatment  = body.treatment;
  if (body.nextVisit !== undefined) update.next_visit = body.nextVisit;

  const { data, error } = await supabase
    .from("consultations")
    .update(update)
    .eq("id", id)
    .select("*, profiles(name)")
    .single();

  if (error) return err(error.message);
  return ok(data);
}
