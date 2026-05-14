import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, err } from "@/lib/supabase/helpers";
import { logActivity } from "@/lib/supabase/log-activity";

export async function GET(req: NextRequest) {
  const limit = req.nextUrl.searchParams.get("limit");
  const supabase = await createClient();
  let query = supabase
    .from("patients")
    .select("*")
    .order("created_at", { ascending: false });

  if (limit) {
    query = query.limit(parseInt(limit, 10));
  } else {
    query = query.limit(100);
  }

  const { data, error } = await query;

  if (error) return err(error.message);
  return ok((data || []).map(normalize));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("patients")
      .insert({
        full_name:       body.fullName,
        phone:           body.phone,
        email:           body.email,
        date_of_birth:   body.dateOfBirth,
        gender:          body.gender,
        address:         body.address,
        blood_type:      body.bloodType,
        medical_history: body.medicalHistory || [],
        allergies:       body.allergies || [],
        status:          "active",
      })
      .select()
      .single();

    if (error) return err(error.message);
    await logActivity({ supabase, action: "create_patient", entityType: "patient", entityId: data.id, entityLabel: data.full_name });
    return ok(normalize(data), 201);
  } catch {
    return err("Erreur serveur", 500);
  }
}

export function normalize(p: any) {
  return {
    id: p.id, fullName: p.full_name, phone: p.phone, email: p.email,
    dateOfBirth: p.date_of_birth, gender: p.gender, address: p.address,
    bloodType: p.blood_type, medicalHistory: p.medical_history || [],
    allergies: p.allergies || [], status: p.status,
    createdAt: p.created_at, lastVisit: p.last_visit,
    avatarUrl: p.avatar_url ?? null,
  };
}
