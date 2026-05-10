import { createClient } from "@/lib/supabase/server";
import { ok, err } from "@/lib/supabase/helpers";
import { NextRequest } from "next/server";
import { logActivity } from "@/lib/supabase/log-activity";
import { getToday } from "@/lib/date-utils";

export function normalize(w: any) {
  return {
    id:                  w.id,
    patientId:           w.patient_id,
    patientName:         w.patients?.full_name || "Inconnu",
    appointmentId:       w.appointment_id,
    appointmentTime:     w.appointments?.time ?? null,
    arrivedAt:           w.arrived_at,
    status:              w.status as "waiting" | "in_progress" | "done",
    priority:            (w.priority ?? "normal") as "normal" | "urgent",
    estimatedWait:       w.estimated_wait ?? 0,
    assignedDoctorId:    w.assigned_doctor_id ?? null,
    assignedDoctorName:  w.assigned_doctor_name ?? null,
  };
}

export async function GET() {
  const supabase = await createClient();
  const today = getToday();

  const { data, error } = await supabase
    .from("waiting_room")
    .select("*, patients(full_name), appointments(time)")
    .gte("arrived_at", `${today}T00:00:00`)
    .order("arrived_at", { ascending: true });

  if (error) return err(error.message);
  return ok((data || []).map(normalize));
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { patientId, priority = "normal", appointmentId, visitType = "Consultation" } = body;

  if (!patientId) return err("patientId requis", 400);

  const supabase = await createClient();
  const today = getToday();

  const { data: existing } = await supabase
    .from("waiting_room")
    .select("id, status")
    .eq("patient_id", patientId)
    .gte("arrived_at", `${today}T00:00:00`)
    .in("status", ["waiting", "in_progress"])
    .maybeSingle();

  if (existing) return err("Ce patient est déjà dans la salle d'attente", 409);

  // If no appointment linked, create one automatically with the visit type
  let finalAppointmentId = appointmentId ?? null;
  if (!finalAppointmentId) {
    const now = new Date();
    const { data: appt } = await supabase
      .from("appointments")
      .insert({
        patient_id: patientId,
        date: today,
        time: now.toTimeString().slice(0, 5),
        type: visitType,
        status: "confirmed",
      })
      .select("id")
      .single();
    if (appt) finalAppointmentId = appt.id;
  } else {
    // Update existing appointment type if provided
    await supabase.from("appointments")
      .update({ type: visitType })
      .eq("id", finalAppointmentId);
  }

  const { data, error } = await supabase
    .from("waiting_room")
    .insert({
      patient_id: patientId,
      appointment_id: finalAppointmentId,
      priority,
      status: "waiting",
      arrived_at: new Date().toISOString(),
    })
    .select("*, patients(full_name), appointments(time)")
    .single();

  if (error) return err(error.message);

  const patientName = data.patients?.full_name || "Inconnu";
  await logActivity({ supabase, action: "add_to_waiting_room", entityType: "patient", entityLabel: patientName });

  return ok(normalize(data));
}
