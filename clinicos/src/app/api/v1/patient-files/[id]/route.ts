import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, err } from "@/lib/supabase/helpers";
import { logActivity } from "@/lib/supabase/log-activity";

// DELETE /api/v1/patient-files/[id]
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // Get file metadata first
  const { data: file, error: fetchError } = await supabase
    .from("patient_files")
    .select("*, patients(full_name)")
    .eq("id", id)
    .single();

  if (fetchError || !file) return err("Fichier introuvable", 404);

  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from("patient-files")
    .remove([file.storage_path]);

  if (storageError) return err(`Erreur suppression fichier: ${storageError.message}`, 500);

  // Delete metadata from DB
  const { error: dbError } = await supabase
    .from("patient_files")
    .delete()
    .eq("id", id);

  if (dbError) return err(dbError.message, 500);

  const patientName = (file as any).patients?.full_name || file.patient_id;
  await logActivity({
    supabase,
    action: "delete_patient_file",
    entityType: "patient",
    entityId: file.patient_id,
    entityLabel: `${patientName} – ${file.original_name}`,
  });

  return ok({ success: true });
}
