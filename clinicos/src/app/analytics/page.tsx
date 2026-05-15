"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { TrendingUp, Users, Calendar, CreditCard, CheckCircle, BarChart2, AreaChart as AreaIcon, LineChart as LineIcon, Stethoscope, FileText, Clock, Activity, X, Phone, AlertCircle, ChevronRight } from "lucide-react";
import Header from "@/components/layout/Header";
import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";
import { cn } from "@/lib/utils";
import { ChartSkeleton } from "@/components/ui/skeleton";
import { useLang } from "@/lib/i18n";

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
const ResponsiveContainer = dynamic(() => import("recharts").then(m => ({ default: m.ResponsiveContainer })), { ssr: false });

const GenderPieChart = dynamic(() => import("@/components/charts/GenderPieChart"), { ssr: false });
const ConsultationTypesChart = dynamic(() => import("@/components/charts/ConsultationTypesChart"), { ssr: false });

type StatPeriod = "day" | "week" | "month";

type DrillType = "consultations" | "patients" | "prescriptions" | "invoices" | "invoices_unpaid" | "invoices_partial" | "invoices_paid" | "rdv_confirmed" | "rdv_completed" | "rdv_pending" | "rdv_cancelled" | "rdv_all";

interface SummaryData {
  period: string;
  consultations: number;
  patients: number;
  prescriptions: number;
  invoices: number;
  unpaidCount: number;
  partialCount: number;
  unpaidAmount: number;
  partialAmount: number;
  revenue: number;
  totalAppointments: number;
  byStatus: { confirmed: number; completed: number; pending: number; cancelled: number };
  todayByStatus: { confirmed: number; completed: number; pending: number; cancelled: number };
  waitingRoom: number;
}

interface DrillItem {
  id: string;
  patientName: string;
  patientPhone?: string;
  date?: string;
  time?: string;
  type?: string;
  status?: string;
  diagnosis?: string;
  medications?: string;
  invoiceNumber?: string;
  total?: number;
  paid?: number;
  remaining?: number;
  gender?: string;
}

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

