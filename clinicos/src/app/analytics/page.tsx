"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { TrendingUp, Users, Calendar, CreditCard, CheckCircle, BarChart2, AreaChart as AreaIcon, LineChart as LineIcon } from "lucide-react";
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
  const { t } = useLang();
  const [period,    setPeriod]    = useState<"1d" | "1w" | "1m" | "6m">("1d");
  const [chartType, setChartType] = useState<"bar" | "area" | "line">("bar");

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
    </div>
  );
}
