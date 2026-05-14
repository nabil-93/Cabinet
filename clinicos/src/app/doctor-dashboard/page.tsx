"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format, isToday, isTomorrow, isPast } from "date-fns";
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
  XCircle,
  TrendingUp,
  Activity,
  Users,
  Plus,
  ExternalLink,
  Info,
  Send,
  Loader2,
  RefreshCw,
  CheckCircle2,
  History,
  Syringe,
  PhoneCall,
  StopCircle,
  Timer,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import { useAppointmentsByDate } from "@/hooks/useAppointments";
import { usePatient } from "@/hooks/usePatients";
import { cn } from "@/lib/utils";
import { getToday } from "@/lib/date-utils";
import { useLang } from "@/lib/i18n";
import { DocTab } from "./DocTab";

// ─── Types ────────────────────────────────────────────────────────────────────

type TopTab = "op" | "values" | "stats";
type SubTab = "history" | "doc" | "ia" | "billing" | "cal";

interface WaitingPatient {
  id: string;
  patientId?: string;
  patientName: string;
  arrivedAt?: string;
  estimatedWait?: number;
  status: string;
  priority?: string;
}

interface Appointment {
  id: string;
  patientId: string;
  patientName?: string;
  date: string;
  time: string;
  type: string;
  status: string;
  notes?: string;
}

interface Consultation {
  id: string;
  patientId: string;
  patientName?: string;
  date: string;
  diagnosis: string;
  treatment?: string;
  notes?: string;
  nextVisit?: string;
  urgency?: "urgent" | "normal";
}

