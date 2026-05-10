import { createClient } from "@/lib/supabase/server";
import { ok, err } from "@/lib/supabase/helpers";
import { getToday, formatDate } from "@/lib/date-utils";

function ageGroup(dob: string | null): string {
  if (!dob) return "Inconnu";
  const age = Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
  if (age < 18)  return "0-17";
  if (age < 31)  return "18-30";
  if (age < 46)  return "31-45";
  if (age < 61)  return "46-60";
  if (age < 76)  return "61-75";
  return "75+";
}

const AGE_ORDER = ["0-17", "18-30", "31-45", "46-60", "61-75", "75+"];

export async function GET() {
  try {
    const supabase = await createClient();

    const now = new Date();
    const today = getToday();
    const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(now.getDate() - 30);
    const d30 = formatDate(thirtyDaysAgo);
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    // Fetch all in parallel
    const [
      { data: patients },
      { data: appointments30 },
      { data: appointmentsAll },
      { data: invoices },
    ] = await Promise.all([
      supabase.from("patients").select("gender, date_of_birth, created_at, status"),
      supabase.from("appointments").select("time, status, type").gte("date", d30),
      supabase.from("appointments").select("date, status"),
      supabase.from("invoices").select("paid, total").gte("created_at", `${monthStart}T00:00:00`),
    ]);

    // ── Gender distribution ──────────────────────────────────────────────────
    const genderMap: Record<string, number> = {};
    (patients || []).forEach((p: any) => {
      const g = p.gender === "male" ? "Homme" : p.gender === "female" ? "Femme" : "Autre";
      genderMap[g] = (genderMap[g] || 0) + 1;
    });
    const totalPatients = (patients || []).length || 1;
    const genderData = Object.entries(genderMap).map(([name, count]) => ({
      name, value: count, pct: Math.round((count / totalPatients) * 100),
    }));

    // ── Age groups ────────────────────────────────────────────────────────────
    const ageMap: Record<string, number> = {};
    (patients || []).forEach((p: any) => {
      const g = ageGroup(p.date_of_birth);
      ageMap[g] = (ageMap[g] || 0) + 1;
    });
    const ageGroups = AGE_ORDER.map(age => ({ age, count: ageMap[age] || 0 }));

    // ── Peak hours (last 30 days) ─────────────────────────────────────────────
    const hourMap: Record<number, number> = {};
    for (let h = 8; h <= 18; h++) hourMap[h] = 0;
    (appointments30 || []).forEach((a: any) => {
      if (!a.time) return;
      const h = parseInt(a.time.slice(0, 2), 10);
      if (h >= 8 && h <= 18) hourMap[h] = (hourMap[h] || 0) + 1;
    });
    const peakHours = Object.entries(hourMap)
      .map(([h, count]) => ({ hour: `${h}h`, patients: count }))
      .sort((a, b) => parseInt(a.hour) - parseInt(b.hour));

    // ── Consultation types ────────────────────────────────────────────────────
    const typeMap: Record<string, number> = {};
    (appointments30 || []).forEach((a: any) => {
      const t = a.type || "Consultation";
      typeMap[t] = (typeMap[t] || 0) + 1;
    });
    const consultationTypes = Object.entries(typeMap)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    // ── KPIs ──────────────────────────────────────────────────────────────────
    const total30 = (appointments30 || []).length;
    const avgPerDay = Math.round((total30 / 30) * 10) / 10;

    const completed30 = (appointments30 || []).filter((a: any) => a.status === "completed").length;
    const cancelled30  = (appointments30 || []).filter((a: any) => a.status === "cancelled").length;
    const completionRate = total30 > 0
      ? Math.round((completed30 / (completed30 + cancelled30 || 1)) * 100)
      : 0;

    const newPatientsMonth = (patients || []).filter((p: any) =>
      p.created_at && p.created_at.slice(0, 10) >= monthStart
    ).length;

    const monthlyRevenue = (invoices || []).reduce((s: number, inv: any) => s + (inv.paid || 0), 0);

    const activePatients   = (patients || []).filter((p: any) => p.status === "active").length;
    const inactivePatients = (patients || []).filter((p: any) => p.status === "inactive").length;

    return ok({
      kpi: { avgPerDay, completionRate, newPatientsMonth, monthlyRevenue, activePatients, inactivePatients, totalPatients: patients?.length || 0 },
      genderData,
      ageGroups,
      peakHours,
      consultationTypes,
    });
  } catch (e: any) {
    return err(e.message || "Erreur serveur", 500);
  }
}
