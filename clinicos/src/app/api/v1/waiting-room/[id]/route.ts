import { createClient } from "@/lib/supabase/server";
import { ok, err } from "@/lib/supabase/helpers";
import { NextRequest } from "next/server";
import { logActivity } from "@/lib/supabase/log-activity";
import { normalize } from "../route";
import { getToday } from "@/lib/date-utils";

const ALLOWED_STATUSES = ["waiting", "in_progress", "done"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { status, doctorId, doctorName } = body;

  if (!status || !ALLOWED_STATUSES.includes(status)) return err("Statut invalide", 400);

  const supabase = await createClient();

  // Fetch current entry for validation
  const { data: current } = await supabase
    .from("waiting_room")
    .select("status, patients(full_name)")
    .eq("id", id)
    .single();

  if (!current) return err("Entrée introuvable", 404);

  // Race condition guard: only move from expected previous state
  const validTransition: Record<string, string> = {
    in_progress: "waiting",
    done:        "in_progress",
  };
  if (validTransition[status] && current.status !== validTransition[status]) {
    return err(`Transition invalide: ${current.status} → ${status}`, 409);
  }

  // ── Verify doctor is still online at request time ──
  if (status === "in_progress" && doctorId) {
    const threshold = new Date(Date.now() - 90_000).toISOString();
    const { data: doc } = await supabase
      .from("profiles")
      .select("is_online, last_seen_at")
      .eq("id", doctorId)
      .single();

    const isOnline = doc?.is_online && doc?.last_seen_at && doc.last_seen_at >= threshold;
    if (!isOnline) {
      return err("Ce médecin n'est plus en ligne — veuillez en choisir un autre", 409);
    }
  }

  const update: Record<string, any> = { status };
  if (status === "in_progress" && doctorId) {
    update.assigned_doctor_id   = doctorId;
    update.assigned_doctor_name = doctorName ?? null;
  }

  const { data, error } = await supabase
    .from("waiting_room")
    .update(update)
    .eq("id", id)
    .select("*, patients(full_name), appointments(time)")
    .single();

  if (error) return err(error.message);

  const patientName = (current.patients as any)?.full_name || "";

  if (status === "in_progress") {
    await logActivity({ supabase, action: "call_patient", entityType: "patient", entityLabel: patientName, req });
    // Update doctor availability to BUSY
    if (doctorId) {
      await supabase.from("profiles").update({ is_available: false }).eq("id", doctorId);
    }
  }

  if (status === "done") {
    await logActivity({ supabase, action: "finish_consultation", entityType: "patient", entityLabel: patientName, req });
    // Mark linked appointment as completed
    if (data.appointment_id) {
      await supabase.from("appointments")
        .update({ status: "completed" })
        .eq("id", data.appointment_id);
    }
    // Free up the doctor
    if (data.assigned_doctor_id) {
      await supabase.from("profiles")
        .update({ is_available: true })
        .eq("id", data.assigned_doctor_id);
    }
    // Auto-create invoice — use appointment type as description
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const prefix = `FAC-${year}${month}-`;
    const { data: existingInv } = await supabase
      .from("invoices")
      .select("invoice_number")
      .ilike("invoice_number", `${prefix}%`)
      .order("invoice_number", { ascending: false })
      .limit(1);
    let nextNum = 1;
    if (existingInv && existingInv.length > 0) {
      const lastNum = parseInt(existingInv[0].invoice_number.split("-").pop() || "0", 10);
      nextNum = lastNum + 1;
    }
    const invoiceNumber = `${prefix}${String(nextNum).padStart(4, "0")}`;
    let invoiceDescription = "Consultation médicale";
    if (data.appointment_id) {
      const { data: appt } = await supabase
        .from("appointments").select("type").eq("id", data.appointment_id).single();
      if (appt?.type) invoiceDescription = appt.type;
    }
    await supabase.from("invoices").insert({
      invoice_number: invoiceNumber,
      patient_id: data.patient_id,
      date: getToday(),
      total: 300,
      paid: 0,
      status: "unpaid",
      items: [{ description: invoiceDescription, quantity: 1, unitPrice: 300, total: 300 }],
    });
  }

  return ok(normalize(data));
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: entry } = await supabase
    .from("waiting_room")
    .select("patients(full_name), assigned_doctor_id")
    .eq("id", id).single();

  const { error } = await supabase.from("waiting_room").delete().eq("id", id);
  if (error) return err(error.message);

  const patientName = (entry as any)?.patients?.full_name || "";
  await logActivity({ supabase, action: "remove_from_waiting_room", entityType: "patient", entityLabel: patientName, req });

  // If patient was in consultation, free the doctor
  const doctorId = (entry as any)?.assigned_doctor_id;
  if (doctorId) {
    await supabase.from("profiles").update({ is_available: true }).eq("id", doctorId);
  }

  return ok({ success: true });
}
