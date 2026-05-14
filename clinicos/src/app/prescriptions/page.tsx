"use client";
import { useState, useRef, useEffect } from "react";
import {
  FileText, Plus, Search, Download, Pill, X, Stethoscope,
  Calendar, ChevronRight, CheckCircle, Pencil, Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import Header from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Prescription, Medication } from "@/types";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { prescriptionsService, type CreatePrescriptionDTO } from "@/services/prescriptions.service";
import api from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PatientOption { id: string; fullName: string; phone?: string; }
interface TodayAppt { id: string; patientId: string; patientName: string; time: string; type: string; }

// ─── Constants ────────────────────────────────────────────────────────────────

const TODAY = format(new Date(), "yyyy-MM-dd");
const PRES_KEY = ["prescriptions"] as const;

const FREQ_OPTIONS = ["1×/jour", "2×/jour", "3×/jour", "Matin-Soir", "Matin-Midi-Soir", "Si besoin", "Le soir", "À jeun"];
const DUR_OPTIONS  = ["3 jours", "5 jours", "7 jours", "10 jours", "14 jours", "1 mois", "3 mois", "À vie"];

function emptyMed(): Medication {
  return { name: "", dosage: "", frequency: "1×/jour", duration: "7 jours", instructions: "" };
}

// ─── PDF download ─────────────────────────────────────────────────────────────

async function downloadPrescriptionPDF(prx: Prescription) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 18;

  // Header
  doc.setFillColor(98, 114, 245);
  doc.rect(0, 0, W, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18); doc.setFont("helvetica", "bold");
  doc.text("ORDONNANCE MÉDICALE", W / 2, 13, { align: "center" });
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  doc.text("Cabinet Médical ClinicOS · Casablanca, Maroc", W / 2, 21, { align: "center" });
  doc.text(`Date : ${format(new Date(prx.date), "d MMMM yyyy", { locale: fr })}`, W / 2, 27, { align: "center" });

  // Doctor + Patient
  let y = 42;
  doc.setFillColor(245, 246, 255);
  doc.roundedRect(M, y, 80, 24, 3, 3, "F");
  doc.roundedRect(W - M - 80, y, 80, 24, 3, 3, "F");

  doc.setFontSize(7); doc.setTextColor(98, 114, 245); doc.setFont("helvetica", "bold");
  doc.text("MÉDECIN PRESCRIPTEUR", M + 4, y + 5);
  doc.setFontSize(10); doc.setTextColor(30, 30, 50); doc.setFont("helvetica", "bold");
  doc.text(prx.doctorName, M + 4, y + 13);
  doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 100, 120);
  doc.text("Médecin généraliste", M + 4, y + 19);

  doc.setFontSize(7); doc.setTextColor(98, 114, 245); doc.setFont("helvetica", "bold");
  doc.text("PATIENT", W - M - 76, y + 5);
  doc.setFontSize(10); doc.setTextColor(30, 30, 50); doc.setFont("helvetica", "bold");
  doc.text(prx.patientName, W - M - 76, y + 13);

  // Diagnosis
  y += 32;
  doc.setFillColor(98, 114, 245);
  doc.roundedRect(M, y, W - M * 2, 10, 2, 2, "F");
  doc.setFontSize(9); doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold");
  doc.text(`Diagnostic : ${prx.diagnosis}`, M + 4, y + 7);

  // Medications
  y += 16;
  doc.setFontSize(10); doc.setTextColor(30, 30, 50); doc.setFont("helvetica", "bold");
  doc.text("Médicaments prescrits :", M, y);
  y += 6;

  prx.medications.forEach((med, i) => {
    if (y > 255) { doc.addPage(); y = 20; }
    doc.setFillColor(i % 2 === 0 ? 248 : 255, i % 2 === 0 ? 249 : 255, 255);
    doc.roundedRect(M, y, W - M * 2, 22, 2, 2, "F");
    doc.setDrawColor(220, 220, 240); doc.setLineWidth(0.3);
    doc.roundedRect(M, y, W - M * 2, 22, 2, 2, "S");

    doc.setFontSize(10); doc.setTextColor(30, 30, 50); doc.setFont("helvetica", "bold");
    doc.text(`${i + 1}. ${med.name}`, M + 4, y + 7);
    doc.setFontSize(8); doc.setTextColor(98, 114, 245); doc.setFont("helvetica", "bold");
    doc.text(med.dosage, W - M - 4, y + 7, { align: "right" });

    doc.setFontSize(8); doc.setTextColor(100, 100, 120); doc.setFont("helvetica", "normal");
    doc.text(`Fréquence : ${med.frequency}`, M + 4, y + 14);
    doc.text(`Durée : ${med.duration}`, M + 60, y + 14);
    if (med.instructions) doc.text(`Note : ${med.instructions}`, M + 4, y + 19);
    y += 26;
  });

  // Notes
  if (prx.notes) {
    y += 4;
    doc.setFillColor(255, 251, 235);
    doc.roundedRect(M, y, W - M * 2, 16, 2, 2, "F");
    doc.setFontSize(8); doc.setTextColor(146, 64, 14); doc.setFont("helvetica", "bold");
    doc.text("Notes :", M + 4, y + 6);
    doc.setFont("helvetica", "normal");
    doc.text(prx.notes.slice(0, 100), M + 4, y + 12);
    y += 20;
  }

  // Signature
  const sigY = Math.max(y + 10, 230);
  doc.setDrawColor(180, 180, 200); doc.setLineWidth(0.5);
  doc.line(W - M - 60, sigY, W - M, sigY);
  doc.setFontSize(8); doc.setTextColor(100, 100, 120); doc.setFont("helvetica", "normal");
  doc.text("Signature du médecin", W - M - 30, sigY + 5, { align: "center" });
  doc.text(prx.doctorName, W - M - 30, sigY + 10, { align: "center" });

  // Footer
  doc.setFillColor(98, 114, 245); doc.rect(0, 287, W, 10, "F");
  doc.setFontSize(7.5); doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "normal");
  doc.text(`Ordonnance générée par ClinicOS · ${format(new Date(), "d MMMM yyyy", { locale: fr })}`, W / 2, 293, { align: "center" });

  doc.save(`Ordonnance-${prx.patientName}-${prx.date}.pdf`);
}

