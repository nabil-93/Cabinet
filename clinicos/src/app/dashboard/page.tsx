"use client";

import { Users, Calendar, CreditCard, Clock, TrendingUp, ArrowUpRight, ChevronRight, Plus, BarChart2, AreaChart as AreaIcon, LineChart as LineIcon } from "lucide-react";
import dynamic from "next/dynamic";
const AreaChart    = dynamic(() => import("recharts").then(m => ({ default: m.AreaChart })),    { ssr: false });
const Area         = dynamic(() => import("recharts").then(m => ({ default: m.Area })),         { ssr: false });
const BarChart     = dynamic(() => import("recharts").then(m => ({ default: m.BarChart })),     { ssr: false });
const Bar          = dynamic(() => import("recharts").then(m => ({ default: m.Bar })),          { ssr: false });
const LineChart    = dynamic(() => import("recharts").then(m => ({ default: m.LineChart })),    { ssr: false });
const Line         = dynamic(() => import("recharts").then(m => ({ default: m.Line })),         { ssr: false });
const XAxis        = dynamic(() => import("recharts").then(m => ({ default: m.XAxis })),        { ssr: false });
const YAxis        = dynamic(() => import("recharts").then(m => ({ default: m.YAxis })),        { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then(m => ({ default: m.CartesianGrid })), { ssr: false });
const Tooltip      = dynamic(() => import("recharts").then(m => ({ default: m.Tooltip })),      { ssr: false });
const Legend       = dynamic(() => import("recharts").then(m => ({ default: m.Legend })),       { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then(m => ({ default: m.ResponsiveContainer })), { ssr: false });
import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import StatCard from "@/components/dashboard/StatCard";
import { StatCardSkeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/ui/EmptyState";
import { useStore } from "@/store";
import { useAuth } from "@/lib/auth-context";
import { useDashboardStats } from "@/hooks/useDashboard";
import { useAppointmentsByDate } from "@/hooks/useAppointments";
import { usePatients } from "@/hooks/usePatients";
import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";
import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
  confirmed: { label: "Confirmé", className: "badge-confirmed" },
  pending:   { label: "En attente", className: "badge-pending" },
  cancelled: { label: "Annulé", className: "badge-cancelled" },
  completed: { label: "Terminé", className: "badge-completed" },
};

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl p-3 text-xs shadow-sm">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 mt-0.5">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { theme } = useStore();
  const { user } = useAuth();
  const [chartPeriod, setChartPeriod] = useState<"1d" | "1w" | "1m" | "6m">("1d");
  const [chartType,   setChartType]   = useState<"bar" | "area" | "line">("bar");

  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: chartData, isLoading: chartLoading } = useQuery({
    queryKey: ["analytics-chart", chartPeriod],
    queryFn: async () => {
      const r = await api.get(`/analytics/chart?period=${chartPeriod}`);
      return r.data.data as { label: string; rdv: number; revenue: number }[];
    },
    staleTime: 30_000,
  });
  const today = new Date().toISOString().split("T")[0];
  const { data: appointments = [], isLoading: aptsLoading } = useAppointmentsByDate(today);
  const { data: patients = [], isLoading: patientsLoading } = usePatients(undefined, 5);

  const todayApts = appointments.slice(0, 5);
  const recentPatients = patients.slice(0, 5);
  const hasChartData = chartData && chartData.some(d => d.revenue > 0 || d.rdv > 0);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  return (
    <div className="flex flex-col h-full">
      <Header title="Tableau de bord" subtitle={format(new Date(), "EEEE d MMMM yyyy", { locale: fr })} />

      <div className="flex-1 overflow-auto custom-scroll p-6 space-y-6">
        {/* Welcome */}
        <div className="bg-card border border-border rounded-xl p-5 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-40 h-40 bg-primary/5 rounded-full pointer-events-none" />
          <div className="relative flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-xs text-muted-foreground">{greeting} 👋</p>
              <h2 className="text-xl font-bold text-foreground mt-0.5">{user?.name || "—"}</h2>
              <p className="text-xs text-muted-foreground mt-1.5 capitalize">{user?.role === "admin" ? "Administrateur" : user?.role === "doctor" ? "Médecin" : "Secrétaire"}</p>
            </div>
            {!statsLoading && stats && (stats.totalPatients > 0 || stats.todayAppointments > 0) && (
              <div className="text-right text-xs text-muted-foreground space-y-1">
                <div className="flex items-center gap-2 justify-end">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Système opérationnel</span>
                </div>
                <p>{stats.completedToday} consultations aujourd&apos;hui</p>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statsLoading ? (
            Array(4).fill(null).map((_, i) => <StatCardSkeleton key={i} />)
          ) : (
            <>
              <StatCard title="Total Patients" value={stats?.totalPatients ?? 0} icon={Users} gradient="gradient-primary" delay={0.05} />
              <StatCard title="RDV Aujourd'hui" value={stats?.todayAppointments ?? 0} icon={Calendar} gradient="gradient-success" delay={0.1} />
              <StatCard title="Revenus du Mois" value={stats?.monthlyRevenue ?? 0} icon={CreditCard} gradient="gradient-warning" suffix=" MAD" delay={0.15} />
              <StatCard title="Salle d'Attente" value={stats?.waitingRoom ?? 0} icon={Clock} gradient="gradient-danger" delay={0.2} />
            </>
          )}
        </div>

        {/* Charts */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground text-sm">Revenus & Rendez-vous</h3>
            <div className="flex items-center gap-2">
              {/* Chart type switcher */}
              <div className="flex items-center gap-0.5 bg-muted/40 rounded-lg p-0.5">
                {([
                  { type: "bar",  Icon: BarChart2,  title: "Colonnes" },
                  { type: "area", Icon: AreaIcon,   title: "Aires" },
                  { type: "line", Icon: LineIcon,   title: "Lignes" },
                ] as const).map(({ type, Icon, title }) => (
                  <button key={type} onClick={() => setChartType(type)} title={title}
                    className={cn("w-7 h-7 flex items-center justify-center rounded-md transition-all",
                      chartType === type ? "bg-card shadow-sm text-primary" : "text-muted-foreground hover:text-foreground")}>
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
              <Link href="/analytics" className="text-xs text-primary hover:underline flex items-center gap-1 font-medium">
                Analytique <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-muted/40 rounded-xl p-1 mb-4">
            {(["1d", "1w", "1m", "6m"] as const).map(p => (
              <button key={p} onClick={() => setChartPeriod(p)} className={cn(
                "flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all",
                chartPeriod === p ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}>
                {p === "1d" ? "Aujourd'hui" : p === "1w" ? "7 jours" : p === "1m" ? "30 jours" : "6 mois"}
              </button>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mb-3">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#43e97b]" /><span className="text-xs text-muted-foreground">RDV</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#6272f5]" /><span className="text-xs text-muted-foreground">Revenus (MAD)</span></div>
          </div>

          {chartLoading ? (
            <div className="h-[200px] animate-pulse bg-muted/30 rounded-xl" />
          ) : !hasChartData ? (
            <div className="h-[200px] flex items-center justify-center border-2 border-dashed border-border/50 rounded-xl">
              <div className="text-center">
                <TrendingUp className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground/60">Aucune donnée disponible</p>
              </div>
            </div>
          ) : chartType === "bar" ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }} barGap={2} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.3 }} />
                <Bar dataKey="rdv" fill="#43e97b" name="RDV" radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Bar dataKey="revenue" fill="#6272f5" name="Revenus (MAD)" radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          ) : chartType === "area" ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6272f5" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6272f5" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#43e97b" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#43e97b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="rdv" stroke="#43e97b" strokeWidth={2} fill="url(#gA)" name="RDV" dot={false} />
                <Area type="monotone" dataKey="revenue" stroke="#6272f5" strokeWidth={2.5} fill="url(#gR)" name="Revenus (MAD)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="rdv" stroke="#43e97b" strokeWidth={2} name="RDV" dot={{ r: 3, fill: "#43e97b" }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="revenue" stroke="#6272f5" strokeWidth={2.5} name="Revenus (MAD)" dot={{ r: 3, fill: "#6272f5" }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* RDV + Patients */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Today's appointments */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-foreground text-sm">RDV d&apos;aujourd&apos;hui</h3>
                <p className="text-xs text-muted-foreground">{aptsLoading ? "..." : `${todayApts.length} rendez-vous`}</p>
              </div>
              <Link href="/appointments" className="text-xs text-primary hover:underline flex items-center gap-1 font-medium">
                Voir tout <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {aptsLoading ? (
              <div className="space-y-2">{Array(3).fill(null).map((_, i) => <div key={i} className="h-12 rounded-xl bg-muted animate-pulse" />)}</div>
            ) : todayApts.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="Aucun rendez-vous aujourd'hui"
                description="Ajoutez votre premier rendez-vous pour commencer"
                action={{ label: "+ Nouveau RDV", onClick: () => router.push("/appointments") }}
                className="py-8"
              />
            ) : (
              <div className="space-y-1.5">
                {todayApts.map((apt, i) => {
                  const sc = STATUS_CONFIG[apt.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
                  return (
                    <div key={apt.id}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-accent/50 transition-all cursor-pointer">
                      <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0 shadow-sm">
                        <span className="text-white font-bold text-[10px]">{apt.patientName?.split(" ").map((w: string) => w[0]).join("").slice(0, 2) || "?"}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{apt.patientName}</p>
                        <p className="text-[10px] text-muted-foreground">{apt.type} · {apt.time}</p>
                      </div>
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", sc.className)}>{sc.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent patients */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-foreground text-sm">Patients récents</h3>
                <p className="text-xs text-muted-foreground">{patientsLoading ? "..." : `${patients.length} inscrits`}</p>
              </div>
              <Link href="/patients" className="text-xs text-primary hover:underline flex items-center gap-1 font-medium">
                Voir tout <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {patientsLoading ? (
              <div className="space-y-2">{Array(4).fill(null).map((_, i) => <div key={i} className="h-10 rounded-xl bg-muted animate-pulse" />)}</div>
            ) : recentPatients.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Aucun patient enregistré"
                description="Ajoutez votre premier patient pour commencer"
                action={{ label: "+ Nouveau patient", onClick: () => router.push("/patients") }}
                className="py-8"
              />
            ) : (
              <div className="space-y-1.5">
                {recentPatients.map((patient, i) => (
                  <Link key={patient.id} href={`/patients/${patient.id}`}>
                    <div
                      className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-accent/50 transition-all cursor-pointer">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-xs text-white"
                        style={{ background: `hsl(${(i * 60 + 220)}deg 65% 55%)` }}>
                        {patient.fullName?.split(" ").map((w: string) => w[0]).join("").slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{patient.fullName}</p>
                        <p className="text-[10px] text-muted-foreground">{patient.gender === "male" ? "Homme" : patient.gender === "female" ? "Femme" : "—"}</p>
                      </div>
                      <div className={cn("w-2 h-2 rounded-full flex-shrink-0", patient.status === "active" ? "bg-emerald-500" : "bg-muted-foreground/40")} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
