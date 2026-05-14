import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, err } from "@/lib/supabase/helpers";
import { normalize } from "../route";
import { logActivity } from "@/lib/supabase/log-activity";

function computeStatus(paid: number, total: number, explicit?: string): string {
  if (explicit && ["paid", "unpaid", "partial", "refunded"].includes(explicit)) return explicit;
  if (total > 0 && paid >= total) return "paid";
  if (paid > 0 && paid < total) return "partial";
  return "unpaid";
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: inv } = await supabase.from("invoices").select("invoice_number").eq("id", id).single();
  const { error } = await supabase.from("invoices").delete().eq("id", id);
  if (error) return err(error.message);
  await logActivity({ supabase, action: "delete_invoice", entityType: "invoice", entityId: id, entityLabel: inv?.invoice_number || id, req });
  return ok({ success: true });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("*, patients(full_name, phone)")
    .eq("id", id)
    .single();
  if (error) return err(error.message, 404);
  return ok(normalize(data));
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const supabase = await createClient();

  const { data: current } = await supabase
    .from("invoices")
    .select("total, paid")
    .eq("id", id)
    .single();

  if (!current) return err("Facture introuvable", 404);

  const newTotal = body.total !== undefined ? Number(body.total) : current.total;
  const newPaid = body.paid !== undefined ? Number(body.paid) : current.paid;

  const update: Record<string, any> = {};
  if (body.total !== undefined) update.total = newTotal;
  if (body.paid !== undefined) update.paid = newPaid;
  if (body.notes !== undefined) update.notes = body.notes;
  if (body.items !== undefined) update.items = body.items;
  if (body.date !== undefined) update.date = body.date;
  if (body.dueDate !== undefined) update.due_date = body.dueDate;
  if (body.paidAt !== undefined) update.paid_at = body.paidAt || null;
  update.status = computeStatus(newPaid, newTotal, body.status);
  // Auto-set paid_at when status becomes paid
  if (update.status === "paid" && !body.paidAt) update.paid_at = new Date().toISOString().split("T")[0];
  if (update.status !== "paid" && body.paidAt === undefined) update.paid_at = null;

  const { data, error } = await supabase
    .from("invoices")
    .update(update)
    .eq("id", id)
    .select("*, patients(full_name, phone)")
    .single();

  if (error) return err(error.message);
  await logActivity({ supabase, action: "update_invoice", entityType: "invoice", entityId: id, entityLabel: (data as any).invoice_number, req });
  return ok(normalize(data));
}
