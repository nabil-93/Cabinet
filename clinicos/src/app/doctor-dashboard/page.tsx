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
  Paperclip,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import { useAppointmentsByDate } from "@/hooks/useAppointments";
import { useDebounce } from "@/hooks/useDebounce";
import { usePatient } from "@/hooks/usePatients";
import { cn } from "@/lib/utils";
import { getToday } from "@/lib/date-utils";
import { useLang } from "@/lib/i18n";
import { trackPatientView } from "@/lib/client-track";
import { DocTab } from "./DocTab";
import { BillingTab } from "./BillingTab";
import { ValuesTab } from "./ValuesTab";

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
  createdAt?: string;
  date?: string;
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
  generatedImages?: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getStatusConfig = (lang: "fr" | "de") => ({
  confirmed: { label: lang === "de" ? "Bestätigt"      : "Confirmé",   className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  pending:   { label: lang === "de" ? "Ausstehend"     : "En attente", className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  cancelled: { label: lang === "de" ? "Abgesagt"       : "Annulé",     className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
  completed: { label: lang === "de" ? "Abgeschlossen"  : "Terminé",    className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
});

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

function StatProgressCard({ label, value, max, icon: Icon, color, monthlyGoalLabel }: {
  label: string; value: number; max: number; icon: React.ElementType; color: string; monthlyGoalLabel?: string;
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
      <p className="text-[10px] text-muted-foreground">{pct}{monthlyGoalLabel ?? "% de l'objectif mensuel"}</p>
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
          : <>
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.generatedImages?.map((src, i) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img key={i} src={src} alt="Image générée" className="mt-2 rounded-xl w-full max-w-xs object-cover border border-border shadow" />
              ))}
            </>
        }
      </div>
    </div>
  );
}

// ─── Dashboard Translations ───────────────────────────────────────────────────

const DT = {
  fr: {
    // Top tabs
    operational: "OPÉRATIONNEL", values: "VALEURS", stats: "STATISTIQUES",
    // Sub-tabs
    history: "Historique", doc: "Documentation", ia: "Analyse IA",
    billing: "Facturation", calendar: "Calendrier",
    // Left rail
    patientFile: "Dossier patient", inConsultation: "En consultation",
    waitingRoom: "Salle d'attente", waiting: "en attente", inProgress: "en cours",
    activePatients: "Patients actifs", today: "aujourd'hui",
    noPatientSelected: "Aucun patient sélectionné",
    clickToSee: "Cliquez sur un patient pour voir son dossier",
    emptyWaiting: "Salle d'attente vide",
    consultingSince: "En consultation depuis",
    waitingSince: "Attend depuis",
    endConsultation: "Terminer consultation",
    callPatient: "Appeler ce patient",
    callUrgent: "⚡ Appeler — URGENT",
    seeAll: "Voir tout",
    // Right panel
    upcomingApts: "Prochains rendez-vous", upcoming: "à venir",
    visitHistory: "Historique des visites", visits: "visites",
    allFilter: "Tous", doneFilter: "Terminés", confirmedFilter: "Confirmés",
    cancelledFilter: "Annulés", resetFilters: "Réinitialiser",
    noVisits: "Aucune visite précédente",
    noResults: "Aucun résultat pour ces filtres",
    nothingRecorded: "Rien d'enregistré",
    consultations: "Consultations", reports: "rapports",
    newReport: "+ Nouveau rapport", prescriptions: "Ordonnances",
    newPrescription: "+ Nouvelle ordonnance", treatment: "Traitement",
    nextApt: "Prochain RDV", noConsult: "Aucune consultation enregistrée",
    noPrescription: "Aucune ordonnance",
    aiMedical: "Assistant IA médical", context: "Contexte",
    noPatient: "Aucun patient sélectionné",
    newConv: "Nouveau", open: "Ouvrir",
    sendPlaceholder: "Question sur", genericPlaceholder: "Posez une question...",
    enterToSend: "Entrée pour envoyer · Maj+Entrée nouvelle ligne · 📎 pour joindre une image",
    noPatientValues: "Aucun patient sélectionné",
    selectPatientValues: "Sélectionnez un patient pour analyser ses valeurs biologiques",
    calendarTitle: "Calendrier du patient", totalApts: "rendez-vous au total",
    newApt: "Nouveau RDV", upcoming2: "À VENIR", past: "VISITES PASSÉES",
    confirmApt: "Confirmer", cancelBtn: "Annuler",
    aptDate: "Date", aptTime: "Heure", aptType: "Type", aptNotes: "Notes (optionnel)",
    saving: "Sauvegarde...",
    statsMonth: "Statistiques du mois", consultationsCount: "Consultations",
    patientsCount: "Patients traités", prescriptionsCount: "Ordonnances",
    invoicesCount: "Factures", activity: "Aperçu de l'activité",
    analytics: "Analytiques", todayApts: "RDV aujourd'hui", appointments: "rendez-vous",
    revenue: "Revenus du mois", mad: "MAD", waitingRoomCount: "En salle d'attente",
    patients: "patients", byStatus: "RDV du jour par statut",
    monthlyGoal: "% de l'objectif mensuel",
    patientStats: "Statistiques du patient", noPatientStats: "Sélectionnez un patient",
    totalRdv: "Total RDV", paid: "Payé", remaining: "Reste à payer",
    nextRdv: "Prochain RDV", lastVisit: "Dernière visite", noUpcoming: "Aucun RDV à venir",
    rdvByStatus: "RDV par statut", filterToday: "Aujourd'hui", filterWeek: "Semaine",
    filterMonth: "Mois", filterSixMonths: "6 mois",
  },
  de: {
    // Top tabs
    operational: "OPERATIV", values: "WERTE", stats: "STATISTIKEN",
    // Sub-tabs
    history: "Verlauf", doc: "Dokumentation", ia: "KI-Analyse",
    billing: "Abrechnung", calendar: "Kalender",
    // Left rail
    patientFile: "Patientenakte", inConsultation: "In Konsultation",
    waitingRoom: "Wartezimmer", waiting: "wartend", inProgress: "in Bearbeitung",
    activePatients: "Aktive Patienten", today: "heute",
    noPatientSelected: "Kein Patient ausgewählt",
    clickToSee: "Klicken Sie auf einen Patienten, um seine Akte zu sehen",
    emptyWaiting: "Wartezimmer leer",
    consultingSince: "In Konsultation seit",
    waitingSince: "Wartet seit",
    endConsultation: "Konsultation beenden",
    callPatient: "Patient aufrufen",
    callUrgent: "⚡ Aufrufen — DRINGEND",
    seeAll: "Alle sehen",
    // Right panel
    upcomingApts: "Nächste Termine", upcoming: "bevorstehend",
    visitHistory: "Besuchsverlauf", visits: "Besuche",
    allFilter: "Alle", doneFilter: "Abgeschlossen", confirmedFilter: "Bestätigt",
    cancelledFilter: "Abgesagt", resetFilters: "Filter zurücksetzen",
    noVisits: "Keine früheren Besuche",
    noResults: "Keine Ergebnisse für diese Filter",
    nothingRecorded: "Nichts eingetragen",
    consultations: "Konsultationen", reports: "Berichte",
    newReport: "+ Neuer Bericht", prescriptions: "Rezepte",
    newPrescription: "+ Neues Rezept", treatment: "Behandlung",
    nextApt: "Nächster Termin", noConsult: "Keine Konsultation eingetragen",
    noPrescription: "Kein Rezept vorhanden",
    aiMedical: "Medizinischer KI-Assistent", context: "Kontext",
    noPatient: "Kein Patient ausgewählt",
    newConv: "Neu", open: "Öffnen",
    sendPlaceholder: "Frage zu", genericPlaceholder: "Stellen Sie eine Frage...",
    enterToSend: "Enter zum Senden · Umsch+Enter neue Zeile · 📎 Bild anhängen",
    noPatientValues: "Kein Patient ausgewählt",
    selectPatientValues: "Wählen Sie einen Patienten, um seine biologischen Werte zu analysieren",
    calendarTitle: "Patientenkalender", totalApts: "Termine insgesamt",
    newApt: "Neuer Termin", upcoming2: "BEVORSTEHEND", past: "VERGANGENE BESUCHE",
    confirmApt: "Bestätigen", cancelBtn: "Abbrechen",
    aptDate: "Datum", aptTime: "Uhrzeit", aptType: "Typ", aptNotes: "Notizen (optional)",
    saving: "Speichern...",
    statsMonth: "Statistiken des Monats", consultationsCount: "Konsultationen",
    patientsCount: "Behandelte Patienten", prescriptionsCount: "Rezepte",
    invoicesCount: "Rechnungen", activity: "Aktivitätsübersicht",
    analytics: "Analysen", todayApts: "Termine heute", appointments: "Termine",
    revenue: "Monatseinnahmen", mad: "MAD", waitingRoomCount: "Im Wartezimmer",
    patients: "Patienten", byStatus: "Termine des Tages nach Status",
    monthlyGoal: "% des Monatsziels",
    patientStats: "Patientenstatistiken", noPatientStats: "Patient auswählen",
    totalRdv: "Termine gesamt", paid: "Bezahlt", remaining: "Restbetrag",
    nextRdv: "Nächster Termin", lastVisit: "Letzter Besuch", noUpcoming: "Kein bevorstehender Termin",
    rdvByStatus: "Termine nach Status", filterToday: "Heute", filterWeek: "Woche",
    filterMonth: "Monat", filterSixMonths: "6 Monate",
  },
};
type DashLang = typeof DT.fr;

// ─── LangSwitcher ─────────────────────────────────────────────────────────────

function LangSwitcher() {
  const { lang, setLang } = useLang();
  return (
    <div className="flex items-center gap-0.5 bg-muted/60 border border-border/50 rounded-xl p-1 flex-shrink-0">
      {(["fr", "de"] as const).map(l => (
        <button key={l} onClick={() => setLang(l)}
          className={cn("px-2 py-0.5 rounded-lg text-[11px] font-bold uppercase transition-all",
            lang === l ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground")}>
          {l}
        </button>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

// ─── Patient Stats Tab ────────────────────────────────────────────────────────

type StatsPeriod = "day" | "week" | "month" | "6months";

function filterByPeriod<T extends { date?: string; createdAt?: string }>(
  items: T[], period: StatsPeriod
): T[] {
  const now = new Date();
  let cutoff: Date;
  if (period === "day") {
    cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (period === "week") {
    cutoff = new Date(now); cutoff.setDate(now.getDate() - 6);
  } else if (period === "6months") {
    cutoff = new Date(now); cutoff.setMonth(now.getMonth() - 6);
  } else {
    cutoff = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return items.filter(item => {
    const d = item.date ?? item.createdAt ?? "";
    return d >= cutoff.toISOString().slice(0, 10);
  });
}

function PatientStatsTab({ effectiveSelectedId, patientApts, consultations, prescriptions, invoices, stats, todayApts, dt, lang }: {
  effectiveSelectedId: string | null;
  patientApts: any[];
  consultations: any[];
  prescriptions: any[];
  invoices: any[];
  stats: any;
  todayApts: any[];
  dt: any;
  lang: string;
}) {
  const [period, setPeriod] = useState<StatsPeriod>("month");
  const isDE = lang === "de";

  const PERIODS: { key: StatsPeriod; label: string }[] = [
    { key: "day",      label: dt.filterToday },
    { key: "week",     label: dt.filterWeek },
    { key: "month",    label: dt.filterMonth },
    { key: "6months",  label: dt.filterSixMonths },
  ];

  if (!effectiveSelectedId) {
    // ── Global stats (no patient selected) ──────────────────────────────────
    return (
      <div className="flex-1 overflow-y-auto custom-scroll">
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">{dt.statsMonth}</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StatProgressCard label={dt.consultationsCount} value={stats?.completedToday ?? 0} max={30} icon={Stethoscope} color="bg-primary" monthlyGoalLabel={dt.monthlyGoal} />
              <StatProgressCard label={dt.patientsCount} value={stats?.totalPatients ?? 0} max={100} icon={Users} color="bg-emerald-500" monthlyGoalLabel={dt.monthlyGoal} />
              <StatProgressCard label={dt.prescriptionsCount} value={prescriptions.length} max={50} icon={Pill} color="bg-amber-500" monthlyGoalLabel={dt.monthlyGoal} />
              <StatProgressCard label={dt.invoicesCount} value={invoices.length} max={40} icon={CreditCard} color="bg-blue-500" monthlyGoalLabel={dt.monthlyGoal} />
            </div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">{dt.activity}</h3>
              </div>
              <Link href="/analytics" className="text-[11px] text-primary hover:underline flex items-center gap-0.5">
                {dt.analytics} <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: dt.todayApts, value: stats?.todayAppointments ?? 0, unit: dt.appointments, color: "text-primary" },
                { label: dt.revenue,   value: `${(stats?.monthlyRevenue ?? 0).toLocaleString()}`, unit: dt.mad, color: "text-emerald-600" },
                { label: dt.waitingRoomCount, value: stats?.waitingRoom ?? 0, unit: dt.patients, color: "text-amber-600" },
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
            <h3 className="text-xs font-semibold text-foreground mb-3">{dt.byStatus}</h3>
            <div className="space-y-2">
              {(["confirmed","completed","pending","cancelled"] as const).map(status => {
                const count = todayApts.filter((a: any) => a.status === status).length;
                const pct = todayApts.length > 0 ? Math.round((count / todayApts.length) * 100) : 0;
                const labels: Record<string, string> = {
                  confirmed: isDE ? "Bestätigt" : "Confirmé",
                  completed: isDE ? "Abgeschlossen" : "Terminé",
                  pending:   isDE ? "Ausstehend" : "En attente",
                  cancelled: isDE ? "Abgesagt" : "Annulé",
                };
                const colors: Record<string, string> = {
                  confirmed: "bg-emerald-500", completed: "bg-blue-500", pending: "bg-amber-400", cancelled: "bg-red-400"
                };
                const bgCls: Record<string, string> = {
                  confirmed: "bg-emerald-100 text-emerald-700", completed: "bg-blue-100 text-blue-700",
                  pending: "bg-amber-100 text-amber-700", cancelled: "bg-red-100 text-red-700",
                };
                return (
                  <div key={status} className="flex items-center gap-3">
                    <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full w-24 text-center flex-shrink-0", bgCls[status])}>{labels[status]}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all", colors[status])} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] font-bold text-foreground w-6 text-right flex-shrink-0">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Patient-specific stats ─────────────────────────────────────────────────
  const filteredApts   = filterByPeriod(patientApts, period);
  const filteredRx     = filterByPeriod(prescriptions.map(p => ({ ...p, date: p.date ?? p.createdAt })), period);
  const filteredInv    = filterByPeriod(invoices.map(i => ({ ...i, date: i.date })), period);

  const completed  = filteredApts.filter((a: any) => a.status === "completed").length;
  const confirmed  = filteredApts.filter((a: any) => a.status === "confirmed").length;
  const pending    = filteredApts.filter((a: any) => a.status === "pending").length;
  const cancelled  = filteredApts.filter((a: any) => a.status === "cancelled").length;
  const totalApts  = filteredApts.length;

  const totalPaid  = filteredInv.reduce((s: number, inv: any) => s + (inv.paid ?? 0), 0);
  const totalRem   = filteredInv.reduce((s: number, inv: any) => s + Math.max(0, (inv.total ?? 0) - (inv.paid ?? 0)), 0);

  const upcoming = patientApts
    .filter((a: any) => a.status !== "cancelled" && a.date >= new Date().toISOString().slice(0,10))
    .sort((a: any, b: any) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  const nextApt = upcoming[0];

  const pastApts = patientApts.filter((a: any) => a.status === "completed").sort((a: any, b: any) => b.date.localeCompare(a.date));
  const lastApt = pastApts[0];

  const aptStatusColors: Record<string, { bg: string; bar: string; label: string }> = {
    confirmed: { bg: "bg-emerald-100 text-emerald-700", bar: "bg-emerald-500", label: isDE ? "Bestätigt" : "Confirmé" },
    completed: { bg: "bg-blue-100 text-blue-700",       bar: "bg-blue-500",    label: isDE ? "Abgeschlossen" : "Terminé" },
    pending:   { bg: "bg-amber-100 text-amber-700",     bar: "bg-amber-400",   label: isDE ? "Ausstehend" : "En attente" },
    cancelled: { bg: "bg-red-100 text-red-700",         bar: "bg-red-400",     label: isDE ? "Abgesagt" : "Annulé" },
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scroll">
      <div className="space-y-4">

        {/* Period selector */}
        <div className="flex gap-1 bg-muted/50 rounded-xl p-1">
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={cn("flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all",
                period === p.key ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {p.label}
            </button>
          ))}
        </div>

        {/* 4 stat cards */}
        <div className="grid grid-cols-2 gap-3">
          <StatProgressCard label={dt.consultationsCount} value={completed} max={period === "day" ? 10 : period === "week" ? 30 : period === "6months" ? 120 : 50} icon={Stethoscope} color="bg-primary" monthlyGoalLabel={dt.monthlyGoal} />
          <StatProgressCard label={dt.totalRdv} value={totalApts} max={period === "day" ? 10 : period === "week" ? 30 : period === "6months" ? 120 : 50} icon={Calendar} color="bg-blue-500" monthlyGoalLabel={dt.monthlyGoal} />
          <StatProgressCard label={dt.prescriptionsCount} value={filteredRx.length} max={period === "day" ? 5 : period === "week" ? 15 : period === "6months" ? 60 : 20} icon={Pill} color="bg-amber-500" monthlyGoalLabel={dt.monthlyGoal} />
          <StatProgressCard label={dt.invoicesCount} value={filteredInv.length} max={period === "day" ? 5 : period === "week" ? 15 : period === "6months" ? 60 : 20} icon={CreditCard} color="bg-purple-500" monthlyGoalLabel={dt.monthlyGoal} />
        </div>

        {/* Financial + next RDV */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-semibold text-foreground">{dt.activity}</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-emerald-600">{totalPaid.toLocaleString("fr-MA")}</p>
              <p className="text-[10px] text-emerald-600/70 mt-0.5">MAD</p>
              <p className="text-[10px] text-muted-foreground font-medium mt-1">{dt.paid}</p>
            </div>
            <div className={cn("rounded-xl p-3 text-center", totalRem > 0 ? "bg-red-50 dark:bg-red-950/20" : "bg-muted/30")}>
              <p className={cn("text-xl font-bold", totalRem > 0 ? "text-red-600" : "text-muted-foreground")}>{totalRem.toLocaleString("fr-MA")}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">MAD</p>
              <p className="text-[10px] text-muted-foreground font-medium mt-1">{dt.remaining}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/30 rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground font-medium mb-1">{dt.nextRdv}</p>
              {nextApt ? (
                <><p className="text-xs font-semibold text-foreground">{nextApt.date} · {nextApt.time}</p>
                  <p className="text-[10px] text-muted-foreground">{nextApt.type}</p></>
              ) : (
                <p className="text-xs text-muted-foreground">{dt.noUpcoming}</p>
              )}
            </div>
            <div className="bg-muted/30 rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground font-medium mb-1">{dt.lastVisit}</p>
              {lastApt ? (
                <><p className="text-xs font-semibold text-foreground">{lastApt.date} · {lastApt.time}</p>
                  <p className="text-[10px] text-muted-foreground">{lastApt.type}</p></>
              ) : (
                <p className="text-xs text-muted-foreground">{dt.noVisits}</p>
              )}
            </div>
          </div>
        </div>

        {/* RDV par statut */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="text-xs font-semibold text-foreground mb-3">{dt.rdvByStatus}</h3>
          <div className="space-y-2">
            {(["confirmed","completed","pending","cancelled"] as const).map(status => {
              const count = { confirmed, completed, pending, cancelled }[status];
              const pct = totalApts > 0 ? Math.round((count / totalApts) * 100) : 0;
              const sc = aptStatusColors[status];
              return (
                <div key={status} className="flex items-center gap-3">
                  <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full w-24 text-center flex-shrink-0", sc.bg)}>{sc.label}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", sc.bar)} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[10px] font-bold text-foreground w-6 text-right flex-shrink-0">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}

// Chat persistence helpers (outside component to avoid re-creation)
const CHAT_KEY = (id: string) => `clinicos-chat-${id}`;
const loadChat = (id: string): ChatMessage[] => {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(CHAT_KEY(id)) ?? "[]") || []; } catch { return []; }
};

export default function DoctorDashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { lang } = useLang();
  const dt: DashLang = DT[lang];
  const STATUS_CONFIG = getStatusConfig(lang);
  const today = getToday();
  const dateLocale = lang === "de" ? de : fr;
  const queryClient = useQueryClient();

  // UI state
  const [activeTop, setActiveTop]       = useState<TopTab>("op");
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("history");
  const [selectedId, setSelectedId]     = useState<string | null>(null);
  const [searchQuery, setSearchQuery]   = useState("");
  const [searchOpen, setSearchOpen]     = useState(false);
  const searchRef                       = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Close search dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
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
  const chatFileRef                     = useRef<HTMLInputElement>(null);
  const [chatImageB64, setChatImageB64] = useState<string | null>(null);
  const [chatImageName, setChatImageName] = useState<string>("");

  // Appointment status change state
  const [changingAptStatus, setChangingAptStatus] = useState<string | null>(null);

  // Historique filters + expanded visit
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>("all");
  const [historyTypeFilter, setHistoryTypeFilter]     = useState<string>("all");
  const [expandedAptId, setExpandedAptId]             = useState<string | null>(null);

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

  // Patient search query for the header search bar
  const { data: searchResults = [] } = useQuery({
    queryKey: ["patient-search-dash", debouncedSearch],
    queryFn: () =>
      api.get(`/patients/search?q=${encodeURIComponent(debouncedSearch)}&limit=8`)
        .then(r => r.data?.data ?? r.data ?? []),
    enabled: debouncedSearch.trim().length >= 1,
    staleTime: 30_000,
  });

  // Auto-select the patient currently in consultation
  const inProgressWaiting = waitingPatients.find(wp => wp.status === "in_progress");
  const effectiveSelectedId = selectedId ?? inProgressWaiting?.patientId ?? null;

  // Load chat history when effective patient changes
  useEffect(() => {
    setChatMessages(effectiveSelectedId ? loadChat(effectiveSelectedId) : []);
    setChatInput("");
    setChatImageB64(null);
  }, [effectiveSelectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist chat whenever messages change
  useEffect(() => {
    if (!effectiveSelectedId) return;
    try {
      const toSave = chatMessages.filter(m => !m.loading);
      localStorage.setItem(CHAT_KEY(effectiveSelectedId), JSON.stringify(toSave));
    } catch {}
  }, [chatMessages, effectiveSelectedId]);

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
      await queryClient.invalidateQueries({ queryKey: ["appointments"] });
      await queryClient.invalidateQueries({ queryKey: ["appointments-patient", effectiveSelectedId ?? ""] });
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

  const handleSelectPatient = useCallback((id: string, name?: string) => {
    setSelectedId(prev => {
      if (prev === id) return null;
      if (name) trackPatientView(id, name, "Dashboard Médecin");
      return id;
    });
  }, []);

  const role = user?.role === "doctor" ? "Médecin" : user?.role === "admin" ? "Admin Médecin" : user?.role ?? "";

  // ── Chat send ─────────────────────────────────────────────────────────────

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const sendChatMessage = async () => {
    if ((!chatInput.trim() && !chatImageB64) || chatLoading) return;
    const userText = chatInput.trim() || (chatImageB64 ? "Analyse cette image." : "");
    setChatInput("");
    const imageB64 = chatImageB64;
    const imageName = chatImageName;
    setChatImageB64(null);
    setChatImageName("");

    // Include extracted lab values from localStorage so AI can reason about them
    const savedLab = effectiveSelectedId && typeof window !== "undefined"
      ? (() => { try { return JSON.parse(localStorage.getItem(`clinicos-lab-values-${effectiveSelectedId}`) ?? "null"); } catch { return null; } })()
      : null;

    const labCtx = savedLab?.values?.length
      ? `\n\n[RÉSULTATS BIOLOGIQUES DU PATIENT (rapport du ${savedLab.reportDate ?? "date inconnue"}) — tu as accès direct à ces valeurs:\n${
          (savedLab.values as Array<{ label: string; value: string; unit: string; status: string; refMin: number | null; refMax: number | null; category: string }>)
            .map(v => `- ${v.label}: ${v.value} ${v.unit} (${v.status === "danger" ? "⚠ CRITIQUE" : v.status === "warn" ? "⚠ ATTENTION" : "✓ Normal"}, norme: ${v.refMin ?? "?"}-${v.refMax ?? "?"} ${v.unit}) [${v.category}]`)
            .join("\n")
        }${savedLab.summary ? `\nRésumé labo: ${savedLab.summary}` : ""}]`
      : "";

    const patientCtx = selectedPatient
      ? `[Patient sélectionné: ${selectedPatient.fullName}, ID: ${effectiveSelectedId}. Réponds en te concentrant sur ce patient.${labCtx}]\n\n`
      : "";

    const history = chatMessages.map(m => ({ role: m.role, content: m.content }));
    const isFirst = history.length === 0;
    const displayContent = imageName ? `📎 ${imageName}\n${userText}` : userText;
    const newUserMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: displayContent };
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
        body: JSON.stringify({
          messages: sendMessages,
          language: lang,
          ...(imageB64 ? { imageBase64: imageB64 } : {}),
        }),
      });
      const data = await res.json();

      setChatMessages(prev => [
        ...prev.filter(m => m.id !== "loading"),
        {
          id: `ai-${Date.now()}`,
          role: "assistant",
          content: data.message ?? "Erreur.",
          generatedImages: data.imageUrls?.length > 0 ? data.imageUrls : undefined,
        },
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

  // Appointment status change
  const changeAptStatus = async (aptId: string, newStatus: string) => {
    setChangingAptStatus(aptId);
    try {
      await api.patch(`/appointments/${aptId}`, { status: newStatus });
      await queryClient.invalidateQueries({ queryKey: ["appointments"] });                              // covers useAppointmentsByDate(today)
      await queryClient.invalidateQueries({ queryKey: ["appointments-patient", effectiveSelectedId] }); // patient history tab
    } finally {
      setChangingAptStatus(null);
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
      await queryClient.invalidateQueries({ queryKey: ["appointments"] });                               // today list + all pages
      await queryClient.invalidateQueries({ queryKey: ["appointments-patient", effectiveSelectedId] });  // patient history
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

        {/* Patient search with dropdown */}
        <div className="flex-1 relative" ref={searchRef}>
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none z-10" />
          <input
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
            onFocus={() => { if (searchQuery.trim()) setSearchOpen(true); }}
            placeholder="Rechercher un patient..."
            className="w-full pl-8 pr-8 py-1.5 rounded-lg bg-muted/60 border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(""); setSelectedId(null); setSearchOpen(false); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground z-10"
            >
              <XCircle className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Dropdown results */}
          {searchOpen && debouncedSearch.trim().length >= 1 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden max-h-72 overflow-y-auto">
              {searchResults.length === 0 ? (
                <div className="px-4 py-3 text-xs text-muted-foreground text-center">
                  Aucun patient trouvé pour &quot;{debouncedSearch}&quot;
                </div>
              ) : (
                <>
                  <div className="px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide border-b border-border/60 bg-muted/30">
                    {searchResults.length} patient{searchResults.length !== 1 ? "s" : ""}
                  </div>
                  {searchResults.map((p: { id: string; fullName: string; phone?: string; gender?: string; dateOfBirth?: string }) => {
                    const isSelected = effectiveSelectedId === p.id;
                    const age = p.dateOfBirth
                      ? Math.floor((Date.now() - new Date(p.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000))
                      : null;
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          setSelectedId(p.id);
                          trackPatientView(p.id, p.fullName, "Dashboard Médecin");
                          setSearchQuery(p.fullName);
                          setSearchOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-accent transition-colors",
                          isSelected && "bg-primary/5"
                        )}>
                        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-primary font-bold text-[9px]">
                            {p.fullName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">{p.fullName}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {p.phone ?? "—"}{age !== null ? ` · ${age} ans` : ""}
                          </p>
                        </div>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {([
            { id: "op" as const,     icon: Stethoscope, label: dt.operational },
            { id: "values" as const, icon: Heart,        label: dt.values },
            { id: "stats" as const,  icon: BarChart2,    label: dt.stats },
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
        <LangSwitcher />
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
                <span className="text-xs font-semibold text-foreground">{dt.patientFile}</span>
                {inProgressWaiting && !selectedId && (
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    {dt.inConsultation}
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
                <p className="text-[11px] text-muted-foreground font-medium">{dt.noPatientSelected}</p>
                <p className="text-[10px] text-muted-foreground/70 mt-1">{dt.clickToSee}</p>
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
                <span className="text-xs font-semibold text-foreground">{dt.waitingRoom}</span>
              </div>
              <span className="text-[10px] text-muted-foreground">
                {waitingPatients.filter(w => w.status === "waiting").length} {dt.waiting}
                {waitingPatients.some(w => w.status === "in_progress") ? ` · 1 ${dt.inProgress}` : ""}
              </span>
            </div>
            <div className="p-2 space-y-1.5 max-h-64 overflow-y-auto custom-scroll">
              {waitingPatients.length === 0 ? (
                <div className="py-4 text-center text-[11px] text-muted-foreground">{dt.emptyWaiting}</div>
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
                            {isInProgress ? `${dt.consultingSince} ${elapsedMins}min` : `${dt.waitingSince} ${elapsedMins}min`}
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
                            {dt.endConsultation}
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
                            {isUrgent ? dt.callUrgent : dt.callPatient}
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
                {waitingPatients.filter(w => w.status === "waiting").length} {dt.waiting}
                {waitingPatients.some(w => w.status === "in_progress") ? ` · 1 ${dt.inProgress}` : ""}
              </span>
              <Link href="/waiting-room" className="text-[10px] text-primary hover:underline flex items-center gap-0.5 font-medium">
                {dt.seeAll} <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* 3. Patients actifs (today's appointments) */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-3 pt-3 pb-2 border-b border-border/60">
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold text-foreground">{dt.activePatients}</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-medium">
                {aptsLoading ? "..." : `${todayApts.length} ${dt.today}`}
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
                      onClick={() => handleSelectPatient(apt.patientId, apt.patientName)}
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
                  { id: "history" as const, icon: History,      label: dt.history },
                  { id: "doc" as const,     icon: FileText,      label: dt.doc },
                  { id: "ia" as const,      icon: Bot,           label: dt.ia },
                  { id: "billing" as const, icon: CreditCard,    label: dt.billing },
                  { id: "cal" as const,     icon: Calendar,      label: dt.calendar },
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
                      <p className="text-sm font-medium text-muted-foreground">{dt.noPatientSelected}</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        {dt.clickToSee}
                      </p>
                    </div>
                  </div>
                )}

                {/* ── Historique des visites ── */}
                {activeSubTab === "history" && effectiveSelectedId && (() => {
                  // Unique appointment types for filter
                  const aptTypes = Array.from(new Set(patientApts.map(a => a.type))).filter(Boolean);

                  // Apply filters to past appointments
                  const filteredPast = pastApts.filter(a => {
                    if (historyStatusFilter !== "all" && a.status !== historyStatusFilter) return false;
                    if (historyTypeFilter !== "all" && a.type !== historyTypeFilter) return false;
                    return true;
                  });

                  return (
                    <div className="space-y-3">
                      {/* Upcoming */}
                      {upcomingApts.length > 0 && (
                        <div className="bg-card border border-border rounded-2xl overflow-hidden">
                          <div className="px-4 py-3 border-b border-border/60 flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-primary" />
                            <h3 className="text-sm font-semibold text-foreground">{dt.upcomingApts}</h3>
                            <span className="text-[10px] text-muted-foreground ml-auto">{upcomingApts.length} {dt.upcoming}</span>
                          </div>
                          <div className="divide-y divide-border/40">
                            {upcomingApts.map(apt => {
                              const sc = STATUS_CONFIG[apt.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
                              const d = new Date(apt.date);
                              const dayLabel = isToday(d) ? (lang === "de" ? "Heute" : "Aujourd'hui") : isTomorrow(d) ? (lang === "de" ? "Morgen" : "Demain") : format(d, "EEEE d MMMM", { locale: dateLocale });
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
                                  <select
                                    value={apt.status}
                                    onChange={e => changeAptStatus(apt.id, e.target.value)}
                                    disabled={changingAptStatus === apt.id}
                                    className={cn(
                                      "text-[9px] font-semibold px-1.5 py-0.5 rounded-lg border cursor-pointer focus:outline-none transition-colors flex-shrink-0",
                                      sc.className
                                    )}>
                                    <option value="pending">{lang === "de" ? "Ausstehend" : "En attente"}</option>
                                    <option value="confirmed">{lang === "de" ? "Bestätigt" : "Confirmé"}</option>
                                    <option value="completed">{lang === "de" ? "Abgeschlossen" : "Terminé"}</option>
                                    <option value="cancelled">{lang === "de" ? "Abgesagt" : "Annulé"}</option>
                                  </select>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Past visits with filters */}
                      <div className="bg-card border border-border rounded-2xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-border/60 flex items-center gap-2">
                          <History className="w-4 h-4 text-muted-foreground" />
                          <h3 className="text-sm font-semibold text-foreground">{dt.visitHistory}</h3>
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            {filteredPast.length}/{pastApts.length} {dt.visits}
                          </span>
                        </div>

                        {/* Filter bar */}
                        <div className="px-4 py-2 border-b border-border/40 flex flex-wrap gap-1.5">
                          {/* Status filters */}
                          {([
                            { value: "all", label: dt.allFilter },
                            { value: "completed", label: dt.doneFilter },
                            { value: "confirmed", label: dt.confirmedFilter },
                            { value: "cancelled", label: dt.cancelledFilter },
                          ]).map(f => (
                            <button
                              key={f.value}
                              onClick={() => setHistoryStatusFilter(f.value)}
                              className={cn(
                                "text-[10px] px-2 py-1 rounded-lg font-semibold transition-colors",
                                historyStatusFilter === f.value
                                  ? "bg-foreground text-background"
                                  : "bg-muted/40 text-muted-foreground hover:text-foreground"
                              )}>
                              {f.label}
                            </button>
                          ))}
                          {aptTypes.length > 0 && <div className="w-px bg-border/60 self-stretch mx-0.5" />}
                          {aptTypes.map(type => (
                            <button
                              key={type}
                              onClick={() => setHistoryTypeFilter(prev => prev === type ? "all" : type)}
                              className={cn(
                                "text-[10px] px-2 py-1 rounded-lg font-semibold transition-colors",
                                historyTypeFilter === type
                                  ? "bg-primary/20 text-primary border border-primary/30"
                                  : "bg-muted/40 text-muted-foreground hover:text-foreground"
                              )}>
                              {type}
                            </button>
                          ))}
                          {(historyStatusFilter !== "all" || historyTypeFilter !== "all") && (
                            <button
                              onClick={() => { setHistoryStatusFilter("all"); setHistoryTypeFilter("all"); }}
                              className="text-[10px] px-2 py-1 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors flex items-center gap-0.5">
                              <XCircle className="w-3 h-3" /> {dt.resetFilters}
                            </button>
                          )}
                        </div>

                        {filteredPast.length === 0 ? (
                          <div className="py-10 text-center">
                            <History className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">
                              {pastApts.length === 0 ? dt.noVisits : dt.noResults}
                            </p>
                          </div>
                        ) : (
                          <div className="divide-y divide-border/40">
                            {filteredPast.map(apt => {
                              const sc = STATUS_CONFIG[apt.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.completed;
                              const d = new Date(apt.date);
                              const isExpanded = expandedAptId === apt.id;

                              // Find consultation and prescriptions from this date
                              const aptConsultations = consultations.filter(c => c.date === apt.date);
                              const aptPrescriptions = prescriptions.filter(rx =>
                                (rx.date ?? rx.createdAt ?? "").startsWith(apt.date)
                              );
                              const hasDetails = aptConsultations.length > 0 || aptPrescriptions.length > 0;

                              return (
                                <div key={apt.id}>
                                  {/* Visit row — clickable only if has details */}
                                  {hasDetails ? (
                                    <button
                                      onClick={() => setExpandedAptId(prev => prev === apt.id ? null : apt.id)}
                                      className={cn(
                                        "w-full flex items-center gap-3 px-4 py-3 text-left transition-all",
                                        isExpanded ? "bg-primary/5 dark:bg-primary/10" : "hover:bg-accent/40"
                                      )}>
                                      <div className={cn(
                                        "w-9 h-9 rounded-xl flex flex-col items-center justify-center flex-shrink-0 transition-colors",
                                        isExpanded ? "bg-primary/20" : "bg-muted/50"
                                      )}>
                                        <span className={cn("font-bold text-[9px] leading-none", isExpanded ? "text-primary" : "text-muted-foreground")}>{format(d, "d")}</span>
                                        <span className={cn("text-[8px] leading-none capitalize", isExpanded ? "text-primary/60" : "text-muted-foreground/60")}>{format(d, "MMM", { locale: dateLocale })}</span>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-foreground capitalize">{format(d, "EEEE d MMMM yyyy", { locale: dateLocale })}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                          <p className="text-[10px] text-muted-foreground">{apt.time} · {apt.type}</p>
                                          <span className="text-[9px] text-primary font-medium">
                                            {aptConsultations.length > 0 && (lang === "de" ? "• Bericht" : "• Rapport")}
                                            {aptPrescriptions.length > 0 && (lang === "de" ? " • Rezept" : " • Ordonnance")}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded-full", sc.className)}>{sc.label}</span>
                                        <ChevronRight className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", isExpanded && "rotate-90")} />
                                      </div>
                                    </button>
                                  ) : (
                                    /* Non-expandable row — no details */
                                    <div className="flex items-center gap-3 px-4 py-3 opacity-70">
                                      <div className="w-9 h-9 rounded-xl bg-muted/50 flex flex-col items-center justify-center flex-shrink-0">
                                        <span className="text-muted-foreground font-bold text-[9px] leading-none">{format(d, "d")}</span>
                                        <span className="text-muted-foreground/60 text-[8px] leading-none capitalize">{format(d, "MMM", { locale: dateLocale })}</span>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-foreground capitalize">{format(d, "EEEE d MMMM yyyy", { locale: dateLocale })}</p>
                                        <p className="text-[10px] text-muted-foreground">{apt.time} · {apt.type}</p>
                                      </div>
                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded-full", sc.className)}>{sc.label}</span>
                                        <span className="text-[9px] text-muted-foreground/50 italic">{dt.nothingRecorded}</span>
                                      </div>
                                    </div>
                                  )}

                                  {/* Expanded detail — only when has details */}
                                  {isExpanded && hasDetails && (
                                    <div className="px-4 pb-4 pt-2 bg-muted/20 space-y-3 border-t border-border/40">
                                      {/* Consultations from this date */}
                                      {aptConsultations.map(c => (
                                        <div key={c.id} className="bg-card rounded-xl border border-border p-3 space-y-1.5">
                                          <div className="flex items-center gap-1.5">
                                            <Stethoscope className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                                            <p className="text-xs font-semibold text-foreground">{c.diagnosis}</p>
                                          </div>
                                          {c.treatment && (
                                            <p className="text-[10px] text-muted-foreground">
                                              <span className="font-medium">{lang === "de" ? "Behandlung:" : "Traitement:"}</span> {c.treatment}
                                            </p>
                                          )}
                                          {c.notes && <p className="text-[10px] text-muted-foreground/70 italic">{c.notes}</p>}
                                          {c.nextVisit && (
                                            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                              <Calendar className="w-2.5 h-2.5" />
                                              {lang === "de" ? "Nächster Termin:" : "Prochain RDV:"} {format(new Date(c.nextVisit), "d MMM yyyy", { locale: dateLocale })}
                                            </p>
                                          )}
                                        </div>
                                      ))}

                                      {/* Prescriptions from this date */}
                                      {aptPrescriptions.map(rx => {
                                        const meds = Array.isArray(rx.medications) ? rx.medications : [];
                                        return (
                                          <div key={rx.id} className="bg-card rounded-xl border border-border p-3 space-y-1">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <Pill className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                                              {meds.map((m, i) => (
                                                <span key={i} className="text-xs font-semibold text-foreground">
                                                  {typeof m === "string" ? m : m.name}
                                                </span>
                                              ))}
                                            </div>
                                            {rx.diagnosis && (
                                              <p className="text-[10px] text-muted-foreground">Motif: {rx.diagnosis}</p>
                                            )}
                                            {meds.filter(m => typeof m !== "string").map((m, i) => {
                                              const med = m as { name: string; dosage?: string; duration?: string; instructions?: string };
                                              const detail = [med.dosage, med.duration, med.instructions].filter(Boolean).join(" · ");
                                              return detail ? (
                                                <p key={i} className="text-[10px] text-muted-foreground">{med.name}: {detail}</p>
                                              ) : null;
                                            })}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* ── Documentation complète ── */}
                {activeSubTab === "doc" && effectiveSelectedId && (
                  <DocTab
                    patientId={effectiveSelectedId}
                    patient={selectedPatient}
                    consultations={consultations}
                    prescriptions={prescriptions}
                    dateLocale={dateLocale}
                    lang={lang}
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
                          <h3 className="text-sm font-semibold text-foreground">{dt.aiMedical}</h3>
                          {selectedPatient
                            ? <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">{dt.context}: {selectedPatient.fullName}</p>
                            : <p className="text-[10px] text-muted-foreground">{dt.noPatient}</p>
                          }
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {chatMessages.length > 0 && (
                          <button
                            onClick={() => {
                              setChatMessages([]);
                              if (effectiveSelectedId) {
                                try { localStorage.removeItem(CHAT_KEY(effectiveSelectedId)); } catch {}
                              }
                            }}
                            className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-accent transition-colors"
                          >
                            <RefreshCw className="w-3 h-3" /> {dt.newConv}
                          </button>
                        )}
                        <Link href="/ai-assistant" className="text-[10px] text-primary hover:underline flex items-center gap-0.5 px-2 py-1">
                          {dt.open} <ExternalLink className="w-2.5 h-2.5" />
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
                            <p className="text-sm font-medium text-foreground">{lang === "de" ? "Wie kann ich Ihnen helfen?" : "Comment puis-je vous aider ?"}</p>
                            {selectedPatient && (
                              <p className="text-[11px] text-muted-foreground mt-1">
                                {lang === "de" ? `Ich kenne die Akte von` : `Je connais le dossier de`} <span className="font-medium text-primary">{selectedPatient.fullName}</span>
                              </p>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
                            {(selectedPatient
                              ? lang === "de"
                                ? [
                                    `Fasse die Akte von ${selectedPatient.fullName} zusammen`,
                                    "Wechselwirkungen zwischen Medikamenten prüfen",
                                    "Weitere Untersuchungen vorschlagen",
                                    "Gibt es Risiken zu melden?",
                                  ]
                                : [
                                    `Résume le dossier de ${selectedPatient.fullName}`,
                                    "Vérifier les interactions médicamenteuses",
                                    "Suggérer des examens complémentaires",
                                    "Y a-t-il des risques à signaler ?",
                                  ]
                              : lang === "de"
                              ? [
                                  "Wie viele Patienten heute?",
                                  "Stand des Wartezimmers",
                                  "Monatseinnahmen",
                                  "Letzte Konsultationen",
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
                    <div className="flex-shrink-0 px-4 py-3 border-t border-border/60 space-y-2">
                      {/* Image preview */}
                      {chatImageB64 && (
                        <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-3 py-2">
                          <img src={`data:image/jpeg;base64,${chatImageB64}`} alt="preview" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                          <p className="text-[10px] text-foreground flex-1 truncate">{chatImageName}</p>
                          <button onClick={() => { setChatImageB64(null); setChatImageName(""); }} className="text-muted-foreground hover:text-red-500 transition-colors flex-shrink-0">
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                      <div className="flex items-end gap-2">
                        {/* File upload button */}
                        <button
                          onClick={() => chatFileRef.current?.click()}
                          className="w-9 h-9 rounded-xl bg-muted/50 border border-border text-muted-foreground hover:text-primary hover:border-primary/40 flex items-center justify-center transition-colors flex-shrink-0"
                          title="Joindre une image"
                        >
                          <Paperclip className="w-4 h-4" />
                        </button>
                        <input
                          ref={chatFileRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setChatImageName(file.name);
                            const reader = new FileReader();
                            reader.onload = ev => {
                              const result = ev.target?.result as string;
                              // Strip data URL prefix to get raw base64
                              setChatImageB64(result.split(",")[1] ?? null);
                            };
                            reader.readAsDataURL(file);
                            e.target.value = "";
                          }}
                        />
                        <textarea
                          value={chatInput}
                          onChange={e => setChatInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
                          }}
                          placeholder={selectedPatient ? `${dt.sendPlaceholder} ${selectedPatient.fullName}...` : dt.genericPlaceholder}
                          rows={2}
                          className="flex-1 px-3 py-2 rounded-xl bg-muted/50 border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none transition-all"
                        />
                        <button
                          onClick={sendChatMessage}
                          disabled={(!chatInput.trim() && !chatImageB64) || chatLoading}
                          className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                        >
                          {chatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-[9px] text-muted-foreground">{dt.enterToSend}</p>
                    </div>
                  </div>
                )}

                {/* ── Facturation patient ── */}
                {activeSubTab === "billing" && effectiveSelectedId && (
                  <BillingTab
                    patientId={effectiveSelectedId}
                    patientName={selectedPatient?.fullName}
                    invoices={invoices}
                    dateLocale={dateLocale}
                    lang={lang}
                  />
                )}

                {/* ── Calendrier patient ── */}
                {activeSubTab === "cal" && effectiveSelectedId && (
                  <div className="space-y-3">
                    {/* Header + new appointment */}
                    <div className="bg-card border border-border rounded-2xl overflow-hidden">
                      <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">{dt.calendarTitle}</h3>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {selectedPatient?.fullName} · {patientApts.length} {dt.totalApts}
                          </p>
                        </div>
                        <button
                          onClick={() => setShowNewApt(v => !v)}
                          className="flex items-center gap-1.5 text-[11px] font-semibold text-white bg-primary px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          {dt.newApt}
                        </button>
                      </div>

                      {/* New appointment form (collapsible) */}
                      {showNewApt && (
                        <div className="p-4 border-b border-border/60 bg-muted/20 space-y-3">
                          <p className="text-xs font-semibold text-foreground">Planifier un rendez-vous</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-muted-foreground block mb-1">{dt.aptDate}</label>
                              <input
                                type="date"
                                value={newAptDate}
                                onChange={e => setNewAptDate(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-card border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-muted-foreground block mb-1">{dt.aptTime}</label>
                              <input
                                type="time"
                                value={newAptTime}
                                onChange={e => setNewAptTime(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-card border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                              />
                            </div>
                            <div className="col-span-2">
                              <label className="text-[10px] text-muted-foreground block mb-1">{dt.aptType}</label>
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
                              <label className="text-[10px] text-muted-foreground block mb-1">{dt.aptNotes}</label>
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
                              {dt.confirmApt}
                            </button>
                            <button
                              onClick={() => setShowNewApt(false)}
                              className="text-[11px] text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-accent transition-colors"
                            >
                              {dt.cancelBtn}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Upcoming */}
                      {upcomingApts.length > 0 && (
                        <div>
                          <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{dt.upcoming2}</p>
                          <div className="divide-y divide-border/40">
                            {upcomingApts.map(apt => {
                              const d = new Date(apt.date);
                              const dayLabel = isToday(d) ? (lang === "de" ? "Heute" : "Aujourd'hui") : isTomorrow(d) ? (lang === "de" ? "Morgen" : "Demain") : format(d, "EEEE d MMMM", { locale: dateLocale });
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
                          <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{dt.past}</p>
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
            <div className="flex-1 overflow-hidden">
              {!effectiveSelectedId ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center py-16">
                    <Heart className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">{dt.noPatientValues}</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">{dt.selectPatientValues}</p>
                  </div>
                </div>
              ) : (
                <div className="h-full overflow-hidden">
                  <ValuesTab
                    patientId={effectiveSelectedId}
                    patientName={selectedPatient?.fullName}
                    lang={lang}
                  />
                </div>
              )}
            </div>
          )}

          {/* ── STATISTIQUES ────────────────────────────────────────────── */}
          {activeTop === "stats" && (
            <PatientStatsTab
              effectiveSelectedId={effectiveSelectedId}
              patientApts={patientApts}
              consultations={consultations}
              prescriptions={prescriptions}
              invoices={invoices}
              stats={stats}
              todayApts={todayApts}
              dt={dt}
              lang={lang}
            />
          )}

        </div>
      </div>
    </div>
  );
}