function StatCard({ label, value, max, icon: Icon, color, isDE, onClick, sub }: {
  label: string; value: number | string; max: number; icon: any; color: string; isDE: boolean;
  onClick?: () => void; sub?: string;
}) {
  const numVal = typeof value === "number" ? value : 0;
  const pct = Math.min(Math.round((numVal / max) * 100), 100);
  return (
    <button
      onClick={onClick}
      className={cn(
        "bg-card border border-border rounded-xl p-4 text-left transition-all",
        onClick && "hover:shadow-md hover:border-primary/30 cursor-pointer group"
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", color)}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-2xl font-bold text-foreground">{value}</span>
          {onClick && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />}
        </div>
      </div>
      <p className="text-xs font-semibold text-foreground mb-2">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground mb-1.5">{sub}</p>}
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-500", color)} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] text-muted-foreground mt-1">{pct}% {isDE ? "des Monatsziels" : "de l'objectif mensuel"}</p>
    </button>
  );
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  completed: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  pending:   "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  unpaid:    "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  partial:   "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  paid:      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
};

function translateStatus(status: string, isDE: boolean): string {
  const map: Record<string, { fr: string; de: string }> = {
    confirmed: { fr: "Confirmé",   de: "Bestätigt" },
    completed: { fr: "Terminé",    de: "Abgeschlossen" },
    pending:   { fr: "En attente", de: "Ausstehend" },
    cancelled: { fr: "Annulé",     de: "Abgesagt" },
    unpaid:    { fr: "Impayé",     de: "Unbezahlt" },
    partial:   { fr: "Partiel",    de: "Teilweise" },
    paid:      { fr: "Payé",       de: "Bezahlt" },
    overdue:   { fr: "En retard",  de: "Überfällig" },
    active:    { fr: "Actif",      de: "Aktiv" },
    inactive:  { fr: "Inactif",    de: "Inaktiv" },
    expired:   { fr: "Expiré",     de: "Abgelaufen" },
  };
  return map[status]?.[isDE ? "de" : "fr"] ?? status;
}

function DrillDrawer({ type, period, isDE, onClose }: {
  type: DrillType; period: string; isDE: boolean; onClose: () => void;
}) {
  const { data, isLoading } = useQuery<DrillItem[]>({
    queryKey: ["drilldown", type, period],
    queryFn: async () => {
      const r = await api.get(`/analytics/drilldown?type=${type}&period=${period}`);
      return r.data.data ?? r.data ?? [];
    },
    staleTime: 30_000,
  });

  const TITLES: Record<DrillType, { fr: string; de: string }> = {
    consultations:    { fr: "Consultations terminées",          de: "Abgeschlossene Konsultationen" },
    patients:         { fr: "Patients traités",                  de: "Behandelte Patienten" },
    prescriptions:    { fr: "Ordonnances",                       de: "Rezepte" },
    invoices:         { fr: "Toutes les factures",               de: "Alle Rechnungen" },
    invoices_unpaid:  { fr: "Factures impayées",                 de: "Unbezahlte Rechnungen" },
    invoices_partial: { fr: "Factures partiellement payées",     de: "Teilweise bezahlte Rechnungen" },
    invoices_paid:    { fr: "Factures payées (revenus)",         de: "Bezahlte Rechnungen (Einnahmen)" },
    rdv_confirmed:    { fr: "Rendez-vous confirmés",             de: "Bestätigte Termine" },
    rdv_completed:    { fr: "Rendez-vous terminés",              de: "Abgeschlossene Termine" },
    rdv_pending:      { fr: "Rendez-vous en attente",            de: "Ausstehende Termine" },
    rdv_cancelled:    { fr: "Rendez-vous annulés",               de: "Abgesagte Termine" },
    rdv_all:          { fr: "Tous les rendez-vous",              de: "Alle Termine" },
  };
  const title = isDE ? TITLES[type].de : TITLES[type].fr;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full z-50 w-full max-w-md bg-background border-l border-border shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <h2 className="font-bold text-sm text-foreground">{title}</h2>
          <div className="flex items-center gap-2">
            {!isLoading && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {data?.length ?? 0} {isDE ? "Einträge" : "résultats"}
              </span>
            )}
            <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading ? (
            Array(6).fill(null).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse">
                <div className="h-3 w-32 bg-muted rounded mb-2" />
                <div className="h-2 w-48 bg-muted rounded" />
              </div>
            ))
          ) : !data?.length ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
              <AlertCircle className="w-8 h-8 opacity-30" />
              <p className="text-sm">{isDE ? "Keine Einträge" : "Aucun résultat"}</p>
            </div>
          ) : (
            data.map((item, i) => (
              <div key={item.id ?? i} className="bg-card border border-border rounded-xl p-3.5 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-sm text-foreground">{item.patientName}</p>
                  <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                    {item.invoiceNumber && (
                      <span className="text-[10px] text-muted-foreground">{item.invoiceNumber}</span>
                    )}
                    {item.status && (
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", STATUS_COLORS[item.status] ?? "bg-muted text-muted-foreground")}>
                        {translateStatus(item.status, isDE)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {item.patientPhone && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Phone className="w-3 h-3" />{item.patientPhone}
                    </span>
                  )}
                  {item.date && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Calendar className="w-3 h-3" />{item.date}{item.time && ` · ${item.time}`}
                    </span>
                  )}
                  {item.type && <span className="text-[11px] text-muted-foreground">{item.type}</span>}
                  {item.gender && (
                    <span className="text-[11px] text-muted-foreground">
                      {item.gender === "male"   ? (isDE ? "Mann"   : "Homme") :
                       item.gender === "female" ? (isDE ? "Frau"   : "Femme") : item.gender}
                    </span>
                  )}
                </div>

                {item.diagnosis && (
                  <p className="text-[11px] text-muted-foreground italic">{item.diagnosis}</p>
                )}
                {item.medications && (
                  <p className="text-[11px] text-foreground/70">{item.medications}</p>
                )}
                {item.total !== undefined && (
                  <div className="flex flex-wrap items-center gap-3 text-[11px] pt-0.5">
                    <span className="text-muted-foreground">
                      {isDE ? "Gesamt" : "Total"}: <strong>{item.total?.toLocaleString("fr-MA")} MAD</strong>
                    </span>
                    {(item.paid ?? 0) > 0 && (
                      <span className="text-emerald-600">
                        {isDE ? "Bezahlt" : "Payé"}: {item.paid?.toLocaleString("fr-MA")} MAD
                      </span>
                    )}
                    {(item.remaining ?? 0) > 0 && (
                      <span className="text-red-500 font-semibold">
                        {isDE ? "Offen" : "Reste"}: {item.remaining?.toLocaleString("fr-MA")} MAD
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

export default function AnalyticsPage() {
  const { lang, t } = useLang();
  const isDE = lang === "de";
  const [statPeriod, setStatPeriod] = useState<StatPeriod>("month");
  const [drillType, setDrillType]  = useState<DrillType | null>(null);
  const [period,    setPeriod]    = useState<"1d" | "1w" | "1m" | "6m">("1d");
  const [chartType, setChartType] = useState<"bar" | "area" | "line">("bar");

  const { data: summary, isLoading: summaryLoading } = useQuery<SummaryData>({
    queryKey: ["analytics-summary", statPeriod],
    queryFn: async () => {
      const r = await api.get(`/analytics/summary?period=${statPeriod}`);
      return r.data.data ?? r.data;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

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

  const STAT_PERIODS: { key: StatPeriod; label: string; labelDE: string }[] = [
    { key: "day",   label: "Aujourd'hui",   labelDE: "Heute" },
    { key: "week",  label: "Cette semaine", labelDE: "Diese Woche" },
    { key: "month", label: "Ce mois",       labelDE: "Dieser Monat" },
  ];

  const BY_STATUS_BARS = [
    { key: "confirmed", label: isDE ? "Bestätigt"     : "Confirmé",  color: "#10b981" },
    { key: "completed", label: isDE ? "Abgeschlossen" : "Terminé",   color: "#6272f5" },
    { key: "pending",   label: isDE ? "Ausstehend"    : "En attente",color: "#f59e0b" },
    { key: "cancelled", label: isDE ? "Abgesagt"      : "Annulé",    color: "#ef4444" },
  ];

  const KPI_CARDS = [
    {
      label: t("analytics.kpi.avgPerDay"),
      value: kpi ? (kpi.avgPerDay > 0 ? `${kpi.avgPerDay} RDV/j` : "—") : "—",
      sub: t("analytics.kpi.lastThirty"),
      icon: Calendar,
      color: "gradient-primary",
    },
    { label: t("analytics.kpi.completion"), value: kpi ? `${kpi.completionRate}%` : "—", sub: t("analytics.kpi.completed"), icon: CheckCircle, color: "gradient-success" },
    { label: t("analytics.kpi.newPatients"), value: kpi ? `${kpi.newPatientsMonth}` : "—", sub: t("analytics.kpi.thisMonth"), icon: Users, color: "gradient-warning" },
    { label: t("analytics.kpi.revenue"), value: kpi ? (kpi.monthlyRevenue > 0 ? `${kpi.monthlyRevenue.toLocaleString("fr-MA")} MAD` : "0 MAD") : "—", sub: t("analytics.kpi.collected"), icon: CreditCard, color: "gradient-purple" },
  ];

  return (
    <div className="flex flex-col h-full">
      <Header title={t("analytics.title")} subtitle={t("analytics.subtitle")} />

      <div className="flex-1 overflow-auto custom-scroll p-6 space-y-5">

        {/* ── Stats section with period filter ── */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          {/* Period tabs */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-bold text-foreground">
                {isDE ? "Statistiken" : "Statistiques"}
              </h2>
            </div>
            <div className="flex gap-1 bg-muted/50 rounded-xl p-1">
              {STAT_PERIODS.map(p => (
                <button key={p.key} onClick={() => setStatPeriod(p.key)}
                  className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                    statPeriod === p.key ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                  {isDE ? p.labelDE : p.label}
                </button>
              ))}
            </div>
          </div>

          {/* 4 main stat cards */}
          {summaryLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {Array(4).fill(null).map((_, i) => <KpiSkeleton key={i} />)}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard label={isDE ? "Konsultationen" : "Consultations"} value={summary?.consultations ?? 0} max={statPeriod === "day" ? 30 : statPeriod === "week" ? 150 : 500} icon={Stethoscope} color="bg-primary" isDE={isDE} onClick={() => setDrillType("consultations")} />
                <StatCard label={isDE ? "Behandelte Patienten" : "Patients traités"} value={summary?.patients ?? 0} max={statPeriod === "day" ? 30 : statPeriod === "week" ? 150 : 500} icon={Users} color="bg-emerald-500" isDE={isDE} onClick={() => setDrillType("patients")} />
                <StatCard label={isDE ? "Rezepte" : "Ordonnances"} value={summary?.prescriptions ?? 0} max={statPeriod === "day" ? 20 : statPeriod === "week" ? 100 : 300} icon={FileText} color="bg-amber-500" isDE={isDE} onClick={() => setDrillType("prescriptions")} />
                <StatCard label={isDE ? "Rechnungen" : "Factures"} value={summary?.invoices ?? 0} max={statPeriod === "day" ? 20 : statPeriod === "week" ? 100 : 300} icon={CreditCard} color="bg-purple-500" isDE={isDE} onClick={() => setDrillType("invoices")} />
              </div>

              {/* Unpaid / Partial invoice cards */}
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setDrillType("invoices_unpaid")}
                  className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-xl p-3.5 text-left hover:shadow-md transition-all group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-500" />
                      <span className="text-xs font-semibold text-red-700 dark:text-red-400">{isDE ? "Unbezahlt" : "Impayées"}</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-red-400 group-hover:text-red-600 transition-colors" />
                  </div>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-xl font-bold text-red-600">{(summary?.unpaidAmount ?? 0).toLocaleString("fr-MA")}</span>
                    <span className="text-xs text-red-500">MAD</span>
                    <span className="text-[10px] text-red-400 ml-auto">{summary?.unpaidCount ?? 0} {isDE ? "Rechnungen" : "factures"}</span>
                  </div>
                </button>

                <button onClick={() => setDrillType("invoices_partial")}
                  className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 rounded-xl p-3.5 text-left hover:shadow-md transition-all group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-orange-500" />
                      <span className="text-xs font-semibold text-orange-700 dark:text-orange-400">{isDE ? "Teilweise bezahlt" : "Partiellement payées"}</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-orange-400 group-hover:text-orange-600 transition-colors" />
                  </div>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-xl font-bold text-orange-600">{(summary?.partialAmount ?? 0).toLocaleString("fr-MA")}</span>
                    <span className="text-xs text-orange-500">MAD</span>
                    <span className="text-[10px] text-orange-400 ml-auto">{summary?.partialCount ?? 0} {isDE ? "Rechnungen" : "factures"}</span>
                  </div>
                </button>
              </div>
            </>
          )}

          {/* Activity overview */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: isDE ? "RDV gesamt" : "RDV total", value: summary?.totalAppointments ?? 0, unit: isDE ? "Termine" : "rendez-vous", color: "text-primary", drill: "rdv_all" as DrillType },
              { label: isDE ? "Einnahmen" : "Revenus", value: `${(summary?.revenue ?? 0).toLocaleString("fr-MA")}`, unit: "MAD", color: "text-emerald-600", drill: "invoices_paid" as DrillType },
              { label: isDE ? "Im Wartezimmer" : "Salle d'attente", value: summary?.waitingRoom ?? 0, unit: isDE ? "Patienten" : "patients", color: "text-amber-600", drill: null },
            ].map(item => (
              <button key={item.label}
                onClick={() => item.drill && setDrillType(item.drill)}
                className={cn("bg-muted/30 rounded-xl px-4 py-3 text-center transition-all", item.drill && "hover:shadow-md hover:bg-muted/50 cursor-pointer group")}>
                <p className={cn("text-2xl font-bold", item.color)}>{item.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{item.unit}</p>
                <p className="text-[11px] text-muted-foreground font-medium mt-1">{item.label}</p>
                {item.drill && <p className="text-[9px] text-muted-foreground/50 mt-0.5 group-hover:text-primary transition-colors">{isDE ? "↗ Details" : "↗ voir la liste"}</p>}
              </button>
            ))}
          </div>

          {/* RDV par statut */}
          <div>
            <p className="text-xs font-semibold text-foreground mb-3">
              {isDE ? "RDV nach Status" : "RDV par statut"}
              <span className="ml-2 text-[10px] font-normal text-muted-foreground">{isDE ? "— klicken für Details" : "— cliquer pour voir la liste"}</span>
            </p>
            <div className="space-y-2">
              {BY_STATUS_BARS.map(({ key, label, color }) => {
                const val = summary?.byStatus?.[key as keyof typeof summary.byStatus] ?? 0;
                const total = summary?.totalAppointments || 1;
                const pct = Math.round((val / total) * 100);
                const drillKey = `rdv_${key}` as DrillType;
                return (
                  <button key={key} onClick={() => val > 0 && setDrillType(drillKey)}
                    className={cn("w-full flex items-center gap-3 rounded-lg px-1 py-1 transition-colors text-left", val > 0 && "hover:bg-muted/50 cursor-pointer")}>
                    <span className="text-[11px] font-medium text-muted-foreground w-24 text-right flex-shrink-0">{label}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <span className="text-xs font-bold text-foreground w-6 text-right flex-shrink-0">{val}</span>
                    {val > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground/40 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

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
              { label: t("analytics.patients.total"),    value: kpi.totalPatients,   color: "text-foreground",       bg: "bg-muted/30" },
              { label: t("analytics.patients.active"),   value: kpi.activePatients,   color: "text-emerald-600",      bg: "bg-emerald-50 dark:bg-emerald-950/30" },
              { label: t("analytics.patients.inactive"), value: kpi.inactivePatients, color: "text-muted-foreground", bg: "bg-muted/20" },
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
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-foreground">{t("analytics.revenueChart")}</h3>
                  <div className="flex items-center gap-0.5 bg-muted/40 rounded-lg p-0.5">
                    {([
                      { type: "bar",  Icon: BarChart2, titleKey: "analytics.columns" },
                      { type: "area", Icon: AreaIcon,  titleKey: "analytics.areas" },
                      { type: "line", Icon: LineIcon,  titleKey: "analytics.lines" },
                    ] as const).map(({ type, Icon, titleKey }) => (
                      <button key={type} onClick={() => setChartType(type)} title={t(titleKey)}
                        className={cn("w-7 h-7 flex items-center justify-center rounded-md transition-all",
                          chartType === type ? "bg-card shadow-sm text-primary" : "text-muted-foreground hover:text-foreground")}>
                        <Icon className="w-3.5 h-3.5" />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1 bg-muted/40 rounded-xl p-1 mb-3">
                  {(["1d", "1w", "1m", "6m"] as const).map(p => (
                    <button key={p} onClick={() => setPeriod(p)} className={cn(
                      "flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all",
                      period === p ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}>
                      {p === "1d" ? t("analytics.chart.today") : p === "1w" ? t("analytics.chart.sevenDays") : p === "1m" ? t("analytics.chart.thirtyDays") : t("analytics.chart.sixMonths")}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#43e97b]" /><span className="text-xs text-muted-foreground">{t("analytics.rdv")}</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#6272f5]" /><span className="text-xs text-muted-foreground">{t("analytics.revenue")}</span></div>
                </div>
                {chartType === "bar" ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData || []} margin={{ top: 5, right: 35, left: -20, bottom: 0 }} barGap={3} barCategoryGap="35%">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="rev" orientation="left"  tick={{ fontSize: 10, fill: "#6272f5" }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="rdv" orientation="right" tick={{ fontSize: 10, fill: "#43e97b" }} axisLine={false} tickLine={false} tickCount={5} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.3 }} />
                      <Bar yAxisId="rev" dataKey="revenue" fill="#6272f5" name={t("analytics.revenue")} radius={[4, 4, 0, 0]} maxBarSize={28} />
                      <Bar yAxisId="rdv" dataKey="rdv"     fill="#43e97b" name={t("analytics.rdv")}     radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : chartType === "area" ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={chartData || []} margin={{ top: 5, right: 35, left: -20, bottom: 0 }}>
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
                      <YAxis yAxisId="rev" orientation="left"  tick={{ fontSize: 10, fill: "#6272f5" }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="rdv" orientation="right" tick={{ fontSize: 10, fill: "#43e97b" }} axisLine={false} tickLine={false} tickCount={5} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area yAxisId="rev" type="monotone" dataKey="revenue" stroke="#6272f5" strokeWidth={2.5} fill="url(#gradRevenue)" name={t("analytics.revenue")} dot={false} />
                      <Area yAxisId="rdv" type="monotone" dataKey="rdv"     stroke="#43e97b" strokeWidth={2}   fill="url(#gradAppts)"   name={t("analytics.rdv")}     dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={chartData || []} margin={{ top: 5, right: 35, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="rev" orientation="left"  tick={{ fontSize: 10, fill: "#6272f5" }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="rdv" orientation="right" tick={{ fontSize: 10, fill: "#43e97b" }} axisLine={false} tickLine={false} tickCount={5} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line yAxisId="rev" type="monotone" dataKey="revenue" stroke="#6272f5" strokeWidth={2.5} name={t("analytics.revenue")} dot={{ r: 3, fill: "#6272f5" }} activeDot={{ r: 5 }} />
                      <Line yAxisId="rdv" type="monotone" dataKey="rdv"     stroke="#43e97b" strokeWidth={2}   name={t("analytics.rdv")}     dot={{ r: 3, fill: "#43e97b" }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="bg-card border border-border rounded-xl p-5">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-foreground">{t("analytics.gender.title")}</h3>
                  <p className="text-xs text-muted-foreground">{t("analytics.gender.all")}</p>
                </div>
                {(analytics?.genderData?.length ?? 0) === 0 ? (
                  <div className="h-40 flex items-center justify-center">
                    <NoData label={t("analytics.noData")} />
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
              <h3 className="text-sm font-semibold text-foreground">{t("analytics.peakHours.title")}</h3>
              <p className="text-xs text-muted-foreground">{t("analytics.peakHours.subtitle")}</p>
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
              <h3 className="text-sm font-semibold text-foreground">{t("analytics.age.title")}</h3>
              <p className="text-xs text-muted-foreground">{t("analytics.age.subtitle")}</p>
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
            <h3 className="text-sm font-semibold text-foreground">{t("analytics.consultationTypes.title")}</h3>
            <p className="text-xs text-muted-foreground">{t("analytics.consultationTypes.subtitleFull")}</p>
          </div>
          {analyticsLoading ? <ChartSkeleton height={180} /> : (
            (analytics?.consultationTypes?.length ?? 0) === 0 ? (
              <div className="h-[180px] flex items-center justify-center">
                <NoData label={t("analytics.noAppointments30")} />
              </div>
            ) : (
              <ConsultationTypesChart data={analytics!.consultationTypes} />
            )
          )}
        </div>

      </div>

      {/* Drill-down drawer */}
      {drillType && (
        <DrillDrawer
          type={drillType}
          period={statPeriod}
          isDE={isDE}
          onClose={() => setDrillType(null)}
        />
      )}
    </div>
  );
}
