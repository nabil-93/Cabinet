"use client";
import { useState, useMemo } from "react";
import {
  Calendar, Plus, Search, Clock, X, RotateCcw, Trash2,
  CalendarDays, ChevronLeft, ChevronRight,
} from "lucide-react";
import {
  format, differenceInCalendarDays, isPast, isToday, isFuture,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  addDays, addWeeks, addMonths, subDays, subWeeks, subMonths,
  isWithinInterval, parseISO,
} from "date-fns";
import { fr } from "date-fns/locale";
import Header from "@/components/layout/Header";
import { TableRowSkeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/ui/EmptyState";
import StatusPicker from "@/components/ui/StatusPicker";
import {
  useAppointments, useCreateAppointment,
  useUpdateAppointmentStatus, useRescheduleAppointment,
  useDeleteAppointment,
} from "@/hooks/useAppointments";
import { usePatients } from "@/hooks/usePatients";
import { cn } from "@/lib/utils";
import type { AppointmentStatus } from "@/types";
import { getToday } from "@/lib/date-utils";
import { useLang } from "@/lib/i18n";

type PeriodFilter = "all" | "today" | "week" | "month" | "custom";
type StatusFilter  = "all" | AppointmentStatus;

const CONSULTATION_TYPES = ["Consultation", "Suivi", "Bilan", "Urgence", "Vaccination", "Contrôle", "Autre"];

// Navigation label selon la période
function getPeriodLabel(period: PeriodFilter, ref: Date): string {
  if (period === "today") return format(ref, "EEEE d MMMM yyyy", { locale: fr });
  if (period === "week") {
    const s = startOfWeek(ref, { weekStartsOn: 1 });
    const e = endOfWeek(ref, { weekStartsOn: 1 });
    return `${format(s, "d MMM", { locale: fr })} – ${format(e, "d MMM yyyy", { locale: fr })}`;
  }
  if (period === "month") return format(ref, "MMMM yyyy", { locale: fr });
  return "";
}

export default function AppointmentsPage() {
  const { t } = useLang();
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter,   setTypeFilter]   = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  const [refDate,      setRefDate]      = useState(new Date());
  const [showAddModal, setShowAddModal] = useState(false);
  const [reportingApt, setReportingApt] = useState<{ id: string; date: string; time: string } | null>(null);
  const [reportDate,   setReportDate]   = useState("");
  const [reportTime,   setReportTime]   = useState("");
  const [form, setForm] = useState({
    patientId: "", date: getToday(),
    time: "09:00", type: "Consultation", notes: "",
  });

  const STATUS_TABS: { value: StatusFilter; label: string }[] = [
    { value: "all",       label: t("appointments.status.all") },
    { value: "confirmed", label: t("appointments.status.confirmed") },
    { value: "pending",   label: t("appointments.status.pending") },
    { value: "completed", label: t("appointments.status.completed") },
    { value: "cancelled", label: t("appointments.status.cancelled") },
  ];

  const PERIOD_TABS: { value: PeriodFilter; label: string; icon: string }[] = [
    { value: "all",   label: t("appointments.period.all"),   icon: "📋" },
    { value: "today", label: t("appointments.period.today"), icon: "📅" },
    { value: "week",  label: t("appointments.period.week"),  icon: "📆" },
    { value: "month", label: t("appointments.period.month"), icon: "🗓️" },
  ];

  const { data: apiApts = [], isLoading } = useAppointments();
  const { data: patients = [] }           = usePatients();
  const createMutation       = useCreateAppointment();
  const updateStatusMutation = useUpdateAppointmentStatus();
  const rescheduleMutation   = useRescheduleAppointment();
  const deleteMutation       = useDeleteAppointment();

  const navigate = (dir: 1 | -1) => {
    if (periodFilter === "today") setRefDate(d => dir === 1 ? addDays(d, 1) : subDays(d, 1));
    if (periodFilter === "week")  setRefDate(d => dir === 1 ? addWeeks(d, 1) : subWeeks(d, 1));
    if (periodFilter === "month") setRefDate(d => dir === 1 ? addMonths(d, 1) : subMonths(d, 1));
  };

  const goToToday = () => setRefDate(new Date());

  const filtered = useMemo(() => {
    return apiApts.filter(a => {
      const matchSearch = !search || a.patientName?.toLowerCase().includes(search.toLowerCase()) || a.type?.toLowerCase().includes(search.toLowerCase());
      const matchType = typeFilter === "all" || a.type === typeFilter;
      const matchStatus = statusFilter === "all" || a.status === statusFilter;
      let matchPeriod = true;
      if (periodFilter !== "all") {
        const aptDate = parseISO(a.date);
        if (periodFilter === "today") {
          matchPeriod = format(aptDate, "yyyy-MM-dd") === format(refDate, "yyyy-MM-dd");
        } else if (periodFilter === "week") {
          const start = startOfWeek(refDate, { weekStartsOn: 1 });
          const end   = endOfWeek(refDate, { weekStartsOn: 1 });
          matchPeriod = isWithinInterval(aptDate, { start, end });
        } else if (periodFilter === "month") {
          const start = startOfMonth(refDate);
          const end   = endOfMonth(refDate);
          matchPeriod = isWithinInterval(aptDate, { start, end });
        }
      }
      return matchSearch && matchType && matchStatus && matchPeriod;
    }).sort((a, b) => {
      const da = new Date(`${a.date}T${a.time}`);
      const db = new Date(`${b.date}T${b.time}`);
      const aUp = !isPast(da) || isToday(new Date(a.date));
      const bUp = !isPast(db) || isToday(new Date(b.date));
      if (aUp && !bUp) return -1;
      if (!aUp && bUp) return 1;
      return aUp ? da.getTime() - db.getTime() : db.getTime() - da.getTime();
    });
  }, [apiApts, search, typeFilter, statusFilter, periodFilter, refDate]);

  const counts = {
    all:       apiApts.length,
    confirmed: apiApts.filter(a => a.status === "confirmed").length,
    pending:   apiApts.filter(a => a.status === "pending").length,
    completed: apiApts.filter(a => a.status === "completed").length,
    cancelled: apiApts.filter(a => a.status === "cancelled").length,
  };

  const todayCount = apiApts.filter(a => format(parseISO(a.date), "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd")).length;
  const weekCount  = apiApts.filter(a => isWithinInterval(parseISO(a.date), { start: startOfWeek(new Date(), { weekStartsOn: 1 }), end: endOfWeek(new Date(), { weekStartsOn: 1 }) })).length;
  const monthCount = apiApts.filter(a => isWithinInterval(parseISO(a.date), { start: startOfMonth(new Date()), end: endOfMonth(new Date()) })).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.patientId) return;
    await createMutation.mutateAsync({ patientId: form.patientId, doctorId: undefined, date: form.date, time: form.time, duration: 30, type: form.type, notes: form.notes || undefined });
    setShowAddModal(false);
    setForm({ patientId: "", date: getToday(), time: "09:00", type: "Consultation", notes: "" });
  };

  const getEmptyTitle = () => {
    if (periodFilter === "today") return t("appointments.noAppointmentsToday");
    if (periodFilter === "week")  return t("appointments.noAppointmentsWeek");
    if (periodFilter === "month") return t("appointments.noAppointmentsMonth");
    if (search) return t("appointments.noResults");
    return t("appointments.noAppointments");
  };

  const getEmptyDesc = () => {
    if (periodFilter !== "all") return t("appointments.navigateOrCreate");
    return t("appointments.createFirst");
  };

  return (
    <div className="flex flex-col h-full">
      <Header title={t("appointments.title")} subtitle={t("appointments.subtitle", { count: apiApts.length })} />

      <div className="flex-1 overflow-auto custom-scroll p-6 space-y-4">

        {/* Period filters */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex gap-1.5 p-1 bg-muted rounded-xl flex-shrink-0">
              {PERIOD_TABS.map(({ value, label, icon }) => {
                const cnt = value === "today" ? todayCount : value === "week" ? weekCount : value === "month" ? monthCount : apiApts.length;
                return (
                  <button key={value}
                    onClick={() => { setPeriodFilter(value); setRefDate(new Date()); }}
                    className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap",
                      periodFilter === value ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                    <span>{icon}</span>
                    {label}
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full", periodFilter === value ? "bg-primary/10 text-primary" : "bg-background/60 text-muted-foreground")}>
                      {cnt}
                    </span>
                  </button>
                );
              })}
            </div>

            {periodFilter !== "all" && (
              <div className="flex items-center gap-2 flex-1">
                <button onClick={() => navigate(-1)} className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:bg-accent transition-all flex-shrink-0">
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <div className="flex-1 text-center">
                  <p className="text-sm font-semibold text-foreground capitalize">{getPeriodLabel(periodFilter, refDate)}</p>
                  <p className="text-[10px] text-muted-foreground">{filtered.length} {t("common.appointmentPlural")}</p>
                </div>
                <button onClick={() => navigate(1)} className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:bg-accent transition-all flex-shrink-0">
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button onClick={goToToday} className="px-2.5 py-1.5 text-[10px] font-semibold rounded-lg border border-border hover:bg-accent transition-all text-muted-foreground flex-shrink-0">
                  {t("appointments.countdown.today").slice(0, 4)}.
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Status tabs + Search + Add */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 custom-scroll">
            {STATUS_TABS.map(({ value, label }) => (
              <button key={value} onClick={() => setStatusFilter(value)}
                className={cn("flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex-shrink-0",
                  statusFilter === value ? "gradient-primary text-white shadow-sm" : "bg-card border border-border text-muted-foreground hover:text-foreground")}>
                {label}
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-semibold",
                  statusFilter === value ? "bg-white/20 text-white" : "bg-muted text-muted-foreground")}>
                  {counts[value]}
                </span>
              </button>
            ))}
          </div>

          <div className="flex gap-2 flex-1 sm:justify-end flex-wrap">
            <div className="relative flex-1 sm:max-w-52">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("appointments.searchPlaceholder")}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
            </div>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-border bg-card text-sm text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
              <option value="all">{t("appointments.allTypes")}</option>
              {CONSULTATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {(typeFilter !== "all" || statusFilter !== "all" || search) && (
              <button onClick={() => { setTypeFilter("all"); setStatusFilter("all"); setSearch(""); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent transition-all">
                <X className="w-3.5 h-3.5" /> {t("appointments.reset")}
              </button>
            )}
            <button onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl gradient-primary text-white text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm whitespace-nowrap">
              <Plus className="w-4 h-4" /> {t("appointments.newAppointment")}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full data-table min-w-[680px]">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="text-left">{t("appointments.patient")}</th>
                  <th className="text-left hidden md:table-cell">{t("appointments.type")}</th>
                  <th className="text-left">{t("appointments.dateTime")}</th>
                  <th className="text-left">{t("appointments.delay")}</th>
                  <th className="text-left">{t("common.status")}</th>
                  <th className="text-right">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array(5).fill(null).map((_, i) => <TableRowSkeleton key={i} cols={6} />)
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6}>
                    <EmptyState icon={Calendar}
                      title={getEmptyTitle()}
                      description={getEmptyDesc()}
                      action={{ label: `+ ${t("appointments.newAppointment")}`, onClick: () => setShowAddModal(true) }}
                      className="py-10" />
                  </td></tr>
                ) : (
                  filtered.map(apt => {
                    const upcoming = isFuture(new Date(`${apt.date}T${apt.time}`)) || isToday(new Date(apt.date));
                    const days = differenceInCalendarDays(new Date(apt.date), new Date());
                    const countdownEl = isToday(new Date(apt.date))
                      ? <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{t("appointments.countdown.today")}</span>
                      : days > 0
                      ? <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{t("appointments.countdown.inDays", { days })}</span>
                      : days === -1
                      ? <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{t("appointments.countdown.yesterday")}</span>
                      : <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{t("appointments.countdown.daysAgo", { days: Math.abs(days) })}</span>;

                    return (
                      <tr key={apt.id} className={cn(!upcoming && apt.status !== "cancelled" && "opacity-60")}>
                        <td>
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                              {apt.patientName?.split(" ").map((w: string) => w[0]).join("").slice(0, 2) || "?"}
                            </div>
                            <span className="font-medium text-foreground text-xs">{apt.patientName}</span>
                          </div>
                        </td>
                        <td className="hidden md:table-cell"><span className="text-xs text-muted-foreground">{apt.type}</span></td>
                        <td>
                          <div>
                            <p className="text-xs font-medium text-foreground">{format(new Date(apt.date), "d MMM yyyy", { locale: fr })}</p>
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> {apt.time} · {apt.duration}min</p>
                          </div>
                        </td>
                        <td>{countdownEl}</td>
                        <td>
                          <StatusPicker current={apt.status as AppointmentStatus}
                            onChange={status => updateStatusMutation.mutate({ id: apt.id, status })}
                            disabled={updateStatusMutation.isPending} />
                        </td>
                        <td>
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => { setReportingApt({ id: apt.id, date: apt.date, time: apt.time }); setReportDate(apt.date); setReportTime(apt.time); }}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-amber-50 hover:text-amber-600 transition-all" title={t("appointments.reschedule")}>
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => { if (confirm(`${t("common.delete")} ?`)) deleteMutation.mutate(apt.id); }}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-red-50 hover:text-red-500 transition-all" title={t("common.delete")}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer summary */}
          {filtered.length > 0 && (
            <div className="px-4 py-2.5 border-t border-border/50 bg-muted/20 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {filtered.length} {t("common.appointmentPlural")}
                {periodFilter !== "all" && ` · ${getPeriodLabel(periodFilter, refDate)}`}
              </p>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />{filtered.filter(a => a.status === "confirmed").length} {t("appointments.confirmed")}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />{filtered.filter(a => a.status === "pending").length} {t("appointments.pending")}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Nouveau RDV */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-foreground">{t("appointments.newRdv")}</h2>
              <button onClick={() => setShowAddModal(false)} className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">{t("appointments.patient")} *</label>
                <select required value={form.patientId} onChange={e => setForm(f => ({ ...f, patientId: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
                  <option value="">{t("appointments.choosePatient")}</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">{t("appointments.dateLabel")} *</label>
                  <input type="date" required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">{t("appointments.timeLabel")} *</label>
                  <input type="time" required value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">{t("appointments.typeLabel")}</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
                  {CONSULTATION_TYPES.map(tp => <option key={tp}>{tp}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">{t("common.notes")}</label>
                <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder={t("common.notesPlaceholder")}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-all">{t("common.cancel")}</button>
                <button type="submit" disabled={createMutation.isPending || !form.patientId}
                  className="flex-1 py-2.5 rounded-xl gradient-primary text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                  {createMutation.isPending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : t("appointments.createRdv")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reporter */}
      {reportingApt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setReportingApt(null)} />
          <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-foreground">{t("appointments.reschedule")}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{t("appointments.currentDate")} {format(new Date(reportingApt.date), "d MMMM yyyy", { locale: fr })}</p>
              </div>
              <button onClick={() => setReportingApt(null)} className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!reportingApt || !reportDate) return;
              await rescheduleMutation.mutateAsync({ id: reportingApt.id, date: reportDate, time: reportTime || reportingApt.time });
              setReportingApt(null);
            }} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">{t("appointments.newDate")} *</label>
                <input type="date" required value={reportDate} onChange={e => setReportDate(e.target.value)}
                  min={getToday()}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">{t("appointments.newTime")} <span className="text-muted-foreground font-normal">({t("common.optional")})</span></label>
                <input type="time" value={reportTime} onChange={e => setReportTime(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setReportingApt(null)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-all">{t("common.cancel")}</button>
                <button type="submit" disabled={rescheduleMutation.isPending || !reportDate}
                  className="flex-1 py-2.5 rounded-xl gradient-primary text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                  {rescheduleMutation.isPending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : t("appointments.rescheduleBtn")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
