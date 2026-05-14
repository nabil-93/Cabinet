"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format, addDays, isToday, isTomorrow } from "date-fns";
import { fr, de } from "date-fns/locale";
import {
  Stethoscope,
  Heart,
  BarChart2,
  Search,
  AlertTriangle,
  Clock,
  ChevronRight,
  User,
  ArrowLeft,
  Bot,
  FileText,
  Pill,
  CreditCard,
  Calendar,
  ClipboardList,
  CheckCircle2,
  XCircle,
  CircleDot,
  TrendingUp,
  Activity,
  Users,
  Plus,
  ExternalLink,
  Info,
  Send,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import { useAppointmentsByDate, useAppointments } from "@/hooks/useAppointments";
import { usePatient } from "@/hooks/usePatients";
import { cn } from "@/lib/utils";
import { getToday } from "@/lib/date-utils";
import { useLang } from "@/lib/i18n";

// ─── Types ────────────────────────────────────────────────────────────────────

type TopTab = "op" | "values" | "stats";
type SubTab = "list" | "doc" | "ia" | "med" | "billing" | "cal";

interface WaitingPatient {
  id: string;
  patientId?: string;
  patientName: string;
  waitTime: number;
  status: string;
}

interface Consultation {
  id: string;
  patientId: string;
  patientName?: string;
  date: string;
  diagnosis: string;
  treatment?: string;
  notes?: string;
  urgency?: "urgent" | "normal";
}

interface Prescription {
  id: string;
  patientId: string;
  patientName?: string;
  medications: string[];
  dosage?: string;
  frequency?: string;
  duration?: string;
  status: "active" | "expired";
  createdAt: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  patientName: string;
  amount: number;
  status: "paid" | "pending" | "overdue";
  date: string;
}

interface DashboardStats {
  totalPatients: number;
  todayAppointments: number;
  monthlyRevenue: number;
  waitingRoom: number;
  completedToday: number;
}

interface MedicalValue {
  label: string;
  value: string;
  unit: string;
  status: "ok" | "warn" | "danger";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  confirmed: { label: "Confirmé",  className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  pending:   { label: "En attente", className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  cancelled: { label: "Annulé",    className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
  completed: { label: "Terminé",   className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
};

const INVOICE_STATUS = {
  paid:    { label: "Payée",     className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  pending: { label: "En attente", className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  overdue: { label: "En retard", className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
};

function getInitials(name?: string | null) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

function getDayLabel(dateStr: string, lang: string) {
  const date = new Date(dateStr);
  if (isToday(date)) return "Aujourd'hui";
  if (isTomorrow(date)) return "Demain";
  return format(date, "EEEE d MMMM", { locale: lang === "de" ? de : fr });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ValueCard({ label, value, unit, status }: MedicalValue) {
  return (
    <div className={cn(
      "bg-card border rounded-xl p-3 flex flex-col gap-1",
      status === "ok" && "border-emerald-200 dark:border-emerald-800",
      status === "warn" && "border-amber-200 dark:border-amber-800",
      status === "danger" && "border-red-200 dark:border-red-800",
    )}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
        {status === "ok" && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
        {status === "warn" && <AlertTriangle className="w-3 h-3 text-amber-500" />}
        {status === "danger" && <AlertTriangle className="w-3 h-3 text-red-500" />}
      </div>
      <div className="flex items-baseline gap-1">
        <span className={cn(
          "text-lg font-bold",
          status === "ok" && "text-emerald-700 dark:text-emerald-300",
          status === "warn" && "text-amber-700 dark:text-amber-300",
          status === "danger" && "text-red-700 dark:text-red-300",
        )}>{value}</span>
        <span className="text-[10px] text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}

function StatProgressCard({ label, value, max, icon: Icon, color }: {
  label: string; value: number; max: number; icon: React.ElementType; color: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", color)}>
            <Icon className="w-4 h-4 text-white" />
          </div>
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
        </div>
        <span className="text-xl font-bold text-foreground">{value}</span>
      </div>
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] text-muted-foreground">{pct}% de l&apos;objectif mensuel</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DoctorDashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { lang } = useLang();
  const today = getToday();
  const dateLocale = lang === "de" ? de : fr;

  // UI state
  const [activeTop, setActiveTop]       = useState<TopTab>("op");
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("list");
  const [selectedId, setSelectedId]     = useState<string | null>(null);
  const [searchQuery, setSearchQuery]   = useState("");
  const [aiQuestion, setAiQuestion]     = useState("");

  // ── Data queries ─────────────────────────────────────────────────────────

  const { data: todayApts = [], isLoading: aptsLoading } = useAppointmentsByDate(today);
  const { data: allApts  = [] }                           = useAppointments();

  const { data: waitingRaw } = useQuery({
    queryKey: ["waiting-room"],
    queryFn: () => api.get("/waiting-room").then(r => r.data?.data ?? r.data ?? []),
    staleTime: 30_000,
  });
  const waitingPatients: WaitingPatient[] = Array.isArray(waitingRaw) ? waitingRaw : [];

  // Auto-select the patient currently in consultation
  const inProgressWaiting = waitingPatients.find(wp => wp.status === "in_progress");
  const effectiveSelectedId = selectedId ?? inProgressWaiting?.patientId ?? null;

  const { data: selectedPatient, isLoading: patientLoading } = usePatient(effectiveSelectedId ?? "");

  const { data: consultationsRaw } = useQuery({
    queryKey: ["consultations", effectiveSelectedId],
    queryFn: () =>
      api.get(effectiveSelectedId ? `/consultations?patientId=${effectiveSelectedId}` : "/consultations")
        .then(r => r.data?.data ?? r.data ?? []),
    staleTime: 30_000,
  });
  const consultations: Consultation[] = Array.isArray(consultationsRaw) ? consultationsRaw : [];

  const { data: prescriptionsRaw } = useQuery({
    queryKey: ["prescriptions", effectiveSelectedId],
    queryFn: () =>
      api.get(effectiveSelectedId ? `/prescriptions?patientId=${effectiveSelectedId}` : "/prescriptions")
        .then(r => r.data?.data ?? r.data ?? []),
    staleTime: 30_000,
  });
  const prescriptions: Prescription[] = Array.isArray(prescriptionsRaw) ? prescriptionsRaw : [];

  const { data: invoicesRaw } = useQuery({
    queryKey: ["invoices-recent"],
    queryFn: () => api.get("/invoices?limit=10").then(r => r.data?.data ?? r.data ?? []),
    staleTime: 30_000,
  });
  const invoices: Invoice[] = Array.isArray(invoicesRaw) ? invoicesRaw : [];

  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: () => api.get("/dashboard/stats").then(r => r.data?.data ?? r.data),
    staleTime: 60_000,
  });

  // ── Derived data ──────────────────────────────────────────────────────────

  const filteredApts = todayApts.filter(a =>
    !searchQuery || a.patientName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calendar: next 7 days grouped by date
  const upcomingApts = allApts.filter(a => {
    const d = new Date(a.date);
    const now = new Date();
    const in7 = addDays(now, 7);
    return d >= now && d <= in7;
  });
  const aptsByDay = upcomingApts.reduce<Record<string, typeof allApts>>((acc, apt) => {
    const key = apt.date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(apt);
    return acc;
  }, {});

  // Demo medical values for selected patient
  const medicalValues: MedicalValue[] = [
    { label: "Tension artérielle", value: "128/82", unit: "mmHg", status: "warn" },
    { label: "Fréquence cardiaque", value: "72", unit: "bpm", status: "ok" },
    { label: "Température", value: "37.1", unit: "°C", status: "ok" },
    { label: "Saturation O₂", value: "98", unit: "%", status: "ok" },
    { label: "Glycémie", value: "1.12", unit: "g/L", status: "ok" },
    { label: "IMC", value: "24.5", unit: "kg/m²", status: "ok" },
    { label: "Cholestérol", value: "2.4", unit: "g/L", status: "warn" },
    { label: "Hémoglobine", value: "11.8", unit: "g/dL", status: "danger" },
  ];

  const handleSelectPatient = useCallback((id: string, name?: string) => {
    setSelectedId(prev => prev === id ? null : id);
    if (name) setSearchQuery(name);
  }, []);

  const role = user?.role === "doctor" ? "Médecin" : user?.role === "admin" ? "Admin Médecin" : user?.role ?? "";

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Top Header Bar ─────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-border bg-background/95 backdrop-blur-sm">
        {/* Back */}
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-lg hover:bg-accent"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Dashboard</span>
        </button>

        <div className="w-px h-5 bg-border flex-shrink-0" />

        {/* Doctor info */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-white text-[10px] font-bold overflow-hidden">
            {user?.avatarUrl
              ? <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
              : getInitials(user?.name)}
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-semibold text-foreground leading-none">
              Dr. {user?.name ?? "—"}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{role}</p>
          </div>
        </div>

        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Rechercher un patient..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-muted/60 border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(""); setSelectedId(null); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <XCircle className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Top tabs */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {([
            { id: "op" as const,     icon: Stethoscope, label: "OPÉRATIONNEL" },
            { id: "values" as const, icon: Heart,       label: "VALEURS" },
            { id: "stats" as const,  icon: BarChart2,   label: "STATISTIQUES" },
          ] as const).map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveTop(id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all",
                activeTop === id
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Main Content ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden gap-3 p-3">

        {/* ── LEFT RAIL ─────────────────────────────────────────────────── */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-3 overflow-y-auto custom-scroll">

          {/* 1. Dossier patient (always first — auto-populated from in-consultation) */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-3 pt-3 pb-2 border-b border-border/60">
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold text-foreground">Dossier patient</span>
                {inProgressWaiting && !selectedId && (
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    En consultation
                  </span>
                )}
              </div>
              {effectiveSelectedId && (
                <Link
                  href={`/patients/${effectiveSelectedId}`}
                  className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                >
                  Voir <ExternalLink className="w-2.5 h-2.5" />
                </Link>
              )}
            </div>

            {!effectiveSelectedId ? (
              <div className="p-4 text-center">
                <User className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-[11px] text-muted-foreground font-medium">Aucun patient sélectionné</p>
                <p className="text-[10px] text-muted-foreground/70 mt-1">
                  Cliquez sur un patient pour voir son dossier
                </p>
              </div>
            ) : patientLoading ? (
              <div className="p-3 space-y-2">
                {Array(3).fill(null).map((_, i) => <div key={i} className="h-4 rounded bg-muted/50 animate-pulse" />)}
              </div>
            ) : selectedPatient ? (
              <div className="p-3 space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center font-bold text-primary text-[11px]">
                    {getInitials(selectedPatient.fullName)}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">{selectedPatient.fullName}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {selectedPatient.gender === "male" ? "Homme" : selectedPatient.gender === "female" ? "Femme" : "—"}
                      {selectedPatient.dateOfBirth && (() => {
                        const dob = new Date(selectedPatient.dateOfBirth);
                        const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000));
                        return ` · ${age} ans`;
                      })()}
                    </p>
                  </div>
                </div>

                {selectedPatient.bloodType && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">Groupe sanguin:</span>
                    <span className="text-[10px] font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded-full">
                      {selectedPatient.bloodType}
                    </span>
                  </div>
                )}

                {selectedPatient.allergies && selectedPatient.allergies.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <AlertTriangle className="w-3 h-3 text-red-500" />
                      <span className="text-[10px] font-semibold text-red-600 dark:text-red-400">Allergies</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(Array.isArray(selectedPatient.allergies)
                        ? selectedPatient.allergies
                        : [selectedPatient.allergies]
                      ).map((allergy: string, i: number) => (
                        <span key={i} className="text-[9px] px-1.5 py-0.5 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 rounded-full border border-red-200 dark:border-red-800">
                          {allergy}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedPatient.medicalHistory && selectedPatient.medicalHistory.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground mb-1">Antécédents</p>
                    <div className="flex flex-wrap gap-1">
                      {(Array.isArray(selectedPatient.medicalHistory)
                        ? selectedPatient.medicalHistory
                        : [selectedPatient.medicalHistory]
                      ).slice(0, 4).map((h: string, i: number) => (
                        <span key={i} className="text-[9px] px-1.5 py-0.5 bg-muted rounded-full text-muted-foreground border border-border">
                          {h}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedPatient.phone && (
                  <p className="text-[10px] text-muted-foreground">
                    Tel: <span className="text-foreground font-medium">{selectedPatient.phone}</span>
                  </p>
                )}
              </div>
            ) : (
              <div className="p-3 text-center text-[11px] text-muted-foreground">
                Informations non disponibles
              </div>
            )}
          </div>

          {/* 2. Salle d'attente */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-3 pt-3 pb-2 border-b border-border/60">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs font-semibold text-foreground">Salle d&apos;attente</span>
              </div>
              <span className="text-[10px] text-muted-foreground">
                {waitingPatients.length} patient{waitingPatients.length !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="p-2 space-y-0.5 max-h-48 overflow-y-auto custom-scroll">
              {waitingPatients.length === 0 ? (
                <div className="py-4 text-center text-[11px] text-muted-foreground">
                  Salle d&apos;attente vide
                </div>
              ) : (
                waitingPatients.slice(0, 6).map((wp) => {
                  const isInProgress = wp.status === "in_progress";
                  return (
                    <div
                      key={wp.id}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-xl transition-all",
                        isInProgress
                          ? "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800"
                          : "hover:bg-accent/60"
                      )}
                    >
                      <div className={cn(
                        "w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0",
                        isInProgress
                          ? "bg-emerald-100 dark:bg-emerald-900/40"
                          : "bg-amber-50 dark:bg-amber-950/30"
                      )}>
                        <span className={cn(
                          "font-bold text-[9px]",
                          isInProgress
                            ? "text-emerald-700 dark:text-emerald-300"
                            : "text-amber-700 dark:text-amber-300"
                        )}>
                          {getInitials(wp.patientName)}
                        </span>
                      </div>
                      <p className="text-[11px] font-medium text-foreground flex-1 truncate">{wp.patientName}</p>
                      {isInProgress ? (
                        <span className="text-[9px] text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/40 px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0">
                          Consultation
                        </span>
                      ) : (
                        <span className="text-[9px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0">
                          {wp.waitTime ?? 0}m
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="px-3 py-2 border-t border-border/60 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">
                {waitingPatients.length} total
              </span>
              <Link href="/waiting-room" className="text-[10px] text-primary hover:underline flex items-center gap-0.5 font-medium">
                Voir mes patients <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* 3. Patients actifs (today's appointments) */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-3 pt-3 pb-2 border-b border-border/60">
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold text-foreground">Patients actifs</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-medium">
                {aptsLoading ? "..." : `${todayApts.length} aujourd'hui`}
              </span>
            </div>

            <div className="p-2 space-y-0.5 max-h-56 overflow-y-auto custom-scroll">
              {aptsLoading ? (
                Array(3).fill(null).map((_, i) => (
                  <div key={i} className="h-10 rounded-xl bg-muted/50 animate-pulse" />
                ))
              ) : filteredApts.length === 0 ? (
                <div className="py-4 text-center text-[11px] text-muted-foreground">
                  Aucun patient aujourd&apos;hui
                </div>
              ) : (
                filteredApts.map((apt) => {
                  const isSelected = effectiveSelectedId === apt.patientId;
                  const sc = STATUS_CONFIG[apt.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
                  return (
                    <button
                      key={apt.id}
                      onClick={() => handleSelectPatient(apt.patientId, apt.patientName)}
                      className={cn(
                        "w-full flex items-center gap-2 p-2 rounded-xl text-left transition-all",
                        isSelected
                          ? "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-700"
                          : "hover:bg-accent/60 border border-transparent"
                      )}
                    >
                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-primary font-bold text-[9px]">
                          {getInitials(apt.patientName)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-foreground truncate">
                          {apt.patientName ?? "—"}
                        </p>
                        <p className="text-[9px] text-muted-foreground">
                          {apt.time} · {apt.type}
                        </p>
                      </div>
                      <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0", sc.className)}>
                        {sc.label}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ───────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">

          {/* ── OPÉRATIONNEL ────────────────────────────────────────────── */}
          {activeTop === "op" && (
            <>
              {/* Sub-tabs */}
              <div className="flex-shrink-0 flex items-center gap-1 mb-3 bg-muted/40 rounded-xl p-1">
                {([
                  { id: "list" as const,    icon: ClipboardList, label: "Liste du jour" },
                  { id: "doc" as const,     icon: FileText,      label: "Documentation" },
                  { id: "ia" as const,      icon: Bot,           label: "Analyse IA" },
                  { id: "med" as const,     icon: Pill,          label: "Médication" },
                  { id: "billing" as const, icon: CreditCard,    label: "Facturation" },
                  { id: "cal" as const,     icon: Calendar,      label: "Calendrier" },
                ] as const).map(({ id, icon: Icon, label }) => (
                  <button
                    key={id}
                    onClick={() => setActiveSubTab(id)}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all flex-1 justify-center",
                      activeSubTab === id
                        ? "bg-foreground text-background shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-card"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="hidden xl:inline">{label}</span>
                  </button>
                ))}
              </div>

              {/* Sub-tab content */}
              <div className="flex-1 overflow-y-auto custom-scroll">

                {/* ── Liste du jour ── */}
                {activeSubTab === "list" && (
                  <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">Liste du jour</h3>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {format(new Date(), "EEEE d MMMM yyyy", { locale: dateLocale })} · {todayApts.length} rendez-vous
                        </p>
                      </div>
                      <Link href="/appointments" className="text-[11px] text-primary hover:underline flex items-center gap-0.5 font-medium">
                        Gérer <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>

                    {aptsLoading ? (
                      <div className="p-4 space-y-2">
                        {Array(5).fill(null).map((_, i) => (
                          <div key={i} className="h-14 rounded-xl bg-muted/50 animate-pulse" />
                        ))}
                      </div>
                    ) : todayApts.length === 0 ? (
                      <div className="py-12 text-center">
                        <Calendar className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-sm font-medium text-muted-foreground">Aucun rendez-vous aujourd&apos;hui</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-border/40">
                        {todayApts.map((apt) => {
                          const sc = STATUS_CONFIG[apt.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
                          return (
                            <div
                              key={apt.id}
                              className={cn(
                                "flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-all",
                                effectiveSelectedId === apt.patientId && "bg-emerald-50/50 dark:bg-emerald-950/10"
                              )}
                            >
                              <span className="text-xs font-mono font-semibold text-muted-foreground w-12 flex-shrink-0">
                                {apt.time}
                              </span>
                              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <span className="text-primary font-bold text-[10px]">{getInitials(apt.patientName)}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <button
                                  onClick={() => handleSelectPatient(apt.patientId, apt.patientName)}
                                  className="text-xs font-semibold text-foreground hover:text-primary transition-colors text-left"
                                >
                                  {apt.patientName ?? "—"}
                                </button>
                                <p className="text-[10px] text-muted-foreground mt-0.5">{apt.type}</p>
                              </div>
                              <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0", sc.className)}>
                                {sc.label}
                              </span>
                              <Link href={`/patients/${apt.patientId}`} className="text-muted-foreground hover:text-primary transition-colors flex-shrink-0">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Link>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Documentation ── */}
                {activeSubTab === "doc" && (
                  <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">Documentation</h3>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {selectedPatient ? `Consultations de ${selectedPatient.fullName}` : "Toutes les consultations récentes"}
                        </p>
                      </div>
                      {effectiveSelectedId && (
                        <Link
                          href={`/patients/${effectiveSelectedId}`}
                          className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline px-2.5 py-1.5 bg-primary/5 rounded-lg"
                        >
                          <Plus className="w-3 h-3" /> Nouveau rapport
                        </Link>
                      )}
                    </div>

                    {consultations.length === 0 ? (
                      <div className="py-12 text-center">
                        <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-sm font-medium text-muted-foreground">Aucune consultation enregistrée</p>
                        {!effectiveSelectedId && (
                          <p className="text-xs text-muted-foreground/70 mt-1">Sélectionnez un patient pour filtrer</p>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 space-y-3">
                        {consultations.map((c, i) => (
                          <div key={c.id} className="flex gap-3">
                            {/* Timeline dot */}
                            <div className="flex flex-col items-center flex-shrink-0">
                              <div className={cn(
                                "w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0",
                                c.urgency === "urgent" ? "bg-red-500" : "bg-amber-400"
                              )} />
                              {i < consultations.length - 1 && (
                                <div className="w-px flex-1 bg-border/60 mt-1 min-h-[20px]" />
                              )}
                            </div>
                            <div className="flex-1 bg-muted/30 rounded-xl p-3 mb-1">
                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <p className="text-xs font-semibold text-foreground">{c.diagnosis || "Consultation"}</p>
                                <span className="text-[10px] text-muted-foreground flex-shrink-0">
                                  {c.date ? format(new Date(c.date), "d MMM yyyy", { locale: dateLocale }) : "—"}
                                </span>
                              </div>
                              {c.patientName && !effectiveSelectedId && (
                                <p className="text-[10px] text-primary font-medium mb-1">{c.patientName}</p>
                              )}
                              {c.treatment && (
                                <p className="text-[10px] text-muted-foreground">
                                  <span className="font-medium text-foreground/70">Traitement:</span> {c.treatment}
                                </p>
                              )}
                              {c.notes && (
                                <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{c.notes}</p>
                              )}
                              {c.urgency === "urgent" && (
                                <span className="inline-flex items-center gap-0.5 mt-1.5 text-[9px] font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded-full">
                                  <AlertTriangle className="w-2.5 h-2.5" /> Urgent
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Analyse IA ── */}
                {activeSubTab === "ia" && (
                  <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Bot className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">Analyse IA</h3>
                          <p className="text-[10px] text-muted-foreground">Assistant médical intelligent</p>
                        </div>
                      </div>
                      <Link
                        href="/ai-assistant"
                        className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                      >
                        Ouvrir <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>

                    <div className="p-4 space-y-4">
                      {selectedPatient ? (
                        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 flex items-start gap-2">
                          <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                              Patient sélectionné: {selectedPatient.fullName}
                            </p>
                            <p className="text-[10px] text-emerald-700/70 dark:text-emerald-300/70 mt-0.5">
                              L&apos;IA analysera le dossier complet de ce patient
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-muted/40 border border-dashed border-border rounded-xl p-3 flex items-start gap-2">
                          <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                          <p className="text-[11px] text-muted-foreground">
                            Sélectionnez un patient dans la liste pour que l&apos;IA analyse son dossier
                          </p>
                        </div>
                      )}

                      <div>
                        <label className="text-[11px] font-semibold text-foreground block mb-1.5">
                          Poser une question à l&apos;IA sur ce patient
                        </label>
                        <textarea
                          value={aiQuestion}
                          onChange={e => setAiQuestion(e.target.value)}
                          placeholder={selectedPatient
                            ? `Posez une question sur ${selectedPatient.fullName}...`
                            : "Ex: Quels sont les risques potentiels d'une interaction médicamenteuse ?"}
                          rows={3}
                          className="w-full p-3 rounded-xl bg-muted/40 border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none transition-all"
                        />
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-[10px] text-muted-foreground">
                            Réponse en quelques secondes
                          </p>
                          <Link
                            href={`/ai-assistant${effectiveSelectedId ? `?patientId=${effectiveSelectedId}` : ""}${aiQuestion ? `&q=${encodeURIComponent(aiQuestion)}` : ""}`}
                            className="flex items-center gap-1.5 text-[11px] font-semibold text-white bg-primary px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors"
                          >
                            <Send className="w-3 h-3" /> Envoyer à l&apos;IA
                          </Link>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {[
                          "Résumer le dossier médical",
                          "Vérifier les interactions médicamenteuses",
                          "Suggérer des examens complémentaires",
                          "Analyser les valeurs biologiques",
                        ].map((prompt) => (
                          <button
                            key={prompt}
                            onClick={() => setAiQuestion(prompt)}
                            className="text-left text-[10px] text-muted-foreground border border-border rounded-xl p-2.5 hover:border-primary/40 hover:text-foreground hover:bg-primary/5 transition-all"
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Médication ── */}
                {activeSubTab === "med" && (
                  <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">Médication</h3>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {selectedPatient ? `Ordonnances de ${selectedPatient.fullName}` : "Toutes les ordonnances"}
                        </p>
                      </div>
                      <Link
                        href="/prescriptions"
                        className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline px-2.5 py-1.5 bg-primary/5 rounded-lg"
                      >
                        <Plus className="w-3 h-3" /> Nouvelle ordonnance
                      </Link>
                    </div>

                    {prescriptions.length === 0 ? (
                      <div className="py-12 text-center">
                        <Pill className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-sm font-medium text-muted-foreground">Aucune ordonnance</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-border/40">
                        {prescriptions.map((rx) => {
                          const isActive = rx.status === "active";
                          return (
                            <div key={rx.id} className="px-4 py-3 hover:bg-accent/40 transition-all">
                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {(Array.isArray(rx.medications) ? rx.medications : [rx.medications]).map((med: string, i: number) => (
                                      <span key={i} className="text-xs font-semibold text-foreground">{med}</span>
                                    ))}
                                  </div>
                                  {rx.patientName && !effectiveSelectedId && (
                                    <p className="text-[10px] text-primary mt-0.5">{rx.patientName}</p>
                                  )}
                                </div>
                                <span className={cn(
                                  "text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0",
                                  isActive
                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                    : "bg-muted text-muted-foreground"
                                )}>
                                  {isActive ? "Active" : "Expirée"}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                                {rx.dosage && <span>Dose: <span className="font-medium text-foreground/70">{rx.dosage}</span></span>}
                                {rx.frequency && <span>·</span>}
                                {rx.frequency && <span>{rx.frequency}</span>}
                                {rx.duration && <span>·</span>}
                                {rx.duration && <span>{rx.duration}</span>}
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-1">
                                Prescrit le {rx.createdAt ? format(new Date(rx.createdAt), "d MMM yyyy", { locale: dateLocale }) : "—"}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Facturation ── */}
                {activeSubTab === "billing" && (
                  <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">Facturation</h3>
                        <p className="text-[10px] text-muted-foreground mt-0.5">10 dernières factures</p>
                      </div>
                      <Link href="/billing" className="text-[11px] text-primary hover:underline flex items-center gap-0.5 font-medium">
                        Gérer <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>

                    {invoices.length === 0 ? (
                      <div className="py-12 text-center">
                        <CreditCard className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-sm font-medium text-muted-foreground">Aucune facture</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-border/40">
                        {invoices.map((inv) => {
                          const istatus = INVOICE_STATUS[inv.status as keyof typeof INVOICE_STATUS] ?? INVOICE_STATUS.pending;
                          return (
                            <div key={inv.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-all">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-[11px] font-semibold text-foreground truncate">{inv.patientName}</p>
                                  {inv.invoiceNumber && (
                                    <span className="text-[9px] text-muted-foreground font-mono flex-shrink-0">#{inv.invoiceNumber}</span>
                                  )}
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  {inv.date ? format(new Date(inv.date), "d MMM yyyy", { locale: dateLocale }) : "—"}
                                </p>
                              </div>
                              <p className="text-xs font-bold text-foreground flex-shrink-0">
                                {inv.amount?.toLocaleString()} MAD
                              </p>
                              <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0", istatus.className)}>
                                {istatus.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Calendrier ── */}
                {activeSubTab === "cal" && (
                  <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">Calendrier</h3>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Prochains 7 jours</p>
                      </div>
                      <Link href="/calendar" className="text-[11px] text-primary hover:underline flex items-center gap-0.5 font-medium">
                        Calendrier complet <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>

                    {Object.keys(aptsByDay).length === 0 ? (
                      <div className="py-12 text-center">
                        <Calendar className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-sm font-medium text-muted-foreground">Aucun rendez-vous à venir</p>
                      </div>
                    ) : (
                      <div className="p-4 space-y-4">
                        {Object.entries(aptsByDay)
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([date, apts]) => (
                            <div key={date}>
                              <div className="flex items-center gap-2 mb-2">
                                <div className={cn(
                                  "w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-bold flex-shrink-0",
                                  isToday(new Date(date))
                                    ? "bg-primary text-white"
                                    : "bg-muted text-muted-foreground"
                                )}>
                                  {format(new Date(date), "d")}
                                </div>
                                <p className="text-xs font-semibold text-foreground capitalize">
                                  {getDayLabel(date, lang)}
                                </p>
                                <span className="text-[10px] text-muted-foreground">
                                  {apts.length} rdv
                                </span>
                              </div>
                              <div className="space-y-1 ml-8">
                                {apts.map((apt) => {
                                  const sc = STATUS_CONFIG[apt.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
                                  return (
                                    <div key={apt.id} className="flex items-center gap-2 p-2 rounded-xl bg-muted/30 hover:bg-accent/40 transition-all">
                                      <span className="text-[10px] font-mono text-muted-foreground w-10 flex-shrink-0">{apt.time}</span>
                                      <p className="text-[11px] font-medium text-foreground flex-1 truncate">{apt.patientName}</p>
                                      <span className="text-[9px] text-muted-foreground">{apt.type}</span>
                                      <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0", sc.className)}>
                                        {sc.label}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}

              </div>
            </>
          )}

          {/* ── VALEURS ─────────────────────────────────────────────────── */}
          {activeTop === "values" && (
            <div className="flex-1 overflow-y-auto custom-scroll">
              <div className="bg-card border border-border rounded-2xl overflow-hidden h-full">
                <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Valeurs médicales</h3>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {selectedPatient ? selectedPatient.fullName : "Sélectionnez un patient"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Normal
                    </div>
                    <div className="flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-500" />Attention
                    </div>
                    <div className="flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-red-500" />Critique
                    </div>
                  </div>
                </div>

                {!effectiveSelectedId ? (
                  <div className="py-16 text-center">
                    <Heart className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">Aucun patient sélectionné</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Sélectionnez un patient dans la liste pour voir ses valeurs
                    </p>
                  </div>
                ) : (
                  <div className="p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {medicalValues.map((mv) => (
                        <ValueCard key={mv.label} {...mv} />
                      ))}
                    </div>
                    <div className="mt-4 bg-muted/30 border border-border rounded-xl p-3">
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                        <Info className="w-3 h-3 flex-shrink-0" />
                        Valeurs issues de la dernière consultation. Pour les valeurs biologiques complètes,{" "}
                        <Link href={`/patients/${effectiveSelectedId}`} className="text-primary hover:underline">
                          voir le dossier complet
                        </Link>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── STATISTIQUES ────────────────────────────────────────────── */}
          {activeTop === "stats" && (
            <div className="flex-1 overflow-y-auto custom-scroll">
              <div className="space-y-4">
                <div className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Statistiques du mois</h3>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatProgressCard
                      label="Consultations ce mois"
                      value={stats?.completedToday ?? 0}
                      max={30}
                      icon={Stethoscope}
                      color="bg-primary"
                    />
                    <StatProgressCard
                      label="Patients traités"
                      value={stats?.totalPatients ?? 0}
                      max={100}
                      icon={Users}
                      color="bg-emerald-500"
                    />
                    <StatProgressCard
                      label="Ordonnances émises"
                      value={prescriptions.filter(r => r.status === "active").length}
                      max={50}
                      icon={Pill}
                      color="bg-amber-500"
                    />
                    <StatProgressCard
                      label="Factures du mois"
                      value={invoices.length}
                      max={40}
                      icon={CreditCard}
                      color="bg-blue-500"
                    />
                  </div>
                </div>

                {/* Revenue summary */}
                <div className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-primary" />
                      <h3 className="text-sm font-semibold text-foreground">Aperçu de l&apos;activité</h3>
                    </div>
                    <Link href="/analytics" className="text-[11px] text-primary hover:underline flex items-center gap-0.5">
                      Analytiques complètes <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "RDV aujourd'hui", value: stats?.todayAppointments ?? 0, unit: "rendez-vous", color: "text-primary" },
                      { label: "Revenus du mois", value: `${(stats?.monthlyRevenue ?? 0).toLocaleString()}`, unit: "MAD", color: "text-emerald-600 dark:text-emerald-400" },
                      { label: "En salle d'attente", value: stats?.waitingRoom ?? 0, unit: "patients", color: "text-amber-600 dark:text-amber-400" },
                    ].map(({ label, value, unit, color }) => (
                      <div key={label} className="bg-muted/30 rounded-xl p-3 text-center">
                        <p className={cn("text-2xl font-bold", color)}>{value}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{unit}</p>
                        <p className="text-[10px] text-muted-foreground font-medium mt-1">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Today's breakdown */}
                <div className="bg-card border border-border rounded-2xl p-4">
                  <h3 className="text-xs font-semibold text-foreground mb-3">RDV du jour par statut</h3>
                  <div className="space-y-2">
                    {(["confirmed", "completed", "pending", "cancelled"] as const).map((status) => {
                      const count = todayApts.filter(a => a.status === status).length;
                      const sc = STATUS_CONFIG[status];
                      const pct = todayApts.length > 0 ? Math.round((count / todayApts.length) * 100) : 0;
                      return (
                        <div key={status} className="flex items-center gap-3">
                          <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full w-20 text-center flex-shrink-0", sc.className)}>
                            {sc.label}
                          </span>
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={cn("h-full rounded-full transition-all",
                                status === "confirmed" ? "bg-emerald-500" :
                                status === "completed" ? "bg-blue-500" :
                                status === "pending"   ? "bg-amber-400" : "bg-red-400"
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-foreground w-6 text-right flex-shrink-0">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
        {/* end right panel */}

      </div>
      {/* end main content */}

    </div>
  );
}
