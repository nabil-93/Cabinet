import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, err } from "@/lib/supabase/helpers";
import { logActivity } from "@/lib/supabase/log-activity";

export const dynamic = "force-dynamic";

// File type category helpers
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml", "image/bmp"];
const AUDIO_TYPES = ["audio/mpeg", "audio/wav", "audio/ogg", "audio/webm", "audio/mp4", "audio/aac"];
const PDF_TYPES   = ["application/pdf"];
const DOC_TYPES   = [
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
];

function getFileCategory(mimeType: string): string {
  if (IMAGE_TYPES.includes(mimeType)) return "image";
  if (AUDIO_TYPES.includes(mimeType)) return "audio";
  if (PDF_TYPES.includes(mimeType))   return "pdf";
  if (DOC_TYPES.includes(mimeType))   return "document";
  return "other";
}

function normalize(row: any, publicUrl: string, audioPublicUrl: string | null) {
  return {
    id:               row.id,
    patientId:        row.patient_id,
    name:             row.name,
    originalName:     row.original_name,
    mimeType:         row.mime_type,
    category:         row.category,
    size:             row.size,
    storagePath:      row.storage_path,
    audioStoragePath: row.audio_storage_path || null,
    label:            row.label || "",
    notes:            row.notes,
    url:              publicUrl,
    audioUrl:         audioPublicUrl,
    createdAt:        row.created_at,
  };
}

// GET /api/v1/patient-files?patientId=xxx
export async function GET(req: NextRequest) {
  const patientId = req.nextUrl.searchParams.get("patientId");
  if (!patientId) return err("patientId requis", 400);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patient_files")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (error) return err(error.message);

  const files = (data || []).map((row: any) => {
    const { data: urlData } = supabase.storage.from("patient-files").getPublicUrl(row.storage_path);
    let audioPublicUrl: string | null = null;
    if (row.audio_storage_path) {
      const { data: audioUrlData } = supabase.storage.from("patient-files").getPublicUrl(row.audio_storage_path);
      audioPublicUrl = audioUrlData.publicUrl;
    }
    return normalize(row, urlData.publicUrl, audioPublicUrl);
  });

  return ok(files);
}

// POST /api/v1/patient-files  (multipart/form-data)
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file      = formData.get("file") as File | null;
    const audio     = formData.get("audio") as File | null;
    const patientId = formData.get("patientId") as string | null;
    const label     = (formData.get("label") as string) || "";
    const notes     = (formData.get("notes") as string) || null;

    if (!file || !patientId) return err("file et patientId requis", 400);

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) return err("Fichier trop volumineux (max 10 Mo)", 400);

    const supabase = await createClient();
    const category = getFileCategory(file.type);
    const ext = file.name.split(".").pop() || "bin";
    const storagePath = `${patientId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    // Upload main file to Supabase Storage
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from("patient-files")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) return err(`Upload échoué: ${uploadError.message}`, 500);

    // Upload audio attachment if present
    let audioStoragePath: string | null = null;
    if (audio && audio.size > 0) {
      audioStoragePath = `${patientId}/audio_${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webm`;
      const audioBuffer = Buffer.from(await audio.arrayBuffer());
      const { error: audioUploadError } = await supabase.storage
        .from("patient-files")
        .upload(audioStoragePath, audioBuffer, {
          contentType: audio.type || "audio/webm",
          upsert: false,
        });
      if (audioUploadError) {
        // Clean up main file if audio fails
        await supabase.storage.from("patient-files").remove([storagePath]);
        return err(`Upload audio échoué: ${audioUploadError.message}`, 500);
      }
    }

    // Save metadata in DB
    const insertData: Record<string, any> = {
      patient_id:    patientId,
      name:          file.name.replace(/\.[^/.]+$/, ""),
      original_name: file.name,
      mime_type:     file.type,
      category,
      size:          file.size,
      storage_path:  storagePath,
      label:         label || category,
      notes,
    };
    if (audioStoragePath) {
      insertData.audio_storage_path = audioStoragePath;
    }

    const { data: row, error: dbError } = await supabase
      .from("patient_files")
      .insert(insertData)
      .select("*")
      .single();

    if (dbError) {
      // Clean up uploaded files on DB error
      const toRemove = [storagePath];
      if (audioStoragePath) toRemove.push(audioStoragePath);
      await supabase.storage.from("patient-files").remove(toRemove);
      return err(dbError.message, 500);
    }

    // Get public URLs
    const { data: urlData } = supabase.storage.from("patient-files").getPublicUrl(storagePath);
    let audioPublicUrl: string | null = null;
    if (audioStoragePath) {
      const { data: audioUrlData } = supabase.storage.from("patient-files").getPublicUrl(audioStoragePath);
      audioPublicUrl = audioUrlData.publicUrl;
    }

    // Log activity
    const { data: patientData } = await supabase.from("patients").select("full_name").eq("id", patientId).single();
    const patientName = patientData?.full_name || patientId;
    await logActivity({
      supabase,
      action: "upload_patient_file",
      entityType: "patient",
      entityId: patientId,
      entityLabel: `${patientName} – ${file.name}${audioStoragePath ? " + audio" : ""}`,
    });

    return ok(normalize(row, urlData.publicUrl, audioPublicUrl), 201);
  } catch (e: any) {
    return err(e?.message || "Erreur serveur", 500);
  }
}
