import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, err } from "@/lib/supabase/helpers";
import { getToday, formatDate } from "@/lib/date-utils";

export const dynamic = "force-dynamic";

function getDateRange(period: string): { from: string; to: string } {
  const now = new Date();
  const today = getToday();

  if (period === "day") {
    return { from: today, to: today };
  }
  if (period === "week") {
    const day = now.getDay(); // 0=Sun
    const diff = (day === 0 ? -6 : 1 - day); // Monday
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    return { from: formatDate(monday), to: today };
  }
  // month (default)
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  return { from: monthStart, to: today };
}

export async function GET(req: NextRequest) {
  try {
    const period = req.nextUrl.searchParams.get("period") ?? "month";
    const { from, to } = getDateRange(period);
    const today = getToday();

    const supabase = await createClient();

    const [
      { data: appointments },
      { data: prescriptions },
      { data: invoices },
      { count: waitingCount },
      { data: todayApts },
    ] = await Promise.all([
      supabase.from("appointments")
        .select("status, patient_id")
        .gte("date", from).lte("date", to),
      supabase.from("prescriptions")
        .select("id")
        .gte("created_at", `${from}T00:00:00`),
      supabase.from("invoices")
        .select("paid, total, status")
        .gte("created_at", `${from}T00:00:00`),
      supabase.from("waiting_room")
        .select("*", { count: "exact", head: true })
        .eq("status", "waiting")
        .gte("arrived_at", `${today}T00:00:00`),
      supabase.from("appointments")
        .select("status")
        .eq("date", today),
    ]);

    const apts = appointments ?? [];
    const completed   = apts.filter(a => a.status === "completed").length;
    const confirmed   = apts.filter(a => a.status === "confirmed").length;
    const pending     = apts.filter(a => a.status === "pending").length;
    const cancelled   = apts.filter(a => a.status === "cancelled").length;

    const uniquePatients = new Set(apts.map(a => a.patient_id)).size;

    const revenue = (invoices ?? []).reduce((s, inv) => s + (inv.paid || 0), 0);
    const invoicesCount = (invoices ?? []).length;

    // Today breakdown for the bar chart
    const todayAptsList = todayApts ?? [];
    const todayByStatus = {
      confirmed: todayAptsList.filter(a => a.status === "confirmed").length,
      completed: todayAptsList.filter(a => a.status === "completed").length,
      pending:   todayAptsList.filter(a => a.status === "pending").length,
      cancelled: todayAptsList.filter(a => a.status === "cancelled").length,
    };

    return ok({
      period,
      from,
      to,
      consultations: completed,
      patients: uniquePatients,
      prescriptions: (prescriptions ?? []).length,
      invoices: invoicesCount,
      revenue,
      totalAppointments: apts.length,
      byStatus: { confirmed, completed, pending, cancelled },
      todayByStatus,
      waitingRoom: waitingCount ?? 0,
    });
  } catch (e: any) {
    return err(e.message ?? "Erreur serveur", 500);
  }
}
