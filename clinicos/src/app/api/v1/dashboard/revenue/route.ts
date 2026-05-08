import { createClient } from "@/lib/supabase/server";
import { ok, err } from "@/lib/supabase/helpers";

const MONTHS_FR = ["Jan","Fév","Mar","Avr","Mai","Juin","Juil","Aoû","Sep","Oct","Nov","Déc"];

export async function GET() {
  try {
    const supabase = await createClient();
    const dStart = new Date();
    dStart.setMonth(dStart.getMonth() - 5);
    dStart.setDate(1);
    const sixMonthsAgo = dStart.toISOString().split("T")[0];
    const sixMonthsAgoTs = dStart.toISOString();

    const { data: invoices } = await supabase.from("invoices").select("paid, date").gte("date", sixMonthsAgo);
    const { data: appointments } = await supabase.from("appointments").select("date").gte("date", sixMonthsAgo);
    const { data: patients } = await supabase.from("patients").select("created_at").gte("created_at", sixMonthsAgoTs);

    const result = Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      const y = d.getFullYear();
      const m = d.getMonth() + 1;

      const revenue = (invoices || [])
        .filter((inv: any) => { const dd = new Date(inv.date); return dd.getFullYear() === y && dd.getMonth() + 1 === m; })
        .reduce((s: number, inv: any) => s + (inv.paid || 0), 0);

      const apts = (appointments || [])
        .filter((a: any) => { const dd = new Date(a.date); return dd.getFullYear() === y && dd.getMonth() + 1 === m; }).length;

      const newPts = (patients || [])
        .filter((p: any) => { const dd = new Date(p.created_at); return dd.getFullYear() === y && dd.getMonth() + 1 === m; }).length;

      return { month: MONTHS_FR[m - 1], revenue, appointments: apts, newPatients: newPts };
    });

    return ok(result);
  } catch {
    return err("Erreur serveur", 500);
  }
}
