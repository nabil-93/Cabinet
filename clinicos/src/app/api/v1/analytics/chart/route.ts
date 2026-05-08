import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, err } from "@/lib/supabase/helpers";

const MONTHS_FR = ["Jan","Fév","Mar","Avr","Mai","Juin","Juil","Aoû","Sep","Oct","Nov","Déc"];

function dateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "1d";
    const supabase = await createClient();
    const now = new Date();

    if (period === "1d") {
      const today = dateStr(now);
      const [{ data: appts }, { data: invoices }] = await Promise.all([
        supabase.from("appointments").select("time").eq("date", today),
        supabase.from("invoices").select("paid, created_at").gte("created_at", `${today}T00:00:00`).lt("created_at", `${today}T23:59:59`),
      ]);

      const data = Array.from({ length: 11 }, (_, i) => {
        const h = 8 + i;
        const label = `${pad2(h)}h`;
        const rdv = (appts || []).filter((a: any) => a.time && parseInt(a.time.slice(0, 2)) === h).length;
        const revenue = (invoices || [])
          .filter((inv: any) => inv.created_at && parseInt(inv.created_at.slice(11, 13)) === h)
          .reduce((s: number, inv: any) => s + (inv.paid || 0), 0);
        return { label, rdv, revenue };
      });

      return ok({ data, period });
    }

    if (period === "1w" || period === "1m") {
      const days = period === "1w" ? 7 : 30;
      const startDate = new Date(now);
      startDate.setDate(now.getDate() - (days - 1));
      const start = dateStr(startDate);

      const [{ data: appts }, { data: invoices }] = await Promise.all([
        supabase.from("appointments").select("date").gte("date", start),
        supabase.from("invoices").select("paid, date").gte("date", start),
      ]);

      const data = Array.from({ length: days }, (_, i) => {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        const ds = dateStr(d);
        const label = `${pad2(d.getDate())} ${MONTHS_FR[d.getMonth()]}`;
        const rdv = (appts || []).filter((a: any) => a.date === ds).length;
        const revenue = (invoices || [])
          .filter((inv: any) => inv.date === ds)
          .reduce((s: number, inv: any) => s + (inv.paid || 0), 0);
        return { label, rdv, revenue };
      });

      return ok({ data, period });
    }

    if (period === "6m") {
      const startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 5);
      startDate.setDate(1);
      const start = dateStr(startDate);

      const [{ data: appts }, { data: invoices }] = await Promise.all([
        supabase.from("appointments").select("date").gte("date", start),
        supabase.from("invoices").select("paid, date").gte("date", start),
      ]);

      const data = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now);
        d.setMonth(now.getMonth() - (5 - i));
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        const label = `${MONTHS_FR[m - 1]} ${y}`;

        const rdv = (appts || []).filter((a: any) => {
          if (!a.date) return false;
          const dd = new Date(a.date);
          return dd.getFullYear() === y && dd.getMonth() + 1 === m;
        }).length;

        const revenue = (invoices || [])
          .filter((inv: any) => {
            if (!inv.date) return false;
            const dd = new Date(inv.date);
            return dd.getFullYear() === y && dd.getMonth() + 1 === m;
          })
          .reduce((s: number, inv: any) => s + (inv.paid || 0), 0);

        return { label, rdv, revenue };
      });

      return ok({ data, period });
    }

    return err("Période invalide", 400);
  } catch (e: any) {
    return err(e.message || "Erreur serveur", 500);
  }
}
