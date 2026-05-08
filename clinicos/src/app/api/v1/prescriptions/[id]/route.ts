import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, err } from "@/lib/supabase/helpers";
import { normalize } from "../route";
import { logActivity } from "@/lib/supabase/log-activity";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const update: Record<string, any> = {};
    if (body.diagnosis !== undefined) update.diagnosis = body.diagnosis;
    if (body.medications !== undefined) update.medications = body.medications;
    if (body.notes !== undefined) update.notes = body.notes;
    if (body.status !== undefined) update.status = body.status;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("prescriptions")
      .update(update)
      .eq("id", id)
      .select("*, patients(full_name), profiles(name)")
      .single();

    if (error) return err(error.message);
    await logActivity({ supabase, action: "update_prescription", entityType: "prescription", entityId: id, entityLabel: (data as any).diagnosis || "" });
    return ok(normalize(data));
  } catch {
    return err("Erreur serveur", 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: presc } = await supabase.from("prescriptions").select("diagnosis, patients(full_name)").eq("id", id).single();
    const { error } = await supabase.from("prescriptions").delete().eq("id", id);
    if (error) return err(error.message);
    const patientNameDel = (presc as any)?.patients?.full_name || "";
    await logActivity({ supabase, action: "delete_prescription", entityType: "prescription", entityId: id, entityLabel: `${patientNameDel} – ${presc?.diagnosis || ""}` });
    return ok({ success: true });
  } catch {
    return err("Erreur serveur", 500);
  }
}
