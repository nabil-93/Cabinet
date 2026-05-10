import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, err } from "@/lib/supabase/helpers";
import { logActivity } from "@/lib/supabase/log-activity";
import { getToday } from "@/lib/date-utils";

function parseDays(duration: string): number {
  if (!duration) return 0;
  if (/vie/i.test(duration)) return 99999;
  const m = duration.match(/(\d+)\s*(mois|jour)/i);
  if (!m) return 7;
  return parseInt(m[1]) * (/mois/i.test(m[2]) ? 30 : 1);
}

export function normalize(p: any) {
  const medications = p.medications || [];
  const maxDays = medications.reduce((max: number, med: any) => {
    const d = parseDays(med.duration || "");
    return d > max ? d : max;
  }, 0);

  let status = p.status;
  if (status !== "expired" && maxDays > 0) {
    const expires = new Date(p.date);
    expires.setDate(expires.getDate() + maxDays);
    if (expires < new Date()) status = "expired";
  }

  return {
    id: p.id,
    patientId: p.patient_id,
    patientName: p.patients?.full_name || "",
    doctorId: p.doctor_id,
    doctorName: p.profiles?.name || "—",
    date: p.date,
    diagnosis: p.diagnosis,
    medications,
    notes: p.notes,
    status,
  };
}

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prescriptions")
    .select("*, patients(full_name), profiles(name)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return err(error.message);
  return ok((data || []).map(normalize));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { patientId, diagnosis, medications, notes, doctorId } = body;
    if (!patientId || !diagnosis) return err("patientId et diagnosis requis", 400);

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("prescriptions")
      .insert({
        patient_id: patientId,
        doctor_id: doctorId || null,
        diagnosis,
        medications: medications || [],
        notes: notes || null,
        date: new Date().toISOString().slice(0, 10),
        status: "active",
      })
      .select("*, patients(full_name), profiles(name)")
      .single();

    if (error) return err(error.message);
    const patientNamePresc = (data as any).patients?.full_name || patientId;
    await logActivity({ supabase, action: "create_prescription", entityType: "prescription", entityId: data.id, entityLabel: `${patientNamePresc} – ${diagnosis}` });
    return ok(normalize(data), 201);
  } catch {
    return err("Erreur serveur", 500);
  }
}
