import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, err } from "@/lib/supabase/helpers";
import { logActivity } from "@/lib/supabase/log-activity";

function normalize(a: any, patientName?: string, doctorName?: string) {
  return {
    id: a.id,
    patientId: a.patient_id,
    patientName: a.patients?.full_name || patientName || "",
    doctorId: a.doctor_id,
    doctorName: a.profiles?.name || doctorName || "Dr. Bensalem",
    date: a.date,
    time: a.time,
    duration: a.duration,
    type: a.type,
    status: a.status,
    notes: a.notes,
    room: a.room,
  };
}

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  const month = req.nextUrl.searchParams.get("month");
  const supabase = await createClient();

  let query = supabase
    .from("appointments")
    .select("*, patients(full_name), profiles(name)")
    .order("date", { ascending: false })
    .order("time", { ascending: true });

  if (date) {
    query = query.eq("date", date);
  } else if (month) {
    query = query.gte("date", `${month}-01`).lte("date", `${month}-31`);
  } else {
    query = query.limit(100);
  }

  const { data, error } = await query;
  if (error) return err(error.message);
  return ok((data || []).map(a => normalize(a)));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("appointments")
      .insert({
        patient_id: body.patientId,
        doctor_id:  body.doctorId || null,  // null si pas de médecin fourni
        date:       body.date,
        time:       body.time,
        duration:   body.duration || 30,
        type:       body.type || "Consultation",
        status:     "pending",
        notes:      body.notes,
        room:       body.room,
      })
      .select("*, patients(full_name), profiles(name)")
      .single();
    if (error) return err(error.message);
    await logActivity({ supabase, action: "create_appointment", entityType: "appointment", entityId: data.id, entityLabel: `${data.patients?.full_name} – ${data.date} ${data.time}` });
    return ok(normalize(data), 201);
  } catch {
    return err("Erreur serveur", 500);
  }
}
