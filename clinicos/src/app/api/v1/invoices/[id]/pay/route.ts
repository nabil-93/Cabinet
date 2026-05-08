import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, err } from "@/lib/supabase/helpers";
import { normalize } from "../../route";
import { logActivity } from "@/lib/supabase/log-activity";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const supabase = await createClient();

  const { data: inv } = await supabase
    .from("invoices")
    .select("total")
    .eq("id", id)
    .single();

  if (!inv) return err("Facture introuvable", 404);

  const paid = body.amount !== undefined ? Number(body.amount) : inv.total;
  const total = inv.total;

  let status = "unpaid";
  if (total > 0 && paid >= total) status = "paid";
  else if (paid > 0 && paid < total) status = "partial";

  const { data, error } = await supabase
    .from("invoices")
    .update({ paid, status })
    .eq("id", id)
    .select("*, patients(full_name, phone)")
    .single();

  if (error) return err(error.message);
  const invoiceNumber = (data as any).invoice_number || "";
  await logActivity({ supabase, action: "pay_invoice", entityType: "invoice", entityId: id, entityLabel: `${invoiceNumber} – ${paid} MAD` });
  return ok(normalize(data));
}
