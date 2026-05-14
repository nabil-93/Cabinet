"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import type { Locale } from "date-fns";
import {
  Plus, X, Trash2, Edit2, Check, AlertTriangle, Stethoscope,
  Pill, FileText, Calendar, Loader2, Upload, File, Image,
  FileAudio, Download, Syringe, ChevronDown, ChevronUp, Save,
} from "lucide-react";
import api from "@/services/api";
import { cn } from "@/lib/utils";
import { getToday } from "@/lib/date-utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Patient {
  id: string;
  fullName: string;
  allergies?: string[];
  medicalHistory?: string[];
  bloodType?: string;
  gender?: string;
  dateOfBirth?: string;
  phone?: string;
}

interface Consultation {
  id: string;
  date: string;
  diagnosis: string;
  treatment?: string;
  notes?: string;
  nextVisit?: string;
  createdAt?: string;
}

interface Medication {
  name: string;
  dosage?: string;
  duration?: string;
  instructions?: string;
}

interface Prescription {
  id: string;
  diagnosis?: string;
  medications: (Medication | string)[];
  notes?: string;
  status: "active" | "expired";
  createdAt?: string;
  date?: string;
}

interface PatientFile {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  category: string;
  size: number;
  label: string;
  url: string;
  createdAt: string;
}

interface DocTabProps {
  patientId: string;
  patient: Patient | undefined;
  consultations: Consultation[];
  prescriptions: Prescription[];
  dateLocale: Locale;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMedName(med: Medication | string): string {
  return typeof med === "string" ? med : (med.name ?? "—");
}
function getMedDetail(med: Medication | string): string {
  if (typeof med === "string") return "";
  return [med.dosage, med.duration, med.instructions].filter(Boolean).join(" · ");
}
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}
function FileIconComp({ category, mimeType }: { category: string; mimeType: string }) {
  if (category === "image" || mimeType.startsWith("image/"))
    return <Image className="w-4 h-4 text-blue-500 flex-shrink-0" />;
  if (category === "pdf")
    return <File className="w-4 h-4 text-red-500 flex-shrink-0" />;
  if (category === "audio" || mimeType.startsWith("audio/"))
    return <FileAudio className="w-4 h-4 text-purple-500 flex-shrink-0" />;
  return <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />;
}

// ─── Tag Input ─────────────────────────────────────────────────────────────────

