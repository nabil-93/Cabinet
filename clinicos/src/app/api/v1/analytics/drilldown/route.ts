import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, err } from "@/lib/supabase/helpers";
import { formatDate } from "@/lib/date-utils";

export const dynamic = "force-dynamic";

function getDateRange(period: string) {
  const now = new Date();
  const today = formatDate(now);

  if (period === "day") return { from: today, to: today };

  if (period === "week") {
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    return { from: formatDate(monday), to: today };
  }

  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  return { from: monthStart, to: today };
}

export async function GET(req: NextRequest) {
  try {
    const type   = req.nextUrl.searchParams.get("type")   ?? "consultations";
    const period = req.nextUrl.searchParams.get("period") ?? "month";
    const { from, to } = getDateRange(period);
    const supabase = await createClient();

    // ── Appointments by status ──────────────────────────────────────────────
    if (["consultations", "rdv_confirmed", "rdv_completed", "rdv_pending", "rdv_cancelled", "rdv_all"].includes(type)) {
      const statusMap: Record<string, string | null> = {
        consultations: "completed",
        rdv_confirmed: "confirmed",
        rdv_completed: "completed",
        rdv_pending:   "pending",
        rdv_cancelled: "cancelled",
        rdv_all:       null,
      };
      const status = statusMap[type];
      let q = supabase
        .from("appointments")
        .select("id, date, time, type, status, patient_id, patients(full_name, phone)")
        .gte("date", from).lte("date", to)
        .order("date", { ascending: false })
        .order("time", { ascending: true });
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) return err(error.message);
      return ok((data ?? []).map((a: any) => ({
        id: a.id,
        patientName: a.patients?.full_name ?? "—",
        patientPhone: a.patients?.phone ?? "",
        date: a.date,
        time: a.time,
        type: a.type,
        status: a.status,
      })));
    }

    // ── Unique patients treated ─────────────────────────────────────────────
    if (type === "patients") {
      const { data, error } = await supabase
        .from("appointments")
        .select("patient_id, date, patients(full_name, phone, date_of_birth, gender)")
        .eq("status", "completed")
        .gte("date", from).lte("date", to)
        .order("date", { ascending: false });
      if (error) return err(error.message);
      const seen = new Set<string>();
      const items: any[] = [];
      for (const a of (data ?? [])) {
        if (seen.has(a.patient_id)) continue;
        seen.add(a.patient_id);
        items.push({
          id: a.patient_id,
          patientName: (a.patients as any)?.full_name ?? "—",
          patientPhone: (a.patients as any)?.phone ?? "",
          gender: (a.patients as any)?.gender ?? "",
          date: a.date,
        });
      }
      return ok(items);
    }

    // ── Prescriptions ───────────────────────────────────────────────────────
    if (type === "prescriptions") {
      const { data, error } = await supabase
        .from("prescriptions")
        .select("id, date, diagnosis, medications, patients(full_name, phone)")
        .gte("created_at", `${from}T00:00:00`)
        .order("created_at", { ascending: false });
      if (error) return err(error.message);
      return ok((data ?? []).map((p: any) => ({
        id: p.id,
        patientName: p.patients?.full_name ?? "—",
        patientPhone: p.patients?.phone ?? "",
        date: p.date,
        diagnosis: p.diagnosis ?? "",
        medications: (p.medications ?? []).map((m: any) => m.name ?? m).join(", "),
      })));
    }

    // ── Invoices (all / unpaid / partial) ──────────────────────────────────
    if (["invoices", "invoices_unpaid", "invoices_partial", "invoices_paid"].includes(type)) {
      const statusMap: Record<string, string | null> = {
        invoices:         null,
        invoices_unpaid:  "unpaid",
        invoices_partial: "partial",
        invoices_paid:    "paid",
      };
      const status = statusMap[type];
      let q = supabase
        .from("invoices")
        .select("id, invoice_number, date, total, paid, status, patients(full_name, phone)")
        .gte("created_at", `${from}T00:00:00`)
        .order("created_at", { ascending: false });
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) return err(error.message);
      return ok((data ?? []).map((inv: any) => ({
        id: inv.id,
        invoiceNumber: inv.invoice_number,
        patientName: inv.patients?.full_name ?? "—",
        patientPhone: inv.patients?.phone ?? "",
        date: inv.date,
        total: inv.total,
        paid: inv.paid,
        remaining: (inv.total ?? 0) - (inv.paid ?? 0),
        status: inv.status,
      })));
    }

    return err("Type inconnu", 400);
  } catch (e: any) {
    return err(e.message ?? "Erreur serveur", 500);
  }
}
