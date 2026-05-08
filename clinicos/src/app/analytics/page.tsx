"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { TrendingUp, Users, Calendar, CreditCard, CheckCircle } from "lucide-react";
import Header from "@/components/layout/Header";
import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";
import { cn } from "@/lib/utils";
import { ChartSkeleton } from "@/components/ui/skeleton";

const AreaChart       = dynamic(() => import("recharts").then(m => ({ default: m.AreaChart })),       { ssr: false });
const Area            = dynamic(() => import("recharts").then(m => ({ default: m.Area })),            { ssr: false });
const BarChart        = dynamic(() => import("recharts").then(m => ({ default: m.BarChart })),        { ssr: false });
const Bar             = dynamic(() => import("recharts").then(m => ({ default: m.Bar })),             { ssr: false });
const XAxis           = dynamic(() => import("recharts").then(m => ({ default: m.XAxis })),           { ssr: false });
const YAxis           = dynamic(() => import("recharts").then(m => ({ default: m.YAxis })),           { ssr: false });
const CartesianGrid   = dynamic(() => import("recharts").then(m => ({ default: m.CartesianGrid })),   { ssr: false });
const Tooltip         = dynamic(() => import("recharts").then(m => ({ default: m.Tooltip })),         { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then(m => ({ default: m.ResponsiveContainer })), { ssr: false });

const GenderPieChart = dynamic(() => import("@/components/charts/GenderPieChart"), { ssr: false });
const ConsultationTypesChart = dynamic(() => import("@/components/charts/ConsultationTypesChart"), { ssr: false });

interface AnalyticsData {
  kpi: {
    avgPerDay: number;
    completionRate: number;
    newPatientsMonth: number;
    monthlyRevenue: number;
    activePatients: number;
    inactivePatients: number;
    totalPatients: number;
  };
  genderData: { name: string; value: number; pct: number }[];
  ageGroups: { age: string; count: number }[];
  peakHours: { hour: string; patients: number }[];
  consultationTypes: { type: string; count: number }[];
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl p-2.5 text-xs shadow-lg">
      {label && <p className="font-semibold mb-1 text-foreground">{label}</p>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color || p.fill }} />
          <span className="text-muted-foreground">{p.name}: <strong className="text-foreground">{p.value}</strong></span>
        </div>
      ))}
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-4 animate-pulse">
      <div className="h-3 w-24 bg-muted rounded mb-3" />
      <div className="h-7 w-16 bg-muted rounded mb-2" />
      <div className="h-2 w-20 bg-muted rounded" />
    </div>
  );
}

