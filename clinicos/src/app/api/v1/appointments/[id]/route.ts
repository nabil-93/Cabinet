import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, err } from "@/lib/supabase/helpers";
import { logActivity } from "@/lib/supabase/log-activity";

function normalize(data: any) {
  return {
    id: data.id,
    patientId: data.patient_id,
    patientName: data.patients?.full_name || "",
    doctorId: data.doctor_id,
    doctorName: data.profiles?.name || "",
    date: data.date, time: data.time,
    duration: data.duration, type: data.type,
    status: data.status, notes: data.notes, room: data.room,
  };
}

async function generateInvoiceNumber(supabase: any): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `FAC-${year}${month}-`;

  const { data: existing } = await supabase
    .from("invoices")
    .select("invoice_number")
    .ilike("invoice_number", `${prefix}%`)
    .order("invoice_number", { ascending: false })
    .limit(1);

  let nextNum = 1;
  if (existing && existing.length > 0) {
    const last = existing[0].invoice_number;
    const lastNum = parseInt(last.split("-").pop() || "0", 10);
    nextNum = lastNum + 1;
  }
  return `${prefix}${String(nextNum).padStart(4, "0")}`;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const supabase = await createClient();

  const update: Record<string, any> = {};
  if (body.status !== undefined) update.status = body.status;
  if (body.date   !== undefined) update.date   = body.date;
  if (body.time   !== undefined) update.time   = body.time;
  if (body.notes  !== undefined) update.notes  = body.notes;

  if (Object.keys(update).length === 0) return err("Aucun champ à modifier", 400);

  const { data, error } = await supabase
    .from("appointments")
    .update(update)
    .eq("id", id)
    .select("*, patients(full_name), profiles(name)")
    .single();

  if (error) return err(error.message);

  const patientName = data.patients?.full_name || "";
  if (body.status !== undefined) {
    await logActivity({ supabase, action: "update_appointment_status", entityType: "appointment", entityId: id, entityLabel: `${patientName} → ${body.status}`, req });
  } else if (body.date !== undefined || body.time !== undefined) {
    const newDate = body.date || data.date;
    await logActivity({ supabase, action: "reschedule_appointment", entityType: "appointment", entityId: id, entityLabel: `${patientName} → ${newDate}`, req });
  }

  if (body.status === "completed" && data) {
    const { data: existingInv } = await supabase
      .from("invoices")
      .select("id")
      .eq("patient_id", data.patient_id)
      .eq("date", data.date)
      .maybeSingle();

    if (!existingInv) {
      const invoiceNumber = await generateInvoiceNumber(supabase);
      await supabase.from("invoices").insert({
        invoice_number: invoiceNumber,
        patient_id: data.patient_id,
        date: data.date,
        total: 0,
        paid: 0,
        status: "unpaid",
        items: [],
      });
    }
  }

  return ok(normalize(data));
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: apt } = await supabase.from("appointments").select("date, time, patients(full_name)").eq("id", id).single();
  const { error } = await supabase.from("appointments").delete().eq("id", id);
  if (error) return err(error.message);
  const pName = (apt as any)?.patients?.full_name || "";
  await logActivity({ supabase, action: "delete_appointment", entityType: "appointment", entityId: id, entityLabel: `${pName} – ${apt?.date || ""} ${apt?.time || ""}`, req });
  return ok({ success: true });
}
