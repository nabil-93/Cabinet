import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, err } from "@/lib/supabase/helpers";
import { logActivity } from "@/lib/supabase/log-activity";

function normalize(c: any) {
  return {
    id:         c.id,
    patientId:  c.patient_id,
    doctorId:   c.doctor_id,
    doctorName: c.profiles?.name || "Dr.",
    date:       c.date,
    time:       c.time,
    type:       c.type,
    diagnosis:  c.diagnosis,
    notes:      c.notes,
    treatment:  c.treatment,
    nextVisit:  c.next_visit,
    createdAt:  c.created_at,
  };
}

export async function GET(req: NextRequest) {
  const patientId = req.nextUrl.searchParams.get("patientId");
  const supabase = await createClient();

  let query = supabase
    .from("consultations")
    .select("*, profiles(name)")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (patientId) query = query.eq("patient_id", patientId);
  else query = query.limit(100);

  const { data, error } = await query;
  if (error) return err(error.message);
  return ok((data || []).map(normalize));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("consultations")
      .insert({
        patient_id: body.patientId,
        doctor_id:  body.doctorId || null,
        date:       body.date,
        time:       body.time || "09:00",
        type:       body.type || "Consultation",
        diagnosis:  body.diagnosis || null,
        notes:      body.notes || null,
        treatment:  body.treatment || null,
        next_visit: body.nextVisit || null,
      })
      .select("*, profiles(name), patients(full_name)")
      .single();

    if (error) return err(error.message);
    const patientNameConsult = (data as any).patients?.full_name || body.patientId;
    await logActivity({ supabase, action: "create_consultation", entityType: "consultation", entityId: data.id, entityLabel: `${patientNameConsult} – ${data.diagnosis || ""}`, req });
    return ok(normalize(data), 201);
  } catch {
    return err("Erreur serveur", 500);
  }
}