function NoData({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
      <p className="text-sm">{label}</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<"1d" | "1w" | "1m" | "6m">("1d");

  const { data: chartData, isLoading: chartLoading } = useQuery({
    queryKey: ["analytics-chart", period],
    queryFn: async () => {
      const r = await api.get(`/analytics/chart?period=${period}`);
      return r.data.data as { label: string; rdv: number; revenue: number }[];
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery<AnalyticsData>({
    queryKey: ["analytics"],
    queryFn: async () => { const r = await api.get("/analytics"); return r.data; },
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const kpi = analytics?.kpi;

  const KPI_CARDS = [
    {
      label: "RDV / jour moyen",
      value: kpi ? (kpi.avgPerDay > 0 ? `${kpi.avgPerDay} RDV/j` : "—") : "—",
      sub: "30 derniers jours",
      icon: Calendar,
      color: "gradient-primary",
    },
    { label: "Taux de complétion", value: kpi ? `${kpi.completionRate}%` : "—", sub: "consultations terminées", icon: CheckCircle, color: "gradient-success" },
    { label: "Nouveaux patients", value: kpi ? `${kpi.newPatientsMonth}` : "—", sub: "ce mois", icon: Users, color: "gradient-warning" },
    { label: "Revenus du mois", value: kpi ? (kpi.monthlyRevenue > 0 ? `${kpi.monthlyRevenue.toLocaleString("fr-MA")} MAD` : "0 MAD") : "—", sub: "total encaissé", icon: CreditCard, color: "gradient-purple" },
  ];

  return (
    <div className="flex flex-col h-full">
      <Header title="Analytique" subtitle="Statistiques et tendances de votre cabinet" />

      <div className="flex-1 overflow-auto custom-scroll p-6 space-y-5">

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {analyticsLoading
            ? Array(4).fill(null).map((_, i) => <KpiSkeleton key={i} />)
            : KPI_CARDS.map(({ label, value, sub, icon: Icon, color }) => (
              <div key={label} className="bg-card border border-border rounded-xl p-4 relative overflow-hidden">
                <div className={cn("absolute -top-4 -right-4 w-16 h-16 rounded-full opacity-15 blur-lg", color)} />
                <div className="relative flex items-start justify-between">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
                    <p className="text-xl font-bold text-foreground mt-1">{value}</p>
                    <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" /> {sub}
                    </p>
                  </div>
                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", color)}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                </div>
              </div>
            ))
          }
        </div>

        {kpi && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Total patients", value: kpi.totalPatients,   color: "text-foreground",       bg: "bg-muted/30" },
              { label: "Actifs",         value: kpi.activePatients,   color: "text-emerald-600",      bg: "bg-emerald-50 dark:bg-emerald-950/30" },
              { label: "Inactifs",       value: kpi.inactivePatients, color: "text-muted-foreground", bg: "bg-muted/20" },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={cn("rounded-xl px-5 py-3 border border-border flex items-center gap-3", bg)}>
                <p className={cn("text-2xl font-bold", color)}>{value}</p>
                <p className="text-sm text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {chartLoading || analyticsLoading ? (
            <>
              <div className="lg:col-span-2"><ChartSkeleton height={220} /></div>
              <ChartSkeleton height={220} />
            </>
          ) : (
            <>
              <div className="bg-card border border-border rounded-xl p-5 lg:col-span-2">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-foreground">Évolution des revenus & rendez-vous</h3>
                </div>
                <div className="flex items-center gap-1 bg-muted/40 rounded-xl p-1 mb-4">
                  {(["1d", "1w", "1m", "6m"] as const).map(p => (
                    <button key={p} onClick={() => setPeriod(p)} className={cn(
                      "flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all",
                      period === p ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}>
                      {p === "1d" ? "Aujourd'hui" : p === "1w" ? "7 jours" : p === "1m" ? "30 jours" : "6 mois"}
                    </button>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={chartData || []} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6272f5" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#6272f5" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradAppts" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#43e97b" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#43e97b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="rdv" stroke="#43e97b" strokeWidth={2} fill="url(#gradAppts)" name="RDV" />
                    <Area type="monotone" dataKey="revenue" stroke="#6272f5" strokeWidth={2.5} fill="url(#gradRevenue)" name="Revenus (MAD)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-card border border-border rounded-xl p-5">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-foreground">Répartition par genre</h3>
                  <p className="text-xs text-muted-foreground">Tous les patients</p>
                </div>
                {(analytics?.genderData?.length ?? 0) === 0 ? (
                  <div className="h-40 flex items-center justify-center">
                    <NoData label="Aucune donnée" />
                  </div>
                ) : (
                  <GenderPieChart data={analytics!.genderData} />
                )}
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-foreground">Heures de pointe</h3>
              <p className="text-xs text-muted-foreground">Rendez-vous par heure (30 derniers jours)</p>
            </div>
            {analyticsLoading ? <ChartSkeleton height={180} /> : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={analytics?.peakHours || []} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} vertical={false} />
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="patients" fill="#6272f5" radius={[4, 4, 0, 0]} name="Patients" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-foreground">Tranches d&apos;âge</h3>
              <p className="text-xs text-muted-foreground">Distribution des patients</p>
            </div>
            {analyticsLoading ? <ChartSkeleton height={180} /> : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={analytics?.ageGroups || []} layout="vertical" margin={{ top: 0, right: 0, left: -5, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis dataKey="age" type="category" width={40} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" fill="#43e97b" radius={[0, 4, 4, 0]} name="Patients" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-foreground">Types de consultation</h3>
            <p className="text-xs text-muted-foreground">Répartition des rendez-vous (30 derniers jours)</p>
          </div>
          {analyticsLoading ? <ChartSkeleton height={180} /> : (
            (analytics?.consultationTypes?.length ?? 0) === 0 ? (
              <div className="h-[180px] flex items-center justify-center">
                <NoData label="Aucun rendez-vous ces 30 derniers jours" />
              </div>
            ) : (
              <ConsultationTypesChart data={analytics!.consultationTypes} />
            )
          )}
        </div>

      </div>
    </div>
  );
}