interface Prescription {
  id: string;
  patientId: string;
  patientName?: string;
  medications: Array<{ name: string; dosage?: string; duration?: string; instructions?: string } | string>;
  diagnosis?: string;
  notes?: string;
  status: "active" | "expired";
  createdAt: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  patientId?: string;
  patientName: string;
  amount?: number;
  total?: number;
  paid?: number;
  status: "paid" | "pending" | "overdue" | "unpaid";
  date: string;
  createdAt?: string;
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

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  loading?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  confirmed: { label: "Confirmé",   className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  pending:   { label: "En attente", className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  cancelled: { label: "Annulé",     className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
  completed: { label: "Terminé",    className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
};

const INVOICE_STATUS: Record<string, { label: string; className: string }> = {
  paid:    { label: "Payée",      className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  pending: { label: "En attente", className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  unpaid:  { label: "Non payée",  className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  overdue: { label: "En retard",  className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
};

function getInitials(name?: string | null) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

function getMedName(med: Prescription["medications"][0]): string {
  if (typeof med === "string") return med;
  return med.name ?? "—";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ValueCard({ label, value, unit, status }: MedicalValue) {
  return (
    <div className={cn(
      "bg-card border rounded-xl p-3 flex flex-col gap-1",
      status === "ok"     && "border-emerald-200 dark:border-emerald-800",
      status === "warn"   && "border-amber-200 dark:border-amber-800",
      status === "danger" && "border-red-200 dark:border-red-800",
    )}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
        {status === "ok"     && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
        {status === "warn"   && <AlertTriangle className="w-3 h-3 text-amber-500" />}
        {status === "danger" && <AlertTriangle className="w-3 h-3 text-red-500" />}
      </div>
      <div className="flex items-baseline gap-1">
        <span className={cn(
          "text-lg font-bold",
          status === "ok"     && "text-emerald-700 dark:text-emerald-300",
          status === "warn"   && "text-amber-700 dark:text-amber-300",
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

// ─── Markdown-lite renderer for AI chat ──────────────────────────────────────
function ChatBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-2", isUser && "flex-row-reverse")}>
      <div className={cn(
        "w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5",
        isUser ? "bg-primary" : "bg-primary/10"
      )}>
        {isUser
          ? <User className="w-3.5 h-3.5 text-white" />
          : <Bot className="w-3.5 h-3.5 text-primary" />
        }
      </div>
      <div className={cn(
        "max-w-[80%] rounded-2xl px-3 py-2 text-[12px] leading-relaxed",
        isUser
          ? "bg-primary text-white rounded-tr-sm"
          : "bg-muted/60 text-foreground rounded-tl-sm border border-border/60"
      )}>
        {msg.loading
          ? <div className="flex gap-1 items-center py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          : <p className="whitespace-pre-wrap">{msg.content}</p>
        }
      </div>
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
  const queryClient = useQueryClient();

  // UI state
  const [activeTop, setActiveTop]       = useState<TopTab>("op");
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("history");
  const [selectedId, setSelectedId]     = useState<string | null>(null);
  const [searchQuery, setSearchQuery]   = useState("");
  // Tick every minute to update live wait times
  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Chat state (AI tab)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput]       = useState("");
  const [chatLoading, setChatLoading]   = useState(false);
  const chatEndRef                      = useRef<HTMLDivElement>(null);

  // New appointment form state (Calendar tab)
  const [showNewApt, setShowNewApt]   = useState(false);
  const [newAptDate, setNewAptDate]   = useState(today);
  const [newAptTime, setNewAptTime]   = useState("09:00");
  const [newAptType, setNewAptType]   = useState("Consultation");
  const [newAptNotes, setNewAptNotes] = useState("");
  const [aptSaving, setAptSaving]     = useState(false);

  // ── Data queries ─────────────────────────────────────────────────────────

  const { data: todayApts = [], isLoading: aptsLoading } = useAppointmentsByDate(today);

  const { data: waitingRaw } = useQuery({
    queryKey: ["waiting-room"],
    queryFn: () => api.get("/waiting-room").then(r => r.data?.data ?? r.data ?? []),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
  // Only show patients actively waiting or in consultation (exclude done)
  const waitingPatients: WaitingPatient[] = useMemo(
    () => (Array.isArray(waitingRaw) ? waitingRaw : []).filter(
      (w: WaitingPatient) => w.status === "waiting" || w.status === "in_progress"
    ),
    [waitingRaw]
  );

  // Auto-select the patient currently in consultation
  const inProgressWaiting = waitingPatients.find(wp => wp.status === "in_progress");
  const effectiveSelectedId = selectedId ?? inProgressWaiting?.patientId ?? null;

  const { data: selectedPatient, isLoading: patientLoading } = usePatient(effectiveSelectedId ?? "");

  // Patient-specific appointments (all, for history + calendar)
  const { data: patientAptsRaw } = useQuery({
    queryKey: ["appointments-patient", effectiveSelectedId],
    queryFn: () =>
      api.get(`/appointments?patientId=${effectiveSelectedId}`)
        .then(r => r.data?.data ?? r.data ?? []),
    enabled: !!effectiveSelectedId,
    staleTime: 30_000,
  });
  const patientApts: Appointment[] = Array.isArray(patientAptsRaw) ? patientAptsRaw : [];

  // Patient-specific consultations
  const { data: consultationsRaw } = useQuery({
    queryKey: ["consultations", effectiveSelectedId],
    queryFn: () =>
      api.get(effectiveSelectedId ? `/consultations?patientId=${effectiveSelectedId}` : "/consultations")
        .then(r => r.data?.data ?? r.data ?? []),
    staleTime: 30_000,
  });
  const consultations: Consultation[] = Array.isArray(consultationsRaw) ? consultationsRaw : [];

  // Patient-specific prescriptions
  const { data: prescriptionsRaw } = useQuery({
    queryKey: ["prescriptions", effectiveSelectedId],
    queryFn: () =>
      api.get(effectiveSelectedId ? `/prescriptions?patientId=${effectiveSelectedId}` : "/prescriptions")
        .then(r => r.data?.data ?? r.data ?? []),
    staleTime: 30_000,
  });
  const prescriptions: Prescription[] = Array.isArray(prescriptionsRaw) ? prescriptionsRaw : [];

  // All invoices — filtered client-side by selected patient
  const { data: invoicesRaw } = useQuery({
    queryKey: ["invoices-all"],
    queryFn: () => api.get("/invoices").then(r => r.data?.data ?? r.data ?? []),
    staleTime: 30_000,
  });
  const invoices: Invoice[] = useMemo(() => {
    const all: Invoice[] = Array.isArray(invoicesRaw) ? invoicesRaw : [];
    if (!effectiveSelectedId) return [];
    return all.filter(inv => inv.patientId === effectiveSelectedId);
  }, [invoicesRaw, effectiveSelectedId]);

  // Global stats
  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: () => api.get("/dashboard/stats").then(r => r.data?.data ?? r.data),
    staleTime: 60_000,
  });

  // Waiting room action state
  const [wrActionId, setWrActionId] = useState<string | null>(null);

  const callPatient = async (entryId: string) => {
    setWrActionId(entryId);
    try {
      await api.patch(`/waiting-room/${entryId}`, {
        status: "in_progress",
        doctorId: user?.id,
        doctorName: user?.name,
      });
      await queryClient.invalidateQueries({ queryKey: ["waiting-room"] });
    } finally {
      setWrActionId(null);
    }
  };

  const finishConsultation = async (entryId: string) => {
    setWrActionId(entryId);
    try {
      await api.patch(`/waiting-room/${entryId}`, { status: "done" });
      await queryClient.invalidateQueries({ queryKey: ["waiting-room"] });
      await queryClient.invalidateQueries({ queryKey: ["invoices-all"] });
      // Reset selected patient if it was this one
      setSelectedId(null);
    } finally {
      setWrActionId(null);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  // Search only filters the header — the patients list always shows all
  const filteredApts = todayApts;

  const pastApts = patientApts
    .filter(a => isPast(new Date(`${a.date}T${a.time}`)) || a.status === "completed")
    .sort((a, b) => b.date.localeCompare(a.date));

  const upcomingApts = patientApts
    .filter(a => !isPast(new Date(`${a.date}T${a.time}`)) && a.status !== "cancelled" && a.status !== "completed")
    .sort((a, b) => a.date.localeCompare(b.date));

  const medicalValues: MedicalValue[] = [
    { label: "Tension artérielle",  value: "128/82", unit: "mmHg", status: "warn" },
    { label: "Fréquence cardiaque", value: "72",     unit: "bpm",  status: "ok"   },
    { label: "Température",         value: "37.1",   unit: "°C",   status: "ok"   },
    { label: "Saturation O₂",       value: "98",     unit: "%",    status: "ok"   },
    { label: "Glycémie",            value: "1.12",   unit: "g/L",  status: "ok"   },
    { label: "IMC",                 value: "24.5",   unit: "kg/m²",status: "ok"   },
    { label: "Cholestérol",         value: "2.4",    unit: "g/L",  status: "warn" },
    { label: "Hémoglobine",         value: "11.8",   unit: "g/dL", status: "danger"},
  ];

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSelectPatient = useCallback((id: string) => {
    setSelectedId(prev => prev === id ? null : id);
    setChatMessages([]);
  }, []);

  const role = user?.role === "doctor" ? "Médecin" : user?.role === "admin" ? "Admin Médecin" : user?.role ?? "";

  // ── Chat send ─────────────────────────────────────────────────────────────

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userText = chatInput.trim();
    setChatInput("");

    // Patient context injected into first message only
    const patientCtx = selectedPatient
      ? `[Patient sélectionné: ${selectedPatient.fullName}, ID: ${effectiveSelectedId}. Réponds en te concentrant sur ce patient.]\n\n`
      : "";

    const history = chatMessages.map(m => ({ role: m.role, content: m.content }));
    const isFirst = history.length === 0;
    const newUserMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: userText };
    const loadingMsg: ChatMessage = { id: "loading", role: "assistant", content: "", loading: true };

    setChatMessages(prev => [...prev, newUserMsg, loadingMsg]);
    setChatLoading(true);

    try {
      const sendMessages = [
        ...history,
        { role: "user", content: isFirst ? `${patientCtx}${userText}` : userText },
      ];

      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: sendMessages, language: lang }),
      });
      const data = await res.json();

      setChatMessages(prev => [
        ...prev.filter(m => m.id !== "loading"),
        { id: `ai-${Date.now()}`, role: "assistant", content: data.message ?? "Erreur." },
      ]);
    } catch {
      setChatMessages(prev => [
        ...prev.filter(m => m.id !== "loading"),
        { id: `err-${Date.now()}`, role: "assistant", content: "Erreur de connexion. Réessayez." },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // ── Add appointment ────────────────────────────────────────────────────────

  const saveNewAppointment = async () => {
    if (!effectiveSelectedId || !newAptDate || !newAptTime) return;
    setAptSaving(true);
    try {
      await api.post("/appointments", {
        patientId: effectiveSelectedId,
        date: newAptDate,
        time: newAptTime,
        type: newAptType,
        notes: newAptNotes || undefined,
        status: "confirmed",
      });
      await queryClient.invalidateQueries({ queryKey: ["appointments-patient", effectiveSelectedId] });
      setShowNewApt(false);
      setNewAptNotes("");
    } catch {
      // ignore for now
    } finally {
      setAptSaving(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Top Header Bar ─────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-border bg-background/95 backdrop-blur-sm">
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-lg hover:bg-accent"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Dashboard</span>
        </button>

        <div className="w-px h-5 bg-border flex-shrink-0" />

        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-white text-[10px] font-bold overflow-hidden">
            {user?.avatarUrl
              ? <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
              : getInitials(user?.name)}
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-semibold text-foreground leading-none">Dr. {user?.name ?? "—"}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{role}</p>
          </div>
        </div>

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

        <div className="flex items-center gap-1 flex-shrink-0">
          {([
            { id: "op" as const,     icon: Stethoscope, label: "OPÉRATIONNEL" },
            { id: "values" as const, icon: Heart,        label: "VALEURS" },
            { id: "stats" as const,  icon: BarChart2,    label: "STATISTIQUES" },
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

          {/* 1. Dossier patient (always first) */}
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
                <Link href={`/patients/${effectiveSelectedId}`} className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                  Voir <ExternalLink className="w-2.5 h-2.5" />
                </Link>
              )}
            </div>

            {!effectiveSelectedId ? (
              <div className="p-4 text-center">
                <User className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-[11px] text-muted-foreground font-medium">Aucun patient sélectionné</p>
                <p className="text-[10px] text-muted-foreground/70 mt-1">Cliquez sur un patient pour voir son dossier</p>
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
                      {(Array.isArray(selectedPatient.allergies) ? selectedPatient.allergies : [selectedPatient.allergies])
                        .map((a: string, i: number) => (
                          <span key={i} className="text-[9px] px-1.5 py-0.5 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 rounded-full border border-red-200 dark:border-red-800">
                            {a}
                          </span>
                        ))}
                    </div>
                  </div>
                )}

                {selectedPatient.medicalHistory && selectedPatient.medicalHistory.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground mb-1">Antécédents</p>
                    <div className="flex flex-wrap gap-1">
                      {(Array.isArray(selectedPatient.medicalHistory) ? selectedPatient.medicalHistory : [selectedPatient.medicalHistory])
                        .slice(0, 4).map((h: string, i: number) => (
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
              <div className="p-3 text-center text-[11px] text-muted-foreground">Informations non disponibles</div>
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
                {waitingPatients.filter(w => w.status === "waiting").length} en attente
                {waitingPatients.some(w => w.status === "in_progress") ? " · 1 en cours" : ""}
              </span>
            </div>
            <div className="p-2 space-y-1.5 max-h-64 overflow-y-auto custom-scroll">
              {waitingPatients.length === 0 ? (
                <div className="py-4 text-center text-[11px] text-muted-foreground">Salle d&apos;attente vide</div>
              ) : (
                [...waitingPatients]
                  .sort((a, b) => {
                    // in_progress always first, then urgent, then by arrival
                    if (a.status === "in_progress") return -1;
                    if (b.status === "in_progress") return 1;
                    if (a.priority === "urgent" && b.priority !== "urgent") return -1;
                    if (b.priority === "urgent" && a.priority !== "urgent") return 1;
                    return (a.arrivedAt ?? "").localeCompare(b.arrivedAt ?? "");
                  })
                  .map(wp => {
                  const isInProgress = wp.status === "in_progress";
                  const isUrgent = wp.priority === "urgent";
                  const elapsedMins = wp.arrivedAt
                    ? Math.max(0, Math.floor((nowMs - new Date(wp.arrivedAt).getTime()) / 60_000))
                    : (wp.estimatedWait ?? 0);
                  const isActing = wrActionId === wp.id;
                  return (
                    <div key={wp.id} className={cn(
                      "rounded-xl border transition-all",
                      isInProgress
                        ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
                        : isUrgent
                          ? "bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-700"
                          : "bg-muted/30 border-border/60"
                    )}>
                      {/* Patient row */}
                      <div className="flex items-center gap-2 p-2">
                        <div className={cn(
                          "w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 relative",
                          isInProgress ? "bg-emerald-100 dark:bg-emerald-900/40"
                            : isUrgent ? "bg-red-100 dark:bg-red-900/40"
                            : "bg-amber-50 dark:bg-amber-950/30"
                        )}>
                          <span className={cn("font-bold text-[9px]",
                            isInProgress ? "text-emerald-700 dark:text-emerald-300"
                              : isUrgent ? "text-red-700 dark:text-red-300"
                              : "text-amber-700 dark:text-amber-300"
                          )}>
                            {getInitials(wp.patientName)}
                          </span>
                          {/* Pulsing dot for urgent */}
                          {isUrgent && !isInProgress && (
                            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 animate-ping" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-[11px] font-semibold text-foreground truncate">{wp.patientName}</p>
                            {isUrgent && !isInProgress && (
                              <span className="animate-pulse inline-flex items-center gap-0.5 text-[8px] font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40 px-1.5 py-0.5 rounded-full border border-red-300 dark:border-red-700 flex-shrink-0">
                                <AlertTriangle className="w-2 h-2" /> URGENT
                              </span>
                            )}
                          </div>
                          <p className={cn("text-[9px] flex items-center gap-1",
                            isInProgress ? "text-emerald-600 dark:text-emerald-400"
                              : isUrgent ? "text-red-600 dark:text-red-400"
                              : "text-amber-600 dark:text-amber-400"
                          )}>
                            <Timer className="w-2.5 h-2.5 flex-shrink-0" />
                            {isInProgress ? `En consultation depuis ${elapsedMins}min` : `Attend depuis ${elapsedMins}min`}
                          </p>
                        </div>
                      </div>
                      {/* Action buttons */}
                      <div className="flex gap-1 px-2 pb-2">
                        {isInProgress ? (
                          <button
                            onClick={() => finishConsultation(wp.id)}
                            disabled={isActing}
                            className="flex-1 flex items-center justify-center gap-1 text-[10px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg py-1.5 transition-colors"
                          >
                            {isActing ? <Loader2 className="w-3 h-3 animate-spin" /> : <StopCircle className="w-3 h-3" />}
                            Terminer consultation
                          </button>
                        ) : (
                          <button
                            onClick={() => callPatient(wp.id)}
                            disabled={isActing || waitingPatients.some(w => w.status === "in_progress")}
                            className={cn(
                              "flex-1 flex items-center justify-center gap-1 text-[10px] font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed rounded-lg py-1.5 transition-colors",
                              isUrgent
                                ? "bg-red-600 hover:bg-red-700 animate-pulse"
                                : "bg-primary hover:bg-primary/90"
                            )}
                          >
                            {isActing ? <Loader2 className="w-3 h-3 animate-spin" /> : <PhoneCall className="w-3 h-3" />}
                            {isUrgent ? "⚡ Appeler — URGENT" : "Appeler ce patient"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="px-3 py-2 border-t border-border/60 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">
                {waitingPatients.filter(w => w.status === "waiting").length} en attente
                {waitingPatients.some(w => w.status === "in_progress") ? " · 1 en cours" : ""}
              </span>
              <Link href="/waiting-room" className="text-[10px] text-primary hover:underline flex items-center gap-0.5 font-medium">
                Voir tout <ChevronRight className="w-3 h-3" />
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
                Array(3).fill(null).map((_, i) => <div key={i} className="h-10 rounded-xl bg-muted/50 animate-pulse" />)
              ) : filteredApts.length === 0 ? (
                <div className="py-4 text-center text-[11px] text-muted-foreground">Aucun patient aujourd&apos;hui</div>
              ) : (
                filteredApts.map(apt => {
                  const isSelected = effectiveSelectedId === apt.patientId;
                  const sc = STATUS_CONFIG[apt.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
                  return (
                    <button
                      key={apt.id}
                      onClick={() => handleSelectPatient(apt.patientId)}
                      className={cn(
                        "w-full flex items-center gap-2 p-2 rounded-xl text-left transition-all",
                        isSelected ? "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-700" : "hover:bg-accent/60 border border-transparent"
                      )}
                    >
                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-primary font-bold text-[9px]">{getInitials(apt.patientName)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-foreground truncate">{apt.patientName ?? "—"}</p>
                        <p className="text-[9px] text-muted-foreground">{apt.time} · {apt.type}</p>
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
                  { id: "history" as const, icon: History,      label: "Historique" },
                  { id: "doc" as const,     icon: FileText,      label: "Documentation" },
                  { id: "ia" as const,      icon: Bot,           label: "Analyse IA" },
                  { id: "billing" as const, icon: CreditCard,    label: "Facturation" },
                  { id: "cal" as const,     icon: Calendar,      label: "Calendrier" },
                ] as const).map(({ id, icon: Icon, label }) => (
                  <button
                    key={id}
                    onClick={() => setActiveSubTab(id)}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all flex-1 justify-center",
                      activeSubTab === id ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-card"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="hidden xl:inline">{label}</span>
                  </button>
                ))}
              </div>

              {/* Sub-tab content */}
              <div className="flex-1 overflow-y-auto custom-scroll">

                {/* No patient selected placeholder (shared) */}
                {!effectiveSelectedId && activeSubTab !== "ia" && (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center py-16">
                      <User className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                      <p className="text-sm font-medium text-muted-foreground">Aucun patient sélectionné</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        Sélectionnez un patient dans la liste pour afficher son dossier
                      </p>
                    </div>
                  </div>
                )}

                {/* ── Historique des visites ── */}
                {activeSubTab === "history" && effectiveSelectedId && (
                  <div className="space-y-3">
                    {/* Upcoming appointments */}
                    {upcomingApts.length > 0 && (
                      <div className="bg-card border border-border rounded-2xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-border/60 flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-primary" />
                          <h3 className="text-sm font-semibold text-foreground">Prochains rendez-vous</h3>
                          <span className="text-[10px] text-muted-foreground ml-auto">{upcomingApts.length} à venir</span>
                        </div>
                        <div className="divide-y divide-border/40">
                          {upcomingApts.map(apt => {
                            const sc = STATUS_CONFIG[apt.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
                            const d = new Date(apt.date);
                            const dayLabel = isToday(d) ? "Aujourd'hui" : isTomorrow(d) ? "Demain" : format(d, "EEEE d MMMM", { locale: dateLocale });
                            return (
                              <div key={apt.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-all">
                                <div className="w-9 h-9 rounded-xl bg-primary/10 flex flex-col items-center justify-center flex-shrink-0">
                                  <span className="text-primary font-bold text-[9px] leading-none">{format(d, "d")}</span>
                                  <span className="text-primary/60 text-[8px] leading-none capitalize">{format(d, "MMM", { locale: dateLocale })}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-foreground capitalize">{dayLabel}</p>
                                  <p className="text-[10px] text-muted-foreground">{apt.time} · {apt.type}</p>
                                </div>
                                <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0", sc.className)}>{sc.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Past visits */}
                    <div className="bg-card border border-border rounded-2xl overflow-hidden">
                      <div className="px-4 py-3 border-b border-border/60 flex items-center gap-2">
                        <History className="w-4 h-4 text-muted-foreground" />
                        <h3 className="text-sm font-semibold text-foreground">Historique des visites</h3>
                        <span className="text-[10px] text-muted-foreground ml-auto">{pastApts.length} visite{pastApts.length !== 1 ? "s" : ""}</span>
                      </div>
                      {pastApts.length === 0 ? (
                        <div className="py-10 text-center">
                          <History className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">Aucune visite précédente</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-border/40">
                          {pastApts.map(apt => {
                            const sc = STATUS_CONFIG[apt.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.completed;
                            const d = new Date(apt.date);
                            return (
                              <div key={apt.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-all">
                                <div className="w-9 h-9 rounded-xl bg-muted/50 flex flex-col items-center justify-center flex-shrink-0">
                                  <span className="text-muted-foreground font-bold text-[9px] leading-none">{format(d, "d")}</span>
                                  <span className="text-muted-foreground/60 text-[8px] leading-none capitalize">{format(d, "MMM", { locale: dateLocale })}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-foreground">{format(d, "EEEE d MMMM yyyy", { locale: dateLocale })}</p>
                                  <p className="text-[10px] text-muted-foreground">{apt.time} · {apt.type}</p>
                                  {apt.notes && <p className="text-[10px] text-muted-foreground/70 italic truncate mt-0.5">{apt.notes}</p>}
                                </div>
                                <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0", sc.className)}>{sc.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Documentation complète ── */}
                {activeSubTab === "doc" && effectiveSelectedId && (
                  <DocTab
                    patientId={effectiveSelectedId}
                    patient={selectedPatient}
                    consultations={consultations}
                    prescriptions={prescriptions}
                    dateLocale={dateLocale}
                  />
                )}

                {/* ── Analyse IA (Embedded Chat) ── */}
                {activeSubTab === "ia" && (
                  <div className="h-full flex flex-col bg-card border border-border rounded-2xl overflow-hidden">
                    {/* Chat header */}
                    <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Bot className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">Assistant IA médical</h3>
                          {selectedPatient
                            ? <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Contexte: {selectedPatient.fullName}</p>
                            : <p className="text-[10px] text-muted-foreground">Aucun patient sélectionné</p>
                          }
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {chatMessages.length > 0 && (
                          <button
                            onClick={() => setChatMessages([])}
                            className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-accent transition-colors"
                          >
                            <RefreshCw className="w-3 h-3" /> Nouveau
                          </button>
                        )}
                        <Link href="/ai-assistant" className="text-[10px] text-primary hover:underline flex items-center gap-0.5 px-2 py-1">
                          Ouvrir <ExternalLink className="w-2.5 h-2.5" />
                        </Link>
                      </div>
                    </div>

                    {/* Messages area */}
                    <div className="flex-1 overflow-y-auto custom-scroll p-4 space-y-3">
                      {chatMessages.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center gap-4 py-8">
                          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                            <Bot className="w-6 h-6 text-primary" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-medium text-foreground">Comment puis-je vous aider ?</p>
                            {selectedPatient && (
                              <p className="text-[11px] text-muted-foreground mt-1">
                                Je connais le dossier de <span className="font-medium text-primary">{selectedPatient.fullName}</span>
                              </p>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
                            {(selectedPatient
                              ? [
                                  `Résume le dossier de ${selectedPatient.fullName}`,
                                  "Vérifier les interactions médicamenteuses",
                                  "Suggérer des examens complémentaires",
                                  "Y a-t-il des risques à signaler ?",
                                ]
                              : [
                                  "Combien de patients aujourd'hui ?",
                                  "État de la salle d'attente",
                                  "Revenus du mois",
                                  "Dernières consultations",
                                ]
                            ).map(prompt => (
                              <button
                                key={prompt}
                                onClick={() => { setChatInput(prompt); }}
                                className="text-left text-[10px] text-muted-foreground border border-border rounded-xl p-2.5 hover:border-primary/40 hover:text-foreground hover:bg-primary/5 transition-all"
                              >
                                {prompt}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {chatMessages.map(msg => (
                        <ChatBubble key={msg.id} msg={msg} />
                      ))}
                      <div ref={chatEndRef} />
                    </div>

                    {/* Input area */}
                    <div className="flex-shrink-0 px-4 py-3 border-t border-border/60">
                      <div className="flex items-end gap-2">
                        <textarea
                          value={chatInput}
                          onChange={e => setChatInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
                          }}
                          placeholder={selectedPatient ? `Question sur ${selectedPatient.fullName}...` : "Posez une question..."}
                          rows={2}
                          className="flex-1 px-3 py-2 rounded-xl bg-muted/50 border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none transition-all"
                        />
                        <button
                          onClick={sendChatMessage}
                          disabled={!chatInput.trim() || chatLoading}
                          className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                        >
                          {chatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-[9px] text-muted-foreground mt-1.5">Entrée pour envoyer · Maj+Entrée pour nouvelle ligne</p>
                    </div>
                  </div>
                )}

                {/* ── Facturation patient ── */}
                {activeSubTab === "billing" && effectiveSelectedId && (
                  <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">Facturation</h3>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {selectedPatient ? `Factures de ${selectedPatient.fullName}` : "Factures du patient"}
                          {" · "}{invoices.length} facture{invoices.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <Link href="/billing" className="text-[11px] text-primary hover:underline flex items-center gap-0.5 font-medium">
                        Gérer <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>

                    {/* Summary row */}
                    {invoices.length > 0 && (
                      <div className="px-4 py-3 bg-muted/20 border-b border-border/60 flex items-center gap-4">
                        {[
                          { label: "Total facturé", value: invoices.reduce((s, i) => s + (i.total ?? i.amount ?? 0), 0), color: "text-foreground" },
                          { label: "Payé", value: invoices.filter(i => i.status === "paid").reduce((s, i) => s + (i.total ?? i.amount ?? 0), 0), color: "text-emerald-600 dark:text-emerald-400" },
                          { label: "Restant dû", value: invoices.filter(i => i.status !== "paid").reduce((s, i) => s + (i.total ?? i.amount ?? 0), 0), color: "text-amber-600 dark:text-amber-400" },
                        ].map(({ label, value, color }) => (
                          <div key={label} className="flex-1 text-center">
                            <p className={cn("text-base font-bold", color)}>{value.toLocaleString()} MAD</p>
                            <p className="text-[9px] text-muted-foreground">{label}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {invoices.length === 0 ? (
                      <div className="py-12 text-center">
                        <CreditCard className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-sm font-medium text-muted-foreground">Aucune facture pour ce patient</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-border/40">
                        {invoices.map(inv => {
                          const istatus = INVOICE_STATUS[inv.status] ?? INVOICE_STATUS.pending;
                          const dateStr = inv.date || inv.createdAt;
                          return (
                            <div key={inv.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-all">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-[11px] font-semibold text-foreground truncate">{inv.patientName || selectedPatient?.fullName}</p>
                                  {inv.invoiceNumber && (
                                    <span className="text-[9px] text-muted-foreground font-mono flex-shrink-0">#{inv.invoiceNumber}</span>
                                  )}
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  {dateStr ? format(new Date(dateStr), "d MMM yyyy", { locale: dateLocale }) : "—"}
                                </p>
                              </div>
                              <p className="text-xs font-bold text-foreground flex-shrink-0">
                                {(inv.total ?? inv.amount ?? 0).toLocaleString()} MAD
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

                {/* ── Calendrier patient ── */}
                {activeSubTab === "cal" && effectiveSelectedId && (
                  <div className="space-y-3">
                    {/* Header + new appointment */}
                    <div className="bg-card border border-border rounded-2xl overflow-hidden">
                      <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">Calendrier du patient</h3>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {selectedPatient?.fullName} · {patientApts.length} rendez-vous au total
                          </p>
                        </div>
                        <button
                          onClick={() => setShowNewApt(v => !v)}
                          className="flex items-center gap-1.5 text-[11px] font-semibold text-white bg-primary px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Nouveau RDV
                        </button>
                      </div>

                      {/* New appointment form (collapsible) */}
                      {showNewApt && (
                        <div className="p-4 border-b border-border/60 bg-muted/20 space-y-3">
                          <p className="text-xs font-semibold text-foreground">Planifier un rendez-vous</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-muted-foreground block mb-1">Date</label>
                              <input
                                type="date"
                                value={newAptDate}
                                onChange={e => setNewAptDate(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-card border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-muted-foreground block mb-1">Heure</label>
                              <input
                                type="time"
                                value={newAptTime}
                                onChange={e => setNewAptTime(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-card border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                              />
                            </div>
                            <div className="col-span-2">
                              <label className="text-[10px] text-muted-foreground block mb-1">Type</label>
                              <select
                                value={newAptType}
                                onChange={e => setNewAptType(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-card border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                              >
                                {["Consultation", "Suivi", "Bilan", "Urgence", "Vaccination", "Contrôle", "Autre"].map(t => (
                                  <option key={t} value={t}>{t}</option>
                                ))}
                              </select>
                            </div>
                            <div className="col-span-2">
                              <label className="text-[10px] text-muted-foreground block mb-1">Notes (optionnel)</label>
                              <input
                                type="text"
                                value={newAptNotes}
                                onChange={e => setNewAptNotes(e.target.value)}
                                placeholder="Ex: Apporter les résultats d'analyse..."
                                className="w-full px-2.5 py-1.5 rounded-lg bg-card border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={saveNewAppointment}
                              disabled={aptSaving}
                              className="flex items-center gap-1.5 text-[11px] font-semibold text-white bg-primary px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
                            >
                              {aptSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                              Confirmer
                            </button>
                            <button
                              onClick={() => setShowNewApt(false)}
                              className="text-[11px] text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-accent transition-colors"
                            >
                              Annuler
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Upcoming */}
                      {upcomingApts.length > 0 && (
                        <div>
                          <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">À venir</p>
                          <div className="divide-y divide-border/40">
                            {upcomingApts.map(apt => {
                              const d = new Date(apt.date);
                              const dayLabel = isToday(d) ? "Aujourd'hui" : isTomorrow(d) ? "Demain" : format(d, "EEEE d MMMM", { locale: dateLocale });
                              const sc = STATUS_CONFIG[apt.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.confirmed;
                              return (
                                <div key={apt.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-all">
                                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex flex-col items-center justify-center flex-shrink-0">
                                    <span className="text-primary font-bold text-[9px] leading-none">{format(d, "d")}</span>
                                    <span className="text-primary/60 text-[8px] leading-none capitalize">{format(d, "MMM", { locale: dateLocale })}</span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-foreground capitalize">{dayLabel}</p>
                                    <p className="text-[10px] text-muted-foreground">{apt.time} · {apt.type}</p>
                                  </div>
                                  <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0", sc.className)}>{sc.label}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Past */}
                      {pastApts.length > 0 && (
                        <div>
                          <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Visites passées</p>
                          <div className="divide-y divide-border/40">
                            {pastApts.slice(0, 8).map(apt => {
                              const d = new Date(apt.date);
                              const sc = STATUS_CONFIG[apt.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.completed;
                              return (
                                <div key={apt.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-all opacity-80">
                                  <div className="w-9 h-9 rounded-xl bg-muted/50 flex flex-col items-center justify-center flex-shrink-0">
                                    <span className="text-muted-foreground font-bold text-[9px] leading-none">{format(d, "d")}</span>
                                    <span className="text-muted-foreground/60 text-[8px] leading-none capitalize">{format(d, "MMM", { locale: dateLocale })}</span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-foreground">{format(d, "d MMMM yyyy", { locale: dateLocale })}</p>
                                    <p className="text-[10px] text-muted-foreground">{apt.time} · {apt.type}</p>
                                  </div>
                                  <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0", sc.className)}>{sc.label}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {patientApts.length === 0 && (
                        <div className="py-10 text-center">
                          <Calendar className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">Aucun rendez-vous enregistré</p>
                        </div>
                      )}
                    </div>
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
                    <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Normal</div>
                    <div className="flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-amber-500" />Attention</div>
                    <div className="flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-red-500" />Critique</div>
                  </div>
                </div>
                {!effectiveSelectedId ? (
                  <div className="py-16 text-center">
                    <Heart className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">Aucun patient sélectionné</p>
                  </div>
                ) : (
                  <div className="p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {medicalValues.map(mv => <ValueCard key={mv.label} {...mv} />)}
                    </div>
                    <div className="mt-4 bg-muted/30 border border-border rounded-xl p-3">
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                        <Info className="w-3 h-3 flex-shrink-0" />
                        Valeurs issues de la dernière consultation.{" "}
                        <Link href={`/patients/${effectiveSelectedId}`} className="text-primary hover:underline">Voir le dossier complet</Link>
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
                    <StatProgressCard label="Consultations" value={stats?.completedToday ?? 0} max={30} icon={Stethoscope} color="bg-primary" />
                    <StatProgressCard label="Patients traités" value={stats?.totalPatients ?? 0} max={100} icon={Users} color="bg-emerald-500" />
                    <StatProgressCard label="Ordonnances" value={prescriptions.filter(r => r.status === "active").length} max={50} icon={Pill} color="bg-amber-500" />
                    <StatProgressCard label="Factures" value={invoices.length} max={40} icon={CreditCard} color="bg-blue-500" />
                  </div>
                </div>

                <div className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-primary" />
                      <h3 className="text-sm font-semibold text-foreground">Aperçu de l&apos;activité</h3>
                    </div>
                    <Link href="/analytics" className="text-[11px] text-primary hover:underline flex items-center gap-0.5">
                      Analytiques <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "RDV aujourd'hui",    value: stats?.todayAppointments ?? 0, unit: "rendez-vous", color: "text-primary" },
                      { label: "Revenus du mois",    value: `${(stats?.monthlyRevenue ?? 0).toLocaleString()}`, unit: "MAD", color: "text-emerald-600 dark:text-emerald-400" },
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

                <div className="bg-card border border-border rounded-2xl p-4">
                  <h3 className="text-xs font-semibold text-foreground mb-3">RDV du jour par statut</h3>
                  <div className="space-y-2">
                    {(["confirmed", "completed", "pending", "cancelled"] as const).map(status => {
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
      </div>
    </div>
  );
}
