"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Clock, CheckCircle, ArrowRight, X, UserPlus, LogOut,
  Stethoscope, Search, ChevronDown, AlertCircle, Calendar,
  Plus, ChevronRight, RefreshCw, SkipForward, Lock, Ban,
} from "lucide-react";
import Header from "@/components/layout/Header";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import api from "@/services/api";
import { differenceInMinutes, format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { useAuth } from "@/lib/auth-context";
import { useDoctorPresence } from "@/hooks/useDoctorPresence";
import type { OnlineDoctor } from "@/hooks/useDoctorPresence";
import { useRealtimeContext } from "@/providers/RealtimeProvider";
import { DoctorSelectModal } from "@/components/waiting-room/DoctorSelectModal";

// ─── Types ────────────────────────────────────────────────────────────────────

type WRStatus   = "waiting" | "in_progress" | "done";
type WRPriority = "normal" | "urgent";
type ApptFilter = "all" | "waiting" | "in_progress" | "done";

interface WREntry {
  id: string;
  patientId: string;
  patientName: string;
  appointmentId: string | null;
  appointmentTime: string | null;
  arrivedAt: string;
  status: WRStatus;
  priority: WRPriority;
  estimatedWait: number;
  assignedDoctorId: string | null;
  assignedDoctorName: string | null;
}

interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  time: string;
  type: string;
  status: string;
}

interface PatientOption {
  id: string;
  fullName: string;
  phone: string;
}

interface CreateForm {
  fullName: string;
  phone: string;
  dateOfBirth: string;
  gender: "male" | "female";
  priority: WRPriority;
  visitType: string;
}

const VISIT_TYPES = [
  "Consultation",
  "Consultation de suivi",
  "Consultation spécialisée",
  "Urgence",
  "Vaccination",
  "Bilan de santé",
  "Analyses",
  "Certificat médical",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}
