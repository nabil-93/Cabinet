import { createClient } from "@/lib/supabase/server";
import { ok, err } from "@/lib/supabase/helpers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = await createClient();
    const today = new Date().toISOString().split("T")[0];
    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();
    const monthStr = `${year}-${month.toString().padStart(2, "0")}-01T00:00:00.000Z`;

    // Toutes les requêtes en parallèle
    const [
      { count: totalPatients },
      { count: todayAppointments },
      { data: revenueData },
      { count: pendingInvoices },
      { count: waitingRoom },
      { count: completedToday },
    ] = await Promise.all([
      supabase.from("patients").select("*", { count: "exact", head: true }),
      supabase.from("appointments").select("*", { count: "exact", head: true })
        .eq("date", today).in("status", ["confirmed", "pending"]),
      supabase.from("invoices").select("paid").gte("created_at", monthStr),
      supabase.from("invoices").select("*", { count: "exact", head: true }).eq("status", "unpaid"),
      supabase.from("waiting_room").select("*", { count: "exact", head: true }).eq("status", "waiting").gte("arrived_at", `${today}T00:00:00`),
      supabase.from("appointments").select("*", { count: "exact", head: true })
        .eq("date", today).eq("status", "completed"),
    ]);

    const monthlyRevenue = (revenueData || []).reduce((sum: number, inv: any) => sum + (inv.paid || 0), 0);

    const response = NextResponse.json({
      totalPatients: totalPatients || 0,
      todayAppointments: todayAppointments || 0,
      monthlyRevenue,
      pendingInvoices: pendingInvoices || 0,
      waitingRoom: waitingRoom || 0,
      completedToday: completedToday || 0,
    });

    return response;
  } catch {
    return err("Erreur serveur", 500);
  }
}
