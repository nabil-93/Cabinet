import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, err } from "@/lib/supabase/helpers";
import { normalize } from "../route";
import { logActivity } from "@/lib/supabase/log-activity";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.from("patients").select("*").eq("id", id).single();
  if (error) return err("Patient introuvable", 404);
  return ok(normalize(data));
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const supabase = await createClient();

  // Construire l'objet update dynamiquement — seulement les champs définis
  const updateData: Record<string, any> = {};
  if (body.fullName       !== undefined) updateData.full_name       = body.fullName;
  if (body.phone          !== undefined) updateData.phone           = body.phone;
  if (body.email          !== undefined) updateData.email           = body.email;
  if (body.dateOfBirth    !== undefined) updateData.date_of_birth   = body.dateOfBirth;
  if (body.gender         !== undefined) updateData.gender          = body.gender;
  if (body.address        !== undefined) updateData.address         = body.address;
  if (body.bloodType      !== undefined) updateData.blood_type      = body.bloodType;
  if (body.medicalHistory !== undefined) updateData.medical_history = body.medicalHistory;
  if (body.allergies      !== undefined) updateData.allergies       = body.allergies;
  if (body.status         !== undefined) updateData.status          = body.status;
  if (body.avatarUrl      !== undefined) updateData.avatar_url      = body.avatarUrl;

  if (Object.keys(updateData).length === 0) return err("Aucun champ à modifier", 400);

  const { data, error } = await supabase
    .from("patients")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) return err(error.message);
  await logActivity({ supabase, action: "update_patient", entityType: "patient", entityId: id, entityLabel: data.full_name });
  return ok(normalize(data));
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: patient } = await supabase.from("patients").select("full_name").eq("id", id).single();
  const { error } = await supabase.from("patients").delete().eq("id", id);
  if (error) return err(error.message);
  await logActivity({ supabase, action: "delete_patient", entityType: "patient", entityId: id, entityLabel: patient?.full_name });
  return ok({ success: true });
}
