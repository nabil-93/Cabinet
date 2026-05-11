import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, err } from "@/lib/supabase/helpers";
import { logActivity } from "@/lib/supabase/log-activity";

// File type category helpers
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml", "image/bmp"];
const AUDIO_TYPES = ["audio/mpeg", "audio/wav", "audio/ogg", "audio/webm", "audio/mp4", "audio/aac"];
const PDF_TYPES   = ["application/pdf"];
const DOC_TYPES   = [
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain", "text/csv",
];

function getFileCategory(mimeType: string): string {
  if (IMAGE_TYPES.includes(mimeType)) return "image";
  if (AUDIO_TYPES.includes(mimeType)) return "audio";
  if (PDF_TYPES.includes(mimeType))   return "pdf";
  if (DOC_TYPES.includes(mimeType))   return "document";
  return "other";
}

// PATCH /api/v1/patient-files/[id]  (multipart/form-data)
// Supports: replace file, replace/add/remove audio, update label/notes
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // Get existing file
  const { data: existing, error: fetchError } = await supabase
    .from("patient_files")
    .select("*, patients(full_name)")
    .eq("id", id)
    .single();

  if (fetchError || !existing) return err("Fichier introuvable", 404);

  const formData = await req.formData();
  const newFile     = formData.get("file") as File | null;
  const newAudio    = formData.get("audio") as File | null;
  const label       = formData.get("label") as string | null;
  const notes       = formData.get("notes") as string | null;
  const removeAudio = formData.get("removeAudio") === "true";

  const update: Record<string, any> = {};

  // ── Replace main file ──
  if (newFile && newFile.size > 0) {
    if (newFile.size > 10 * 1024 * 1024) return err("Fichier trop volumineux (max 10 Mo)", 400);

    const ext = newFile.name.split(".").pop() || "bin";
    const newPath = `${existing.patient_id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const buffer = Buffer.from(await newFile.arrayBuffer());

    const { error: uploadErr } = await supabase.storage
      .from("patient-files")
      .upload(newPath, buffer, { contentType: newFile.type, upsert: false });

    if (uploadErr) return err(`Upload échoué: ${uploadErr.message}`, 500);

    // Delete old file from storage
    await supabase.storage.from("patient-files").remove([existing.storage_path]);

    update.storage_path  = newPath;
    update.name          = newFile.name.replace(/\.[^/.]+$/, "");
    update.original_name = newFile.name;
    update.mime_type     = newFile.type;
    update.category      = getFileCategory(newFile.type);
    update.size          = newFile.size;
  }

  // ── Replace/add audio ──
  if (newAudio && newAudio.size > 0) {
    const audioPath = `${existing.patient_id}/audio_${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webm`;
    const audioBuffer = Buffer.from(await newAudio.arrayBuffer());

    const { error: audioErr } = await supabase.storage
      .from("patient-files")
      .upload(audioPath, audioBuffer, { contentType: newAudio.type || "audio/webm", upsert: false });

    if (audioErr) return err(`Upload audio échoué: ${audioErr.message}`, 500);

    // Delete old audio if exists
    if (existing.audio_storage_path) {
      await supabase.storage.from("patient-files").remove([existing.audio_storage_path]);
    }

    update.audio_storage_path = audioPath;
  }
  // ── Remove audio ──
  else if (removeAudio && existing.audio_storage_path) {
    await supabase.storage.from("patient-files").remove([existing.audio_storage_path]);
    update.audio_storage_path = null;
  }

  // ── Update text fields ──
  if (label !== null) update.label = label;
  if (notes !== null) update.notes = notes || null;

  if (Object.keys(update).length === 0) return err("Aucune modification", 400);

  const { data: row, error: dbError } = await supabase
    .from("patient_files")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (dbError) return err(dbError.message, 500);

  // Build public URLs
  const { data: urlData } = supabase.storage.from("patient-files").getPublicUrl(row.storage_path);
  let audioPublicUrl: string | null = null;
  if (row.audio_storage_path) {
    const { data: audioUrlData } = supabase.storage.from("patient-files").getPublicUrl(row.audio_storage_path);
    audioPublicUrl = audioUrlData.publicUrl;
  }

  const patientName = (existing as any).patients?.full_name || existing.patient_id;
  await logActivity({
    supabase,
    action: "update_patient_file",
    entityType: "patient",
    entityId: existing.patient_id,
    entityLabel: `${patientName} – ${row.original_name}`,
  });

  return ok({
    id: row.id, patientId: row.patient_id, name: row.name, originalName: row.original_name,
    mimeType: row.mime_type, category: row.category, size: row.size, storagePath: row.storage_path,
    audioStoragePath: row.audio_storage_path, label: row.label || "", notes: row.notes,
    url: urlData.publicUrl, audioUrl: audioPublicUrl, createdAt: row.created_at,
  });
}

// DELETE /api/v1/patient-files/[id]
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: file, error: fetchError } = await supabase
    .from("patient_files")
    .select("*, patients(full_name)")
    .eq("id", id)
    .single();

  if (fetchError || !file) return err("Fichier introuvable", 404);

  const toRemove = [file.storage_path];
  if (file.audio_storage_path) toRemove.push(file.audio_storage_path);

  const { error: storageError } = await supabase.storage
    .from("patient-files")
    .remove(toRemove);

  if (storageError) return err(`Erreur suppression: ${storageError.message}`, 500);

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
