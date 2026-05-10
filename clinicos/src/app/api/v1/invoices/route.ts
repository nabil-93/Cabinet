import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, err } from "@/lib/supabase/helpers";
import { logActivity } from "@/lib/supabase/log-activity";
import { getToday } from "@/lib/date-utils";

export function normalize(inv: any) {
  return {
    id: inv.id,
    invoiceNumber: inv.invoice_number,
    patientId: inv.patient_id,
    patientName: inv.patients?.full_name || "",
    patientPhone: inv.patients?.phone || "",
    date: inv.date,
    dueDate: inv.due_date,
    paidAt: inv.paid_at ?? null,
    total: inv.total,
    paid: inv.paid,
    status: inv.status,
    notes: inv.notes,
    items: inv.items || [],
  };
}

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("*, patients(full_name, phone)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return err(error.message);
  return ok((data || []).map(normalize));
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { patientId, total = 0, items = [], notes, dueDate, appointmentId } = body;

  if (!patientId) return err("patientId requis", 400);

  const supabase = await createClient();

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

  const invoiceNumber = `${prefix}${String(nextNum).padStart(4, "0")}`;

  const insertPayload: Record<string, any> = {
    invoice_number: invoiceNumber,
    patient_id: patientId,
    date: getToday(),
    total,
    paid: 0,
    status: "unpaid",
    items,
  };
  if (notes) insertPayload.notes = notes;
  if (dueDate) insertPayload.due_date = dueDate;

  const { data, error } = await supabase
    .from("invoices")
    .insert(insertPayload)
    .select("*, patients(full_name, phone)")
    .single();

  if (error) return err(error.message);
  const patientName = (data as any).patients?.full_name || "";
  await logActivity({ supabase, action: "create_invoice", entityType: "invoice", entityId: data.id, entityLabel: `${data.invoice_number} – ${patientName}` });
  return ok(normalize(data), 201);
}