// ─── Medication row ────────────────────────────────────────────────────────────

function MedRow({ med, idx, onChange, onRemove }: {
  med: Medication; idx: number;
  onChange: (idx: number, m: Medication) => void;
  onRemove: (idx: number) => void;
}) {
  const { t } = useLang();
  const set = (k: keyof Medication, v: string) => onChange(idx, { ...med, [k]: v });
  const inputCls = "w-full px-2 py-1.5 rounded-lg border border-border bg-background/50 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary";
  const FREQ_LABELS: Record<string, string> = {
    "1×/jour": t("prescriptions.frequencies.once"), "2×/jour": t("prescriptions.frequencies.twice"),
    "3×/jour": t("prescriptions.frequencies.three"), "Matin et soir": t("prescriptions.frequencies.morningEvening"),
    "Le matin": t("prescriptions.frequencies.morning"), "Le soir": t("prescriptions.frequencies.evening"),
    "Si besoin": t("prescriptions.frequencies.asNeeded"),
  };
  const DUR_LABELS: Record<string, string> = {
    "3 jours": t("prescriptions.durations.d3"), "5 jours": t("prescriptions.durations.d5"),
    "7 jours": t("prescriptions.durations.d7"), "10 jours": t("prescriptions.durations.d10"),
    "14 jours": t("prescriptions.durations.d14"), "1 mois": t("prescriptions.durations.m1"),
    "3 mois": t("prescriptions.durations.m3"), "À vie": t("prescriptions.durations.forever"),
  };
  return (
    <div className="bg-muted/20 border border-border rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">{idx + 1}</div>
        <input value={med.name} onChange={e => set("name", e.target.value)} placeholder={t("prescriptions.medicationName")}
          className={cn(inputCls, "flex-1 font-semibold")} />
        <input value={med.dosage} onChange={e => set("dosage", e.target.value)} placeholder={t("prescriptions.dosage")}
          className={cn(inputCls, "w-28")} />
        <button type="button" onClick={() => onRemove(idx)}
          className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-red-100 text-muted-foreground hover:text-red-500 transition-all flex-shrink-0">
          <X className="w-3 h-3" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] text-muted-foreground mb-0.5 block">{t("prescriptions.frequency")}</label>
          <select value={med.frequency} onChange={e => set("frequency", e.target.value)} className={inputCls}>
            {FREQ_OPTIONS.map(f => <option key={f} value={f}>{FREQ_LABELS[f] ?? f}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground mb-0.5 block">{t("prescriptions.duration")}</label>
          <select value={med.duration} onChange={e => set("duration", e.target.value)} className={inputCls}>
            {DUR_OPTIONS.map(d => <option key={d} value={d}>{DUR_LABELS[d] ?? d}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground mb-0.5 block">{t("prescriptions.instructionsLabel")}</label>
          <input value={med.instructions || ""} onChange={e => set("instructions", e.target.value)}
            placeholder={t("prescriptions.instructions")} className={inputCls} />
        </div>
      </div>
    </div>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function EditPrescriptionModal({ prescription, onClose }: {
  prescription: Prescription;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { t } = useLang();
  const [diagnosis, setDiagnosis] = useState(prescription.diagnosis);
  const [notes, setNotes] = useState(prescription.notes || "");
  const [meds, setMeds] = useState<Medication[]>(
    prescription.medications.length > 0 ? prescription.medications : [emptyMed()]
  );

  const mutation = useMutation({
    mutationFn: (data: { diagnosis?: string; medications?: any[]; notes?: string }) =>
      prescriptionsService.update(prescription.id, data),
    onSuccess: (updated) => {
      qc.setQueryData<Prescription[]>(PRES_KEY, old =>
        (old ?? []).map(p => p.id === updated.id ? updated : p)
      );
      toast.success("Ordonnance mise à jour !");
      onClose();
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!diagnosis.trim()) { toast.error("Le diagnostic est requis"); return; }
    const validMeds = meds.filter(m => m.name.trim());
    if (validMeds.length === 0) { toast.error("Ajoutez au moins un médicament"); return; }
    mutation.mutate({ diagnosis, medications: validMeds, notes: notes || undefined });
  }

  const updateMed = (idx: number, m: Medication) => setMeds(prev => prev.map((x, i) => i === idx ? m : x));
  const removeMed = (idx: number) => setMeds(prev => prev.filter((_, i) => i !== idx));
  const addMed = () => setMeds(prev => [...prev, emptyMed()]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scroll">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center">
              <Pencil className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-base font-bold text-foreground">{t("prescriptions.editPrescriptionTitle")}</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">{t("prescriptions.diagnosisLabel")} *</label>
            <input value={diagnosis} onChange={e => setDiagnosis(e.target.value)} required
              placeholder={t("prescriptions.diagnosisPlaceholder")}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Pill className="w-3.5 h-3.5" /> {t("prescriptions.medicationsLabel")} *
              </label>
              <button type="button" onClick={addMed}
                className="flex items-center gap-1 text-xs text-primary hover:underline font-semibold">
                <Plus className="w-3.5 h-3.5" /> {t("prescriptions.addMedication")}
              </button>
            </div>
            <div className="space-y-2">
              {meds.map((med, idx) => (
                <MedRow key={idx} med={med} idx={idx} onChange={updateMed} onRemove={removeMed} />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">{t("prescriptions.notesLabel")}</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder={t("prescriptions.notesPlaceholder")}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-accent transition-all">
              {t("common.cancel")}
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 py-2.5 rounded-xl gradient-primary text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50">
              {mutation.isPending ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Create Modal ─────────────────────────────────────────────────────────────

function CreateModal({ initialPatient, onClose, doctorId }: {
  initialPatient?: PatientOption | null;
  onClose: () => void;
  doctorId?: string;
}) {
  const qc = useQueryClient();
  const { t } = useLang();
  const [patientQuery, setPatientQuery] = useState(initialPatient?.fullName || "");
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(initialPatient || null);
  const [showDrop, setShowDrop] = useState(false);
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [meds, setMeds] = useState<Medication[]>([emptyMed()]);
  const dropRef = useRef<HTMLDivElement>(null);

  const { data: suggestions = [] } = useQuery<PatientOption[]>({
    queryKey: ["patients-search-prx", patientQuery],
    queryFn: async () => {
      if (patientQuery.length < 1) return [];
      const r = await api.get(`/patients/search?q=${encodeURIComponent(patientQuery)}&limit=8`);
      return r.data.map((p: any) => ({ id: p.id, fullName: p.fullName, phone: p.phone }));
    },
    enabled: patientQuery.length >= 1 && !selectedPatient,
    staleTime: 10_000,
  });

  useEffect(() => {
    const h = (e: MouseEvent) => { if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowDrop(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const mutation = useMutation({
    mutationFn: (dto: CreatePrescriptionDTO) => prescriptionsService.create(dto),
    onSuccess: (newPrx) => {
      qc.setQueryData<Prescription[]>(PRES_KEY, old => [newPrx, ...(old ?? [])]);
      toast.success("Ordonnance créée !");
      onClose();
    },
    onError: () => toast.error("Erreur lors de la création"),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPatient) { toast.error("Sélectionnez un patient"); return; }
    if (!diagnosis.trim()) { toast.error("Le diagnostic est requis"); return; }
    const validMeds = meds.filter(m => m.name.trim());
    if (validMeds.length === 0) { toast.error("Ajoutez au moins un médicament"); return; }
    mutation.mutate({ patientId: selectedPatient.id, diagnosis, medications: validMeds, notes: notes || undefined, doctorId });
  }

  const updateMed = (idx: number, m: Medication) => setMeds(prev => prev.map((x, i) => i === idx ? m : x));
  const removeMed = (idx: number) => setMeds(prev => prev.filter((_, i) => i !== idx));
  const addMed = () => setMeds(prev => [...prev, emptyMed()]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scroll">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-base font-bold text-foreground">{t("prescriptions.newPrescriptionTitle")}</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Patient */}
          <div ref={dropRef} className="relative">
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">{t("prescriptions.patientLabel")} *</label>
            {selectedPatient ? (
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-primary/30 bg-primary/5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center text-white text-[9px] font-bold">
                    {selectedPatient.fullName.split(" ").map(w => w[0]).join("").slice(0, 2)}
                  </div>
                  <span className="text-sm font-semibold text-foreground">{selectedPatient.fullName}</span>
                </div>
                <button type="button" onClick={() => { setSelectedPatient(null); setPatientQuery(""); }}
                  className="text-muted-foreground hover:text-red-500 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <input value={patientQuery} onChange={e => { setPatientQuery(e.target.value); setShowDrop(true); }}
                  onFocus={() => setShowDrop(true)}
                  placeholder={t("prescriptions.searchPatient")}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                {showDrop && suggestions.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                    {suggestions.map(p => (
                      <button key={p.id} type="button"
                        onClick={() => { setSelectedPatient(p); setShowDrop(false); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-accent transition-all">
                        <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                          {p.fullName.split(" ").map((w: string) => w[0]).join("").slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{p.fullName}</p>
                          {p.phone && <p className="text-xs text-muted-foreground">{p.phone}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Diagnosis */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">{t("prescriptions.diagnosisLabel")} *</label>
            <input value={diagnosis} onChange={e => setDiagnosis(e.target.value)} required
              placeholder={t("prescriptions.diagnosisPlaceholder")}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
          </div>

          {/* Medications */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Pill className="w-3.5 h-3.5" /> {t("prescriptions.medicationsLabel")} *
              </label>
              <button type="button" onClick={addMed}
                className="flex items-center gap-1 text-xs text-primary hover:underline font-semibold">
                <Plus className="w-3.5 h-3.5" /> {t("prescriptions.addMedication")}
              </button>
            </div>
            <div className="space-y-2">
              {meds.map((med, idx) => (
                <MedRow key={idx} med={med} idx={idx} onChange={updateMed} onRemove={removeMed} />
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">{t("prescriptions.notesLabel")}</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder={t("prescriptions.notesPlaceholder")}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-accent transition-all">
              {t("common.cancel")}
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 py-2.5 rounded-xl gradient-primary text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50">
              {mutation.isPending ? t("common.creating") : t("prescriptions.createBtn")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PrescriptionsPage() {
  const { t } = useLang();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Prescription | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [quickPatient, setQuickPatient] = useState<PatientOption | null>(null);
  const [editTarget, setEditTarget] = useState<Prescription | null>(null);

  const { data: prescriptions = [] } = useQuery<Prescription[]>({
    queryKey: PRES_KEY,
    queryFn: prescriptionsService.getAll,
    staleTime: 30_000,
  });

  const { data: todayAppts = [] } = useQuery<TodayAppt[]>({
    queryKey: ["appointments-today-prx"],
    queryFn: async () => {
      const r = await api.get(`/appointments?date=${TODAY}`);
      return (r.data as any[])
        .filter((a: any) => a.status !== "cancelled")
        .map((a: any) => ({ id: a.id, patientId: a.patientId, patientName: a.patientName, time: a.time, type: a.type }))
        .sort((a: any, b: any) => a.time.localeCompare(b.time));
    },
    staleTime: 60_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => prescriptionsService.deletePrescription(id),
    onSuccess: (_data, id) => {
      qc.setQueryData<Prescription[]>(PRES_KEY, old => (old ?? []).filter(p => p.id !== id));
      if (selected?.id === id) setSelected(null);
      toast.success("Ordonnance supprimée");
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  function handleDelete(prx: Prescription) {
    if (!confirm(`Supprimer l'ordonnance de ${prx.patientName} ?`)) return;
    deleteMutation.mutate(prx.id);
  }

  function openEdit(prx: Prescription, e?: React.MouseEvent) {
    e?.stopPropagation();
    setEditTarget(prx);
  }

  function openDelete(prx: Prescription, e?: React.MouseEvent) {
    e?.stopPropagation();
    handleDelete(prx);
  }

  const filtered = prescriptions.filter(p =>
    search === "" ||
    p.patientName?.toLowerCase().includes(search.toLowerCase()) ||
    p.diagnosis?.toLowerCase().includes(search.toLowerCase())
  );

  function openQuick(appt: TodayAppt) {
    setQuickPatient({ id: appt.patientId, fullName: appt.patientName });
    setShowCreate(true);
  }

  return (
    <div className="flex flex-col h-full">
      <Header title={t("prescriptions.title")} subtitle={t("prescriptions.subtitle").replace("{count}", String(prescriptions.length))} />

      <div className="flex-1 overflow-auto custom-scroll p-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 h-full min-h-0">

          {/* ── Left panel ── */}
          <div className="lg:col-span-2 flex flex-col gap-3 min-h-0">

            {/* Toolbar */}
            <div className="bg-card border border-border rounded-xl p-3 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("prescriptions.searchPlaceholder")}
                  className="w-full pl-8 pr-3 py-2 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
              </div>
              <button onClick={() => { setQuickPatient(null); setShowCreate(true); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl gradient-primary text-white text-xs font-semibold hover:opacity-90 transition-all shadow-sm flex-shrink-0">
                <Plus className="w-3.5 h-3.5" /> {t("prescriptions.new")}
              </button>
            </div>

            {/* Today's patients */}
            {todayAppts.length > 0 && (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/50 bg-muted/20">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-bold text-foreground">Patients d&apos;aujourd&apos;hui</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">{todayAppts.length} RDV</span>
                </div>
                <div className="divide-y divide-border/30 max-h-48 overflow-y-auto custom-scroll">
                  {todayAppts.map(appt => (
                    <div key={appt.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent/50 transition-all">
                      <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                        {appt.patientName.split(" ").map(w => w[0]).join("").slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{appt.patientName}</p>
                        <p className="text-[10px] text-muted-foreground">{appt.time} · {appt.type}</p>
                      </div>
                      <button onClick={() => openQuick(appt)}
                        title="Créer une ordonnance"
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-primary hover:bg-primary/10 transition-all flex-shrink-0">
                        <FileText className="w-3 h-3" />
                        <span>Ordonnance</span>
                        <ChevronRight className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Prescriptions list */}
            <div className="flex-1 space-y-2 overflow-y-auto custom-scroll">
              {filtered.length === 0 ? (
                <div className="py-10 text-center bg-card border border-border rounded-xl">
                  <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Aucune ordonnance</p>
                </div>
              ) : (
                filtered.map(prx => (
                  <div key={prx.id} onClick={() => setSelected(prx)}
                    className={cn(
                      "bg-card border border-border rounded-xl p-4 cursor-pointer transition-all hover:shadow-sm",
                      selected?.id === prx.id && "ring-2 ring-primary/40 border-primary/30"
                    )}>
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0 text-white text-[10px] font-bold shadow-sm">
                        {prx.patientName.split(" ").map(w => w[0]).join("").slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-xs font-semibold text-foreground truncate">{prx.patientName}</p>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                              prx.status === "active" ? "badge-confirmed" : "badge-cancelled")}>
                              {prx.status === "active" ? t("prescriptions.status.active") : t("prescriptions.status.expired")}
                            </span>
                            <button
                              onClick={e => openEdit(prx, e)}
                              title="Modifier"
                              className="w-5 h-5 flex items-center justify-center rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all">
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              onClick={e => openDelete(prx, e)}
                              title="Supprimer"
                              className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-100 text-muted-foreground hover:text-red-500 transition-all">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{prx.diagnosis}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-muted-foreground/70">
                            {format(new Date(prx.date), "d MMM yyyy", { locale: fr })}
                          </span>
                          <span className="text-[10px] text-muted-foreground/50">·</span>
                          <span className="text-[10px] text-muted-foreground/70">
                            {t("prescriptions.medicationCount").replace("{count}", String(prx.medications.length))}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── Right panel: detail ── */}
          <div className="lg:col-span-3">
            {selected ? (
              <div className="bg-card border border-border rounded-xl p-6 h-full overflow-y-auto custom-scroll">
                {/* Header */}
                <div className="flex items-start justify-between mb-5 pb-5 border-b border-border/50">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <Stethoscope className="w-3.5 h-3.5" />
                      <span>Ordonnance médicale</span>
                      <span className={cn("ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold",
                        selected.status === "active" ? "badge-confirmed" : "badge-cancelled")}>
                        {selected.status === "active" ? "Active" : "Expirée"}
                      </span>
                    </div>
                    <h2 className="text-base font-bold text-foreground">{selected.diagnosis}</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {selected.patientName} · {format(new Date(selected.date), "d MMMM yyyy", { locale: fr })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(selected)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs font-semibold hover:bg-accent transition-all">
                      <Pencil className="w-3.5 h-3.5" /> Modifier
                    </button>
                    <button onClick={() => handleDelete(selected)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 text-red-500 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-950/30 transition-all">
                      <Trash2 className="w-3.5 h-3.5" /> Supprimer
                    </button>
                    <button onClick={() => downloadPrescriptionPDF(selected)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl gradient-primary text-white text-xs font-semibold hover:opacity-90 transition-all shadow-sm">
                      <Download className="w-3.5 h-3.5" /> PDF
                    </button>
                  </div>
                </div>

                {/* Doctor */}
                <div className="flex items-center gap-3 mb-5 p-3 rounded-xl bg-primary/5 border border-primary/20">
                  <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0">Dr</div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">{selected.doctorName}</p>
                    <p className="text-[10px] text-muted-foreground">Médecin prescripteur</p>
                  </div>
                </div>

                {/* Medications */}
                <div className="flex items-center gap-2 mb-3">
                  <Pill className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Médicaments prescrits</h3>
                  <span className="text-xs text-muted-foreground">({selected.medications.length})</span>
                </div>
                <div className="space-y-3">
                  {selected.medications.map((med, i) => (
                    <div key={i} className="p-4 rounded-xl border border-border/50 bg-muted/20">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-white text-[9px] font-bold">{i + 1}</div>
                          <p className="font-semibold text-sm text-foreground">{med.name}</p>
                        </div>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{med.dosage}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-muted-foreground ml-7">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle className="w-3 h-3 text-emerald-500" />
                          <span><strong className="text-foreground">Fréquence :</strong> {med.frequency}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle className="w-3 h-3 text-emerald-500" />
                          <span><strong className="text-foreground">Durée :</strong> {med.duration}</span>
                        </div>
                        {med.instructions && (
                          <div className="col-span-2 flex items-start gap-1.5 mt-1">
                            <CheckCircle className="w-3 h-3 text-amber-500 mt-0.5 flex-shrink-0" />
                            <span><strong className="text-foreground">Note :</strong> {med.instructions}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {selected.notes && (
                  <div className="mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200/50">
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">Notes</p>
                    <p className="text-xs text-amber-700/80 dark:text-amber-400/80">{selected.notes}</p>
                  </div>
                )}

                <div className="mt-6 pt-4 border-t border-border/40 text-right">
                  <p className="text-[10px] text-muted-foreground">Signature du médecin</p>
                  <div className="mt-2 h-8 w-28 ml-auto border-b-2 border-primary/30" />
                  <p className="text-[10px] text-muted-foreground mt-1">{selected.doctorName}</p>
                </div>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl h-full flex flex-col items-center justify-center gap-3 text-center p-8">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                  <FileText className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="font-semibold text-foreground">{t("prescriptions.noneSelected")}</p>
                <p className="text-sm text-muted-foreground">{t("prescriptions.noneSelectedDesc")}</p>
                <button onClick={() => { setQuickPatient(null); setShowCreate(true); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-primary text-white text-sm font-semibold hover:opacity-90 transition-all mt-2 shadow-sm">
                  <Plus className="w-4 h-4" /> {t("prescriptions.newPrescription")}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showCreate && (
        <CreateModal
          initialPatient={quickPatient}
          onClose={() => { setShowCreate(false); setQuickPatient(null); }}
          doctorId={user?.id}
        />
      )}

      {editTarget && (
        <EditPrescriptionModal
          prescription={editTarget}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  );
}