function waitingMinutes(arrivedAt: string) {
  return differenceInMinutes(new Date(), parseISO(arrivedAt));
}
function formatWait(mins: number) {
  if (mins < 1) return "< 1 min";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

const COLORS = [
  "oklch(0.55 0.18 240)", "oklch(0.52 0.20 165)", "oklch(0.55 0.18 300)",
  "oklch(0.55 0.18 30)",  "oklch(0.52 0.18 200)", "oklch(0.55 0.20 120)",
];
const TODAY    = format(new Date(), "yyyy-MM-dd");
const WR_KEY   = ["waiting-room"] as const;
const APPT_KEY = ["appointments-today"] as const;

// ─── Small components ─────────────────────────────────────────────────────────

function Avatar({ name, idx, size = "md" }: { name: string; idx: number; size?: "sm" | "md" | "lg" }) {
  const cls = size === "lg" ? "w-14 h-14 text-xl rounded-2xl"
    : size === "sm" ? "w-8 h-8 text-xs rounded-xl"
    : "w-10 h-10 text-sm rounded-xl";
  return (
    <div className={cn("flex items-center justify-center flex-shrink-0 font-bold text-white shadow-sm", cls)}
      style={{ background: COLORS[idx % COLORS.length] }}>
      {initials(name)}
    </div>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: number; sub?: string; accent: string }) {
  return (
    <div className={cn("bg-card border border-border rounded-2xl px-5 py-4 flex items-center gap-4", accent)}>
      <p className="text-3xl font-bold text-foreground">{value}</p>
      <div>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[110px]">{sub}</p>}
      </div>
    </div>
  );
}

function UrgentBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 font-semibold dark:bg-red-950 dark:text-red-400 dark:border-red-800">
      <AlertCircle className="w-2.5 h-2.5" /> Urgent
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-muted-foreground block mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function PriorityPicker({ value, onChange }: { value: WRPriority; onChange: (v: WRPriority) => void }) {
  return (
    <div>
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Priorité</label>
      <div className="flex gap-2">
        {(["normal", "urgent"] as WRPriority[]).map(p => (
          <button key={p} type="button" onClick={() => onChange(p)}
            className={cn("flex-1 py-2 rounded-xl text-sm font-semibold border transition-all",
              value === p
                ? p === "urgent"
                  ? "bg-red-50 border-red-300 text-red-700 dark:bg-red-950 dark:border-red-700 dark:text-red-400"
                  : "bg-primary/10 border-primary/30 text-primary"
                : "bg-muted/30 border-border text-muted-foreground hover:bg-muted")}>
            {p === "urgent" ? "🚨 Urgent" : "Normal"}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Create patient form ──────────────────────────────────────────────────────

function CreatePatientForm({ initial, onSubmit }: { initial: Partial<CreateForm>; onSubmit: (f: CreateForm) => void }) {
  const [f, setF] = useState<CreateForm>({
    fullName: initial.fullName || "", phone: "", dateOfBirth: "",
    gender: "male", priority: initial.priority || "normal", visitType: "Consultation",
  });
  const set = (k: keyof CreateForm) => (v: string) => setF(p => ({ ...p, [k]: v }));

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(f); }} className="space-y-4">
      <div className="space-y-3">
        <Field label="Nom complet *">
          <input value={f.fullName} onChange={e => set("fullName")(e.target.value)} required
            placeholder="Prénom Nom"
            className="w-full px-3 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground" />
        </Field>
        <Field label="Téléphone *">
          <input value={f.phone} onChange={e => set("phone")(e.target.value)} required
            placeholder="06 XX XX XX XX" type="tel"
            className="w-full px-3 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date de naissance">
            <input value={f.dateOfBirth} onChange={e => set("dateOfBirth")(e.target.value)} type="date"
              className="w-full px-3 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground" />
          </Field>
          <Field label="Sexe">
            <select value={f.gender} onChange={e => set("gender")(e.target.value as "male" | "female")}
              className="w-full px-3 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground">
              <option value="male">Homme</option>
              <option value="female">Femme</option>
            </select>
          </Field>
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Motif de visite</label>
        <select value={f.visitType} onChange={e => setF(p => ({ ...p, visitType: e.target.value }))}
          className="w-full px-3 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground">
          {VISIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <PriorityPicker value={f.priority} onChange={v => setF(p => ({ ...p, priority: v }))} />
      <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-3 text-xs text-muted-foreground flex items-start gap-2">
        <Calendar className="w-3.5 h-3.5 mt-0.5 text-primary flex-shrink-0" />
        <span>Un rendez-vous pour aujourd&apos;hui sera créé automatiquement.</span>
      </div>
      <button type="submit"
        className="w-full py-2.5 rounded-xl gradient-primary text-white font-semibold text-sm hover:opacity-90 transition-all">
        Créer et ajouter à la file
      </button>
    </form>
  );
}

// ─── Add Modal ────────────────────────────────────────────────────────────────

function AddModal({
  onClose,
  onAddExisting,
  onCreateAndAdd,
}: {
  onClose: () => void;
  onAddExisting: (p: PatientOption, priority: WRPriority, visitType: string) => void;
  onCreateAndAdd: (f: CreateForm) => void;
}) {
  const [mode, setMode]           = useState<"search" | "create">("search");
  const [search, setSearch]       = useState("");
  const [priority, setPriority]   = useState<WRPriority>("normal");
  const [visitType, setVisitType] = useState("Consultation");
  const [selected, setSelected]   = useState<PatientOption | null>(null);

  const { data: patients = [], isFetching } = useQuery<PatientOption[]>({
    queryKey: ["patients-search-wr", search],
    queryFn: async () => {
      if (!search.trim()) return [];
      const r = await api.get(`/patients/search?q=${encodeURIComponent(search)}&limit=8`);
      return r.data.map((p: { id: string; fullName: string; phone: string }) => ({ id: p.id, fullName: p.fullName, phone: p.phone }));
    },
    enabled: search.trim().length >= 1,
    staleTime: 10_000,
  });

  const noResults = search.trim().length >= 1 && !isFetching && patients.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {mode === "create" && (
              <button onClick={() => setMode("search")}
                className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center">
                <ChevronRight className="w-4 h-4 text-muted-foreground rotate-180" />
              </button>
            )}
            <h2 className="font-bold text-lg text-foreground">
              {mode === "search" ? "Ajouter à la file" : "Nouveau patient"}
            </h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-muted flex items-center justify-center">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {mode === "search" ? (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input autoFocus value={search} onChange={e => { setSearch(e.target.value); setSelected(null); }}
                placeholder="Nom du patient..."
                className="w-full pl-9 pr-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground placeholder:text-muted-foreground" />
            </div>

            {search.trim().length >= 1 && (
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="max-h-44 overflow-y-auto custom-scroll">
                  {isFetching
                    ? <div className="py-6 text-center text-sm text-muted-foreground">Recherche…</div>
                    : patients.map(p => (
                      <button key={p.id} type="button" onClick={() => setSelected(p)}
                        className={cn("w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent transition-colors",
                          selected?.id === p.id && "bg-primary/10")}>
                        <Avatar name={p.fullName} idx={p.id.charCodeAt(0)} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{p.fullName}</p>
                          <p className="text-xs text-muted-foreground">{p.phone}</p>
                        </div>
                        {selected?.id === p.id && <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />}
                      </button>
                    ))
                  }
                </div>
                <button type="button" onClick={() => setMode("create")}
                  className="w-full flex items-center gap-3 px-4 py-3 border-t border-border hover:bg-accent transition-colors group">
                  <div className="w-8 h-8 rounded-xl border-2 border-dashed border-primary/40 group-hover:border-primary flex items-center justify-center flex-shrink-0">
                    <Plus className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-primary">Créer un nouveau patient</p>
                    {noResults && <p className="text-xs text-muted-foreground">Aucun résultat pour « {search} »</p>}
                  </div>
                </button>
              </div>
            )}

            {!search.trim() && (
              <button type="button" onClick={() => setMode("create")}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 text-muted-foreground hover:text-primary transition-all text-sm font-semibold">
                <Plus className="w-4 h-4" /> Nouveau patient
              </button>
            )}

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Motif de visite</label>
              <select value={visitType} onChange={e => setVisitType(e.target.value)}
                className="w-full px-3 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground">
                {VISIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <PriorityPicker value={priority} onChange={setPriority} />

            <button type="button" disabled={!selected}
              onClick={() => selected && onAddExisting(selected, priority, visitType)}
              className="w-full py-2.5 rounded-xl gradient-primary text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-all">
              Ajouter à la file d&apos;attente
            </button>
          </>
        ) : (
          <CreatePatientForm initial={{ fullName: search, priority }} onSubmit={onCreateAndAdd} />
        )}
      </div>
    </div>
  );
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────

const FILTER_TABS: { value: ApptFilter; label: string }[] = [
  { value: "all",         label: "Tous" },
  { value: "waiting",     label: "En attente" },
  { value: "in_progress", label: "En consultation" },
  { value: "done",        label: "Terminés" },
];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WaitingRoomPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const router = useRouter();

  const {
    onlineDoctors,
    availableDoctors,
    myAvailability,
    broadcastAvailability,
    isDoctor,
  } = useDoctorPresence();

  const [addOpen, setAddOpen]               = useState(false);
  const [showDone, setShowDone]             = useState(false);
  const [apptFilter, setApptFilter]         = useState<ApptFilter>("all");
  const [, setTick]                         = useState(0);
  const [assigningEntry, setAssigningEntry] = useState<WREntry | null>(null);

  // Re-render every 30s for wait-time display (does NOT trigger any fetch)
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  // ── Singleton realtime context (ONE WebSocket for the whole app) ─────────
  const { connectionStatus, sendBroadcast } = useRealtimeContext();

  // ── Queries (staleTime=0 → always use latest; refetch as safety net) ──────
  const { data: entries = [], isLoading, refetch: refetchWR, isFetching: isFetchingWR } = useQuery<WREntry[]>({
    queryKey: WR_KEY,
    queryFn:  async () => { const r = await api.get("/waiting-room"); return r.data; },
    staleTime: 0,
    refetchInterval: 5_000,
  });

  const { data: todayAppts = [], refetch: refetchAppts } = useQuery<Appointment[]>({
    queryKey: APPT_KEY,
    queryFn:  async () => { const r = await api.get(`/appointments?date=${TODAY}`); return r.data; },
    staleTime: 0,
    refetchInterval: 5_000,
  });

  const handleManualRefresh = useCallback(async () => {
    await Promise.all([refetchWR(), refetchAppts()]);
  }, [refetchWR, refetchAppts]);

  // ── Derived lists ──────────────────────────────────────────────────────────

  const wrByPatient = useMemo(() => {
    const map = new Map<string, WREntry>();
    entries.forEach(e => map.set(e.patientId, e));
    return map;
  }, [entries]);

  const waiting    = useMemo(() => entries.filter(e => e.status === "waiting"), [entries]);
  const inProgress = useMemo(() => entries.filter(e => e.status === "in_progress"), [entries]);
  const done       = useMemo(() =>
    entries
      .filter(e => e.status === "done")
      .sort((a, b) => new Date(b.arrivedAt).getTime() - new Date(a.arrivedAt).getTime()),
  [entries]);

  const enrichedAppts = useMemo(() => {
    return todayAppts
      .filter(a => a.status !== "cancelled")
      .map(a => ({ ...a, wrEntry: wrByPatient.get(a.patientId) ?? null }))
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [todayAppts, wrByPatient]);

  const filteredAppts = useMemo(() => {
    if (apptFilter === "all") return enrichedAppts;
    if (apptFilter === "waiting")     return enrichedAppts.filter(a => !a.wrEntry);
    if (apptFilter === "in_progress") return enrichedAppts.filter(a => a.wrEntry?.status === "in_progress");
    if (apptFilter === "done")        return enrichedAppts.filter(a => a.wrEntry?.status === "done");
    return enrichedAppts;
  }, [enrichedAppts, apptFilter]);

  const filterCounts = useMemo(() => ({
    all:         enrichedAppts.length,
    waiting:     enrichedAppts.filter(a => !a.wrEntry).length,
    in_progress: enrichedAppts.filter(a => a.wrEntry?.status === "in_progress").length,
    done:        enrichedAppts.filter(a => a.wrEntry?.status === "done").length,
  }), [enrichedAppts]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, doctorId, doctorName, appointmentId }: {
      id: string; status: WRStatus; doctorId?: string; doctorName?: string; appointmentId?: string | null;
    }) => {
      const wrRes = await api.patch(`/waiting-room/${id}`, { status, doctorId, doctorName });
      // Sync appointment status when consultation is done
      if (status === "done" && appointmentId) {
        try { await api.patch(`/appointments/${appointmentId}`, { status: "completed" }); } catch {}
      }
      return wrRes;
    },
    onMutate: async ({ id, status, doctorId, doctorName }) => {
      await qc.cancelQueries({ queryKey: WR_KEY });
      const prev = qc.getQueryData<WREntry[]>(WR_KEY);
      qc.setQueryData<WREntry[]>(WR_KEY, old =>
        (old ?? []).map(e => e.id === id
          ? { ...e, status, assignedDoctorId: doctorId ?? e.assignedDoctorId, assignedDoctorName: doctorName ?? e.assignedDoctorName }
          : e
        )
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(WR_KEY, ctx.prev); toast.error("Erreur"); },
    onSuccess: (_, { id, status, doctorId, doctorName }) => {
      qc.invalidateQueries({ queryKey: WR_KEY });
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: APPT_KEY });
      if (status === "in_progress") {
        sendBroadcast("wr:patient-called", { id, status, doctorId, doctorName });
        toast.success("Patient appelé en consultation");
      } else if (status === "done") {
        sendBroadcast("wr:consultation-done", { id, status });
        toast.success("Consultation terminée");
      } else {
        sendBroadcast("wr:updated", { id, status });
      }
    },
  });

  const removeEntry = useMutation({
    mutationFn: (id: string) => api.delete(`/waiting-room/${id}`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: WR_KEY });
      const prev = qc.getQueryData<WREntry[]>(WR_KEY);
      qc.setQueryData<WREntry[]>(WR_KEY, old => (old ?? []).filter(e => e.id !== id));
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(WR_KEY, ctx.prev); toast.error("Erreur"); },
    onSuccess: (_, id) => {
      sendBroadcast("wr:updated", { removed: id });
      qc.invalidateQueries({ queryKey: WR_KEY });
      toast.success("Patient retiré");
    },
  });

  const addEntry = useMutation({
    mutationFn: (body: { patientId: string; priority: WRPriority; appointmentId?: string; visitType?: string }) =>
      api.post("/waiting-room", body),
    onSuccess: (res) => {
      qc.setQueryData<WREntry[]>(WR_KEY, old => [...(old ?? []), res.data]);
      qc.invalidateQueries({ queryKey: APPT_KEY });
      qc.invalidateQueries({ queryKey: ["appointments"] });
      sendBroadcast("wr:updated", { added: res.data });
      toast.success("Patient ajouté à la file");
      setAddOpen(false);
    },
    onError: (e: { response?: { data?: { error?: string } } }) => toast.error(e?.response?.data?.error || "Erreur"),
  });

  const createAndAdd = useMutation({
    mutationFn: async (f: CreateForm) => {
      const patientRes = await api.post("/patients", {
        fullName: f.fullName, phone: f.phone,
        dateOfBirth: f.dateOfBirth || undefined, gender: f.gender,
      });
      const patient = patientRes.data;
      const apptRes = await api.post("/appointments", {
        patientId: patient.id, date: TODAY,
        time: format(new Date(), "HH:mm"),
        type: f.visitType, status: "confirmed",
      });
      const wrRes = await api.post("/waiting-room", {
        patientId: patient.id, appointmentId: apptRes.data.id, priority: f.priority, visitType: f.visitType,
      });
      return wrRes.data as WREntry;
    },
    onSuccess: (entry) => {
      qc.setQueryData<WREntry[]>(WR_KEY, old => [...(old ?? []), entry]);
      qc.invalidateQueries({ queryKey: APPT_KEY });
      sendBroadcast("wr:updated", { added: entry });
      toast.success("Patient créé et ajouté à la file");
      setAddOpen(false);
    },
    onError: (e: { response?: { data?: { error?: string } } }) => toast.error(e?.response?.data?.error || "Erreur"),
  });

  const cancelAppt = useMutation({
    mutationFn: (apptId: string) => api.patch(`/appointments/${apptId}/status`, { status: "cancelled" }),
    onMutate: async (apptId) => {
      await qc.cancelQueries({ queryKey: APPT_KEY });
      const prev = qc.getQueryData<Appointment[]>(APPT_KEY);
      qc.setQueryData<Appointment[]>(APPT_KEY, old => (old ?? []).map(a => a.id === apptId ? { ...a, status: "cancelled" } : a));
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(APPT_KEY, ctx.prev); toast.error("Erreur"); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: APPT_KEY });
      qc.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Rendez-vous annulé");
    },
  });

  // ── Doctor-aware call logic ────────────────────────────────────────────────

  const callPatient = useCallback((entry: WREntry) => {
    if (onlineDoctors.length === 0) {
      updateStatus.mutate({ id: entry.id, status: "in_progress" });
      return;
    }
    if (onlineDoctors.length === 1) {
      const doctor = onlineDoctors[0];
      updateStatus.mutate({ id: entry.id, status: "in_progress", doctorId: doctor.userId, doctorName: doctor.name });
    } else {
      setAssigningEntry(entry);
    }
  }, [onlineDoctors, updateStatus]);

  const handleDoctorSelected = useCallback((doctor: OnlineDoctor) => {
    if (!assigningEntry) return;
    updateStatus.mutate({
      id: assigningEntry.id,
      status: "in_progress",
      doctorId: doctor.userId,
      doctorName: doctor.name,
    });
    setAssigningEntry(null);
    if (user?.id === doctor.userId) {
      broadcastAvailability(false);
    }
  }, [assigningEntry, updateStatus, user, broadcastAvailability]);

  const finishConsultation = useCallback((entry: WREntry) => {
    updateStatus.mutate({ id: entry.id, status: "done", appointmentId: entry.appointmentId });
    if (entry.assignedDoctorId) {
      if (user?.id === entry.assignedDoctorId) {
        broadcastAvailability(true);
      }
      api.patch("/doctor/status", { isAvailable: true });
    }
  }, [updateStatus, user, broadcastAvailability]);

  const finishAndCallNext = useCallback(async (entry: WREntry) => {
    await api.patch(`/waiting-room/${entry.id}`, { status: "done" });
    // Also sync the appointment status
    if (entry.appointmentId) {
      try { await api.patch(`/appointments/${entry.appointmentId}`, { status: "completed" }); } catch {}
    }
    qc.setQueryData<WREntry[]>(WR_KEY, old => old?.map(e => e.id === entry.id ? { ...e, status: "done" } : e) ?? old);
    qc.invalidateQueries({ queryKey: ["appointments"] });
    qc.invalidateQueries({ queryKey: APPT_KEY });
    sendBroadcast("wr:consultation-done", { id: entry.id, status: "done" });
    if (user?.id === entry.assignedDoctorId) {
      broadcastAvailability(true);
    }
    const next = waiting[0];
    if (next) callPatient(next);
  }, [qc, user, broadcastAvailability, waiting, callPatient, sendBroadcast]);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Salle d'attente"
        subtitle={format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}
      />

      {/* ── Realtime status bar ── */}
      <div className="px-6 pt-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full flex-shrink-0",
            connectionStatus === "connected"  && "bg-emerald-500 animate-pulse",
            connectionStatus === "connecting" && "bg-amber-400 animate-pulse",
            connectionStatus === "error"      && "bg-red-500"
          )} />
          <span className={cn("text-xs font-medium",
            connectionStatus === "connected"  && "text-emerald-600 dark:text-emerald-400",
            connectionStatus === "connecting" && "text-amber-600 dark:text-amber-400",
            connectionStatus === "error"      && "text-red-500"
          )}>
            {connectionStatus === "connected"  && "Synchronisation en direct"}
            {connectionStatus === "connecting" && "Connexion en cours…"}
            {connectionStatus === "error"      && "Reconnexion…"}
          </span>
        </div>
        <button
          onClick={handleManualRefresh}
          disabled={isFetchingWR}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent transition-all disabled:opacity-50"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", isFetchingWR && "animate-spin")} />
          {isFetchingWR ? "Actualisation..." : "Actualiser"}
        </button>
      </div>

      <div className="flex-1 overflow-auto custom-scroll p-6 space-y-6 max-w-3xl mx-auto w-full">

        {/* ── Stats ── */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="En attente"      value={waiting.length}    sub="dans la file"                    accent="border-l-4 border-l-amber-400" />
          <StatCard label="En consultation" value={inProgress.length} sub={inProgress[0]?.patientName ?? "—"} accent="border-l-4 border-l-emerald-400" />
          <StatCard label="Terminés"        value={done.length}       sub="aujourd'hui"                     accent="border-l-4 border-l-border" />
        </div>


        {/* ── En consultation ── */}
        {inProgress.map(e => (
          <div key={e.id} className="bg-card border-2 border-emerald-300 dark:border-emerald-700 rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-emerald-50 dark:bg-emerald-950/50 px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">En consultation actuellement</span>
              </div>
              {e.assignedDoctorName && (
                <span className="text-xs text-emerald-600 dark:text-emerald-500 font-semibold">Dr. {e.assignedDoctorName}</span>
              )}
            </div>
            <div className="p-5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center text-white font-bold text-xl shadow-lg flex-shrink-0">
                  {initials(e.patientName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => router.push(`/patients/${e.patientId}`)}
                      className="font-bold text-foreground text-base hover:text-primary hover:underline transition-colors text-left">
                      {e.patientName}
                    </button>
                    {e.priority === "urgent" && <UrgentBadge />}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {e.appointmentTime ? `RDV à ${e.appointmentTime} · ` : ""}
                    Arrivé il y a {formatWait(waitingMinutes(e.arrivedAt))}
                  </p>
                </div>
                <button
                  onClick={() => removeEntry.mutate(e.id)}
                  disabled={removeEntry.isPending}
                  title="Patient parti"
                  className="w-9 h-9 rounded-xl border border-border hover:bg-red-50 hover:border-red-200 hover:text-red-500 dark:hover:bg-red-950 dark:hover:border-red-800 dark:hover:text-red-400 text-muted-foreground flex items-center justify-center transition-colors disabled:opacity-50 flex-shrink-0">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>

              {isDoctor && (
                <div className="flex gap-2 mt-4 pt-3 border-t border-border/40 flex-wrap">
                  <button
                    onClick={() => finishConsultation(e)}
                    disabled={updateStatus.isPending}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors disabled:opacity-50 flex-shrink-0">
                    <CheckCircle className="w-3.5 h-3.5" /> Terminer
                  </button>
                  {waiting.length > 0 && (
                    <button
                      onClick={() => finishAndCallNext(e)}
                      disabled={updateStatus.isPending}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl gradient-primary text-white text-xs font-semibold transition-colors disabled:opacity-50 flex-shrink-0">
                      <SkipForward className="w-3.5 h-3.5" /> Terminer &amp; Suivant
                    </button>
                  )}
                </div>
              )}

              {!isDoctor && (
                <div className="mt-3 pt-3 border-t border-border/40">
                  <button
                    onClick={() => updateStatus.mutate({ id: e.id, status: "done" })}
                    disabled={updateStatus.isPending}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                    <CheckCircle className="w-4 h-4" /> Terminer
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* ── File d'attente ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm text-foreground">
              File d&apos;attente
              <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 text-xs font-bold">
                {waiting.length}
              </span>
            </h3>
            <button onClick={() => setAddOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-border hover:border-primary/50 hover:bg-primary/5 text-muted-foreground hover:text-primary transition-all text-xs font-semibold">
              <UserPlus className="w-3.5 h-3.5" /> Ajouter
            </button>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <div key={i} className="bg-card border border-border rounded-2xl h-20 animate-pulse" />)}
            </div>
          ) : waiting.length === 0 ? (
            <div className="py-12 text-center bg-card border border-border rounded-2xl">
              <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="font-semibold text-foreground">File vide</p>
              <p className="text-sm text-muted-foreground mt-1">Aucun patient en attente</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {waiting.map((e, i) => {
                const mins = waitingMinutes(e.arrivedAt);
                const isFirst = i === 0;
                const noDoctor = false;
                return (
                  <div key={e.id} className={cn(
                    "bg-card border border-border rounded-2xl p-4 flex items-center gap-3 transition-all",
                    isFirst && "ring-2 ring-primary/20 border-primary/30"
                  )}>
                    <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0",
                      isFirst ? "gradient-primary text-white shadow-sm" : "bg-muted text-muted-foreground")}>
                      {i + 1}
                    </div>
                    <Avatar name={e.patientName} idx={i} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => router.push(`/patients/${e.patientId}`)}
                          className="text-sm font-semibold text-foreground hover:text-primary hover:underline transition-colors text-left truncate">
                          {e.patientName}
                        </button>
                        {e.priority === "urgent" && <UrgentBadge />}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        {e.appointmentTime && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {e.appointmentTime}
                          </span>
                        )}
                        <span className={cn("text-xs font-medium",
                          mins > 30 ? "text-red-500" : mins > 15 ? "text-amber-500" : "text-muted-foreground")}>
                          Depuis {formatWait(mins)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => callPatient(e)}
                        disabled={updateStatus.isPending || noDoctor}
                        title={noDoctor ? "Aucun médecin disponible" : undefined}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all",
                          noDoctor
                            ? "opacity-50 cursor-not-allowed bg-muted text-muted-foreground"
                            : isFirst
                              ? "gradient-primary text-white hover:opacity-90 shadow-sm disabled:opacity-50"
                              : "border border-border hover:bg-accent text-foreground disabled:opacity-50"
                        )}>
                        <Stethoscope className="w-3.5 h-3.5" />
                        {isFirst ? "Faire entrer" : "Appeler"}
                      </button>
                      <button onClick={() => removeEntry.mutate(e.id)} disabled={removeEntry.isPending}
                        title="Retirer"
                        className="w-8 h-8 rounded-xl border border-border hover:bg-red-50 hover:border-red-200 hover:text-red-500 dark:hover:bg-red-950 dark:hover:border-red-800 dark:hover:text-red-400 text-muted-foreground flex items-center justify-center transition-colors disabled:opacity-50">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Rendez-vous d'aujourd'hui ── */}
        {enrichedAppts.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-sm text-foreground">Rendez-vous d&apos;aujourd&apos;hui</h3>
              </div>
            </div>

            <div className="flex gap-1.5 mb-3 bg-muted/40 rounded-xl p-1">
              {FILTER_TABS.map(tab => (
                <button key={tab.value} type="button" onClick={() => setApptFilter(tab.value)}
                  className={cn(
                    "flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap",
                    apptFilter === tab.value
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}>
                  {tab.label}
                  <span className={cn("ml-1 font-bold",
                    apptFilter === tab.value ? "text-primary" : "text-muted-foreground")}>
                    ({filterCounts[tab.value]})
                  </span>
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {filteredAppts.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground bg-card border border-border rounded-xl">
                  Aucun résultat
                </div>
              ) : (
                filteredAppts.map((a, i) => {
                  const wr = a.wrEntry;
                  return (
                    <div key={a.id} className={cn(
                      "bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3 transition-all",
                      wr && "opacity-70"
                    )}>
                      <div className="w-12 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-muted-foreground">{a.time}</span>
                      </div>
                      <Avatar name={a.patientName} idx={i} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{a.patientName}</p>
                        <p className="text-xs text-muted-foreground">{a.type}</p>
                      </div>

                      {/* ── Action buttons per RDV state ── */}
                      {!wr ? (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {/* Confirm arrival → add to queue */}
                          <button
                            onClick={() => addEntry.mutate({ patientId: a.patientId, priority: "normal", appointmentId: a.id })}
                            disabled={addEntry.isPending || cancelAppt.isPending}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-colors disabled:opacity-50"
                            title="Confirmer l'arrivée et ajouter à la file d'attente"
                          >
                            <ArrowRight className="w-3.5 h-3.5" /> Arrivé
                          </button>
                          {/* Cancel appointment */}
                          <button
                            onClick={() => {
                              if (confirm(`Annuler le RDV de ${a.patientName} ?`)) {
                                cancelAppt.mutate(a.id);
                              }
                            }}
                            disabled={addEntry.isPending || cancelAppt.isPending}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border hover:bg-red-50 hover:border-red-200 hover:text-red-500 dark:hover:bg-red-950 dark:hover:border-red-800 dark:hover:text-red-400 text-muted-foreground text-xs font-semibold transition-colors disabled:opacity-50"
                            title="Annuler ce rendez-vous"
                          >
                            <Ban className="w-3.5 h-3.5" /> Annuler
                          </button>
                        </div>
                      ) : wr.status === "waiting" ? (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="text-[10px] px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                            <Clock className="w-3 h-3" /> En file
                          </span>
                          {/* Allow calling from appointment row too */}
                          <button
                            onClick={() => callPatient(wr)}
                            disabled={updateStatus.isPending}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-950 text-emerald-700 dark:text-emerald-400 text-xs font-semibold transition-colors disabled:opacity-50"
                            title="Appeler ce patient"
                          >
                            <Stethoscope className="w-3.5 h-3.5" /> Appeler
                          </button>
                        </div>
                      ) : wr.status === "in_progress" ? (
                        <span className="text-[10px] px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 flex-shrink-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          En cours
                        </span>
                      ) : (
                        <span className="text-[10px] px-2.5 py-1 rounded-xl bg-muted text-muted-foreground font-semibold flex-shrink-0">
                          Terminé ✓
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ── Terminés ── */}
        {done.length > 0 && (
          <div>
            <button type="button" onClick={() => setShowDone(v => !v)}
              className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors mb-3">
              <ChevronDown className={cn("w-4 h-4 transition-transform", showDone && "rotate-180")} />
              Terminés depuis la file ({done.length})
            </button>
            {showDone && (
              <div className="space-y-2">
                {done.map((e, i) => (
                  <div key={e.id} className="bg-muted/30 border border-border rounded-2xl px-4 py-3 flex items-center gap-3 opacity-60">
                    <Avatar name={e.patientName} idx={i} size="sm" />
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => router.push(`/patients/${e.patientId}`)}
                        className="text-sm font-medium text-foreground hover:text-primary hover:underline transition-colors text-left truncate block w-full">
                        {e.patientName}
                      </button>
                      <p className="text-xs text-muted-foreground">
                        {e.assignedDoctorName ? `Dr. ${e.assignedDoctorName} · ` : ""}
                        Durée : {formatWait(waitingMinutes(e.arrivedAt))}
                      </p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 font-semibold">
                      Terminé ✓
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {addOpen && (
        <AddModal
          onClose={() => setAddOpen(false)}
          onAddExisting={(p, priority, visitType) => addEntry.mutate({ patientId: p.id, priority, visitType })}
          onCreateAndAdd={(f) => createAndAdd.mutate(f)}
        />
      )}

      {assigningEntry && (
        <DoctorSelectModal
          patientName={assigningEntry.patientName}
          availableDoctors={availableDoctors}
          allOnlineDoctors={onlineDoctors}
          onSelect={handleDoctorSelected}
          onClose={() => setAssigningEntry(null)}
        />
      )}
    </div>
  );
}