function TagInput({ tags, onAdd, onRemove, placeholder, colorClass }: {
  tags: string[];
  onAdd: (v: string) => void;
  onRemove: (i: number) => void;
  placeholder: string;
  colorClass: string;
}) {
  const [input, setInput] = useState("");
  const add = () => {
    const v = input.trim();
    if (v && !tags.includes(v)) onAdd(v);
    setInput("");
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 min-h-[28px]">
        {tags.map((tag, i) => (
          <span key={i} className={cn("inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium", colorClass)}>
            {tag}
            <button onClick={() => onRemove(i)} className="hover:opacity-70 ml-0.5">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        {tags.length === 0 && <span className="text-xs text-muted-foreground italic">Aucun</span>}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="flex-1 px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
        />
        <button
          onClick={add}
          disabled={!input.trim()}
          className="px-2.5 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 disabled:opacity-40 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Consultation Form ────────────────────────────────────────────────────────

function ConsultationForm({ initial, onSubmit, onCancel, loading }: {
  initial?: Partial<Consultation>;
  onSubmit: (data: Partial<Consultation>) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [form, setForm] = useState({
    diagnosis: initial?.diagnosis ?? "",
    treatment: initial?.treatment ?? "",
    notes: initial?.notes ?? "",
    nextVisit: initial?.nextVisit ?? "",
    date: initial?.date ?? getToday(),
  });
  const set = (k: keyof typeof form) => (v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="bg-muted/20 rounded-xl border border-border p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Date</label>
          <input type="date" value={form.date} onChange={e => set("date")(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-card border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40" />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Prochain RDV</label>
          <input type="date" value={form.nextVisit} onChange={e => set("nextVisit")(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-card border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40" />
        </div>
      </div>
      <div>
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Diagnostic *</label>
        <input value={form.diagnosis} onChange={e => set("diagnosis")(e.target.value)}
          placeholder="Ex: Angine bactérienne, Hypertension..."
          className="w-full px-2.5 py-1.5 rounded-lg bg-card border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40" />
      </div>
      <div>
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Traitement</label>
        <input value={form.treatment} onChange={e => set("treatment")(e.target.value)}
          placeholder="Ex: Repos, Amoxicilline 1g x3/j..."
          className="w-full px-2.5 py-1.5 rounded-lg bg-card border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40" />
      </div>
      <div>
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Notes</label>
        <textarea value={form.notes} onChange={e => set("notes")(e.target.value)}
          rows={3} placeholder="Observations, remarques..."
          className="w-full px-2.5 py-1.5 rounded-lg bg-card border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none" />
      </div>
      <div className="flex gap-2">
        <button onClick={() => onSubmit(form)} disabled={!form.diagnosis.trim() || loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-40 transition-colors">
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          {initial?.id ? "Enregistrer" : "Créer le rapport"}
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors">
          Annuler
        </button>
      </div>
    </div>
  );
}

// ─── Medication Row ────────────────────────────────────────────────────────────

function MedRow({ med, onRemove }: { med: Medication; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2">
      <Syringe className="w-3 h-3 text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-xs font-semibold text-foreground">{med.name}</span>
        {(med.dosage || med.duration) && (
          <span className="text-[10px] text-muted-foreground ml-2">
            {[med.dosage, med.duration].filter(Boolean).join(" · ")}
          </span>
        )}
        {med.instructions && <p className="text-[10px] text-muted-foreground/70 italic">{med.instructions}</p>}
      </div>
      <button onClick={onRemove} className="text-red-400 hover:text-red-600 transition-colors flex-shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Prescription Form ────────────────────────────────────────────────────────

function PrescriptionForm({ onSubmit, onCancel, loading }: {
  onSubmit: (data: { diagnosis: string; medications: Medication[]; notes: string }) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [meds, setMeds] = useState<Medication[]>([]);
  const [medInput, setMedInput] = useState<Medication>({ name: "", dosage: "", duration: "", instructions: "" });

  const addMed = () => {
    if (!medInput.name.trim()) return;
    setMeds(prev => [...prev, { ...medInput }]);
    setMedInput({ name: "", dosage: "", duration: "", instructions: "" });
  };

  return (
    <div className="bg-muted/20 rounded-xl border border-border p-4 space-y-3">
      <div>
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Motif / Diagnostic</label>
        <input value={diagnosis} onChange={e => setDiagnosis(e.target.value)}
          placeholder="Ex: Angine, Infection respiratoire..."
          className="w-full px-2.5 py-1.5 rounded-lg bg-card border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40" />
      </div>

      {/* Medications list */}
      <div>
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-2">Médicaments *</label>
        <div className="space-y-2 mb-2">
          {meds.map((m, i) => <MedRow key={i} med={m} onRemove={() => setMeds(p => p.filter((_, j) => j !== i))} />)}
        </div>
        {/* New medication input */}
        <div className="bg-card border border-dashed border-border rounded-xl p-3 space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground">Ajouter un médicament</p>
          <div className="grid grid-cols-2 gap-2">
            <input value={medInput.name} onChange={e => setMedInput(p => ({ ...p, name: e.target.value }))}
              placeholder="Nom *" className="px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40" />
            <input value={medInput.dosage} onChange={e => setMedInput(p => ({ ...p, dosage: e.target.value }))}
              placeholder="Posologie (ex: 1g)" className="px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40" />
            <input value={medInput.duration} onChange={e => setMedInput(p => ({ ...p, duration: e.target.value }))}
              placeholder="Durée (ex: 7 jours)" className="px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40" />
            <input value={medInput.instructions} onChange={e => setMedInput(p => ({ ...p, instructions: e.target.value }))}
              placeholder="Instructions (ex: après repas)" className="px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40" />
          </div>
          <button onClick={addMed} disabled={!medInput.name.trim()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-primary/10 text-primary text-xs font-semibold rounded-lg hover:bg-primary/20 disabled:opacity-40 transition-colors">
            <Plus className="w-3 h-3" /> Ajouter ce médicament
          </button>
        </div>
      </div>

      <div>
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Notes</label>
        <input value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Instructions particulières..."
          className="w-full px-2.5 py-1.5 rounded-lg bg-card border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40" />
      </div>

      <div className="flex gap-2">
        <button onClick={() => onSubmit({ diagnosis, medications: meds, notes })}
          disabled={meds.length === 0 || loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-40 transition-colors">
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Créer l&apos;ordonnance
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors">
          Annuler
        </button>
      </div>
    </div>
  );
}

// ─── Main DocTab ──────────────────────────────────────────────────────────────

export function DocTab({ patientId, patient, consultations, prescriptions, dateLocale }: DocTabProps) {
  const qc = useQueryClient();

  // Patient edit state — reset when patient changes
  const [allergies, setAllergies] = useState<string[]>(
    Array.isArray(patient?.allergies) ? patient.allergies : []
  );
  const [antecedents, setAntecedents] = useState<string[]>(
    Array.isArray(patient?.medicalHistory) ? patient.medicalHistory : []
  );
  const [patientSaving, setPatientSaving] = useState(false);
  const [patientDirty, setPatientDirty] = useState(false);

  useEffect(() => {
    setAllergies(Array.isArray(patient?.allergies) ? patient.allergies : []);
    setAntecedents(Array.isArray(patient?.medicalHistory) ? patient.medicalHistory : []);
    setPatientDirty(false);
  }, [patientId, patient?.allergies, patient?.medicalHistory]);

  // Consultation state
  const [showNewConsult, setShowNewConsult] = useState(false);
  const [editingConsult, setEditingConsult] = useState<string | null>(null);
  const [consultLoading, setConsultLoading] = useState(false);
  const [deletingConsult, setDeletingConsult] = useState<string | null>(null);

  // Prescription state
  const [showNewRx, setShowNewRx] = useState(false);
  const [rxLoading, setRxLoading] = useState(false);
  const [deletingRx, setDeletingRx] = useState<string | null>(null);

  // File state
  const [showFiles, setShowFiles] = useState(true);
  const [fileUploading, setFileUploading] = useState(false);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Patient files query
  const { data: filesRaw, refetch: refetchFiles } = useQuery({
    queryKey: ["patient-files", patientId],
    queryFn: () => api.get(`/patient-files?patientId=${patientId}`).then(r => r.data?.data ?? r.data ?? []),
    enabled: !!patientId,
    staleTime: 30_000,
  });
  const files: PatientFile[] = Array.isArray(filesRaw) ? filesRaw : [];

  // ── Patient save ─────────────────────────────────────────────────────────

  const savePatient = async () => {
    setPatientSaving(true);
    try {
      await api.put(`/patients/${patientId}`, {
        allergies,
        medicalHistory: antecedents,
      });
      await qc.invalidateQueries({ queryKey: ["patient", patientId] });
      await qc.invalidateQueries({ queryKey: ["patients"] });
      setPatientDirty(false);
    } finally {
      setPatientSaving(false);
    }
  };

  const addAllergie = (v: string) => { setAllergies(p => [...p, v]); setPatientDirty(true); };
  const removeAllergie = (i: number) => { setAllergies(p => p.filter((_, j) => j !== i)); setPatientDirty(true); };
  const addAntecedent = (v: string) => { setAntecedents(p => [...p, v]); setPatientDirty(true); };
  const removeAntecedent = (i: number) => { setAntecedents(p => p.filter((_, j) => j !== i)); setPatientDirty(true); };

  // ── Consultation CRUD ─────────────────────────────────────────────────────

  const createConsult = async (data: Partial<Consultation>) => {
    setConsultLoading(true);
    try {
      await api.post("/consultations", { patientId, ...data });
      // Auto-create a follow-up appointment if nextVisit is specified
      if (data.nextVisit) {
        await api.post("/appointments", {
          patientId,
          date: data.nextVisit,
          time: "09:00",
          type: "Suivi",
          status: "pending",
          notes: `Suivi — consultation du ${data.date ?? getToday()}`,
        });
        // Invalidate all appointment-related queries so every section updates
        await qc.invalidateQueries({ queryKey: ["appointments"] });          // useAppointmentsByDate, useAppointments
        await qc.invalidateQueries({ queryKey: ["appointments-patient", patientId] }); // patient history in dashboard
      }
      await qc.invalidateQueries({ queryKey: ["consultations", patientId] });
      setShowNewConsult(false);
    } finally {
      setConsultLoading(false);
    }
  };

  const updateConsult = async (id: string, data: Partial<Consultation>) => {
    setConsultLoading(true);
    try {
      // Find old consultation to detect nextVisit change
      const oldConsult = consultations.find(c => c.id === id);
      const oldNextVisit = oldConsult?.nextVisit ?? null;
      const newNextVisit = data.nextVisit ?? null;

      await api.put(`/consultations/${id}`, data);

      // If nextVisit changed, update or create the linked appointment
      if (newNextVisit && newNextVisit !== oldNextVisit) {
        if (oldNextVisit) {
          // Try to find existing Suivi appointment on the old date for this patient
          try {
            const res = await api.get(`/appointments?patientId=${patientId}&date=${oldNextVisit}`);
            const apts: Array<{ id: string; type: string; notes?: string }> = res.data?.data ?? res.data ?? [];
            const suiviApt = apts.find(a => a.type === "Suivi" || a.notes?.includes("Suivi"));
            if (suiviApt) {
              // Update existing appointment to the new date
              await api.patch(`/appointments/${suiviApt.id}`, { date: newNextVisit });
            } else {
              // No linked appointment found, create a new one
              await api.post("/appointments", {
                patientId, date: newNextVisit, time: "09:00", type: "Suivi", status: "pending",
                notes: `Suivi — consultation du ${data.date ?? getToday()}`,
              });
            }
          } catch {
            // Fallback: create new
            await api.post("/appointments", {
              patientId, date: newNextVisit, time: "09:00", type: "Suivi", status: "pending",
              notes: `Suivi — consultation du ${data.date ?? getToday()}`,
            });
          }
        } else {
          // Was no nextVisit before — create appointment
          await api.post("/appointments", {
            patientId, date: newNextVisit, time: "09:00", type: "Suivi", status: "pending",
            notes: `Suivi — consultation du ${data.date ?? getToday()}`,
          });
        }
        await qc.invalidateQueries({ queryKey: ["appointments"] });
        await qc.invalidateQueries({ queryKey: ["appointments-patient", patientId] });
      }

      await qc.invalidateQueries({ queryKey: ["consultations", patientId] });
      setEditingConsult(null);
    } finally {
      setConsultLoading(false);
    }
  };

  const deleteConsult = async (id: string) => {
    if (!confirm("Supprimer ce rapport de consultation ?")) return;
    setDeletingConsult(id);
    try {
      await api.delete(`/consultations/${id}`);
      await qc.invalidateQueries({ queryKey: ["consultations", patientId] });
    } finally {
      setDeletingConsult(null);
    }
  };

  // ── Prescription CRUD ─────────────────────────────────────────────────────

  const createRx = async (data: { diagnosis: string; medications: Medication[]; notes: string }) => {
    setRxLoading(true);
    try {
      await api.post("/prescriptions", { patientId, ...data, date: getToday(), status: "active" });
      await qc.invalidateQueries({ queryKey: ["prescriptions", patientId] });
      setShowNewRx(false);
    } finally {
      setRxLoading(false);
    }
  };

  const deleteRx = async (id: string) => {
    if (!confirm("Supprimer cette ordonnance ?")) return;
    setDeletingRx(id);
    try {
      await api.delete(`/prescriptions/${id}`);
      await qc.invalidateQueries({ queryKey: ["prescriptions", patientId] });
    } finally {
      setDeletingRx(null);
    }
  };

  // ── File upload ───────────────────────────────────────────────────────────

  const uploadFile = async (file: File) => {
    setFileUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("patientId", patientId);
      fd.append("label", file.name);
      await api.post("/patient-files", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await refetchFiles();
    } finally {
      setFileUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const deleteFile = async (id: string) => {
    if (!confirm("Supprimer ce fichier ?")) return;
    setDeletingFile(id);
    try {
      await api.delete(`/patient-files/${id}`);
      await refetchFiles();
    } finally {
      setDeletingFile(null);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ── Allergies & Antécédents ── */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <h3 className="text-sm font-semibold text-foreground">Données médicales critiques</h3>
          </div>
          {patientDirty && (
            <button onClick={savePatient} disabled={patientSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors">
              {patientSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Enregistrer
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wide mb-2">Allergies</p>
            <TagInput
              tags={allergies}
              onAdd={addAllergie}
              onRemove={removeAllergie}
              placeholder="Ajouter une allergie..."
              colorClass="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
            />
          </div>
          <div>
            <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-2">Antécédents médicaux</p>
            <TagInput
              tags={antecedents}
              onAdd={addAntecedent}
              onRemove={removeAntecedent}
              placeholder="Ajouter un antécédent..."
              colorClass="bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
            />
          </div>
        </div>

        {patient?.bloodType && (
          <div className="flex items-center gap-2 pt-2 border-t border-border/60">
            <span className="text-[10px] text-muted-foreground">Groupe sanguin:</span>
            <span className="text-sm font-bold text-red-600 dark:text-red-400">{patient.bloodType}</span>
          </div>
        )}
      </div>

      {/* ── Consultations ── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Consultations</h3>
            <span className="text-[10px] text-muted-foreground">{consultations.length} rapport{consultations.length !== 1 ? "s" : ""}</span>
          </div>
          <button
            onClick={() => { setShowNewConsult(v => !v); setEditingConsult(null); }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors",
              showNewConsult ? "bg-muted text-foreground" : "bg-primary/10 text-primary hover:bg-primary/20"
            )}>
            {showNewConsult ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
            {showNewConsult ? "Annuler" : "Nouveau rapport"}
          </button>
        </div>

        <div className="p-4 space-y-3">
          {showNewConsult && (
            <ConsultationForm
              onSubmit={createConsult}
              onCancel={() => setShowNewConsult(false)}
              loading={consultLoading}
            />
          )}

          {consultations.length === 0 && !showNewConsult ? (
            <div className="py-8 text-center">
              <FileText className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Aucune consultation enregistrée</p>
            </div>
          ) : (
            consultations.map((c, i) => (
              <div key={c.id}>
                {editingConsult === c.id ? (
                  <ConsultationForm
                    initial={c}
                    onSubmit={(data) => updateConsult(c.id, data)}
                    onCancel={() => setEditingConsult(null)}
                    loading={consultLoading}
                  />
                ) : (
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className="w-2.5 h-2.5 rounded-full mt-1 bg-primary/60" />
                      {i < consultations.length - 1 && <div className="w-px flex-1 bg-border/60 mt-1 min-h-[20px]" />}
                    </div>
                    <div className="flex-1 bg-muted/30 rounded-xl p-3 mb-1 group">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground">{c.diagnosis}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {c.date ? format(new Date(c.date), "d MMM yyyy", { locale: dateLocale }) : "—"}
                          </p>
                          {c.treatment && (
                            <p className="text-[10px] text-muted-foreground mt-1">
                              <span className="font-medium">Traitement:</span> {c.treatment}
                            </p>
                          )}
                          {c.notes && <p className="text-[10px] text-muted-foreground/70 italic mt-1 line-clamp-2">{c.notes}</p>}
                          {c.nextVisit && (
                            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                              <Calendar className="w-2.5 h-2.5" />
                              Prochain RDV: {format(new Date(c.nextVisit), "d MMM yyyy", { locale: dateLocale })}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => setEditingConsult(c.id)}
                            className="w-7 h-7 rounded-lg bg-primary/5 hover:bg-primary/15 text-primary flex items-center justify-center transition-colors border border-primary/20"
                            title="Modifier">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => deleteConsult(c.id)}
                            disabled={deletingConsult === c.id}
                            className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-950/30 hover:bg-red-100 text-red-500 hover:text-red-700 flex items-center justify-center transition-colors disabled:opacity-50 border border-red-200 dark:border-red-800"
                            title="Supprimer">
                            {deletingConsult === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Ordonnances ── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Pill className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Ordonnances</h3>
            <span className="text-[10px] text-muted-foreground">{prescriptions.length} ordonnance{prescriptions.length !== 1 ? "s" : ""}</span>
          </div>
          <button
            onClick={() => setShowNewRx(v => !v)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors",
              showNewRx ? "bg-muted text-foreground" : "bg-primary/10 text-primary hover:bg-primary/20"
            )}>
            {showNewRx ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
            {showNewRx ? "Annuler" : "Nouvelle ordonnance"}
          </button>
        </div>

        <div className="p-4 space-y-3">
          {showNewRx && (
            <PrescriptionForm
              onSubmit={createRx}
              onCancel={() => setShowNewRx(false)}
              loading={rxLoading}
            />
          )}

          {prescriptions.length === 0 && !showNewRx ? (
            <div className="py-8 text-center">
              <Pill className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Aucune ordonnance</p>
            </div>
          ) : (
            prescriptions.map(rx => {
              const meds = Array.isArray(rx.medications) ? rx.medications : [];
              const isActive = rx.status === "active";
              return (
                <div key={rx.id} className="bg-muted/30 rounded-xl p-3 group">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {meds.map((m, i) => (
                          <span key={i} className="text-xs font-semibold text-foreground">{getMedName(m)}</span>
                        ))}
                        <span className={cn(
                          "text-[9px] font-bold px-1.5 py-0.5 rounded-full",
                          isActive
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400"
                        )}>
                          {isActive ? "Active" : "Expirée"}
                        </span>
                      </div>
                      {meds.map((m, i) => {
                        const detail = getMedDetail(m);
                        return detail ? (
                          <p key={i} className="text-[10px] text-muted-foreground">{getMedName(m)}: {detail}</p>
                        ) : null;
                      })}
                      {rx.diagnosis && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">Motif: {rx.diagnosis}</p>
                      )}
                      {rx.notes && <p className="text-[10px] text-muted-foreground/70 italic mt-0.5">{rx.notes}</p>}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Prescrit le{" "}
                        {(rx.date || rx.createdAt)
                          ? format(new Date(rx.date ?? rx.createdAt!), "d MMM yyyy", { locale: dateLocale })
                          : "—"}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteRx(rx.id)}
                      disabled={deletingRx === rx.id}
                      className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-500 hover:text-red-700 flex items-center justify-center transition-colors disabled:opacity-50 flex-shrink-0 border border-red-200 dark:border-red-800">
                      {deletingRx === rx.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Fichiers ── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <button
          onClick={() => setShowFiles(v => !v)}
          className="w-full px-4 py-3 border-b border-border/60 flex items-center justify-between hover:bg-accent/30 transition-colors">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Fichiers</h3>
            <span className="text-[10px] text-muted-foreground">{files.length} fichier{files.length !== 1 ? "s" : ""}</span>
          </div>
          {showFiles ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>

        {showFiles && (
          <div className="p-4 space-y-3">
            {/* Upload zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-xl p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all group"
            >
              {fileUploading ? (
                <div className="flex items-center justify-center gap-2 text-primary">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-xs font-medium">Envoi en cours...</span>
                </div>
              ) : (
                <>
                  <Upload className="w-5 h-5 text-muted-foreground/50 group-hover:text-primary mx-auto mb-1 transition-colors" />
                  <p className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                    Cliquer pour uploader un fichier
                  </p>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">PDF, images, documents · max 10 Mo</p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt,.csv,.mp3,.wav,.ogg,.webm"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) uploadFile(file);
                }}
              />
            </div>

            {/* Files list */}
            {files.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-4">Aucun fichier uploadé</p>
            ) : (
              <div className="space-y-2">
                {files.map(f => (
                  <div key={f.id} className="flex items-center gap-3 bg-muted/30 rounded-xl px-3 py-2.5 group">
                    <FileIconComp category={f.category} mimeType={f.mimeType} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{f.originalName || f.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatSize(f.size)} · {f.createdAt ? format(new Date(f.createdAt), "d MMM yyyy", { locale: dateLocale }) : "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <a href={f.url} target="_blank" rel="noopener noreferrer"
                        className="w-6 h-6 rounded-lg hover:bg-primary/10 text-primary flex items-center justify-center transition-colors"
                        title="Télécharger">
                        <Download className="w-3 h-3" />
                      </a>
                      <button
                        onClick={() => deleteFile(f.id)}
                        disabled={deletingFile === f.id}
                        className="w-6 h-6 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-red-400 hover:text-red-600 flex items-center justify-center transition-colors disabled:opacity-50"
                        title="Supprimer">
                        {deletingFile === f.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
