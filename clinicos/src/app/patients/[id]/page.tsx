"use client";
import { use, useState, useRef, useCallback } from "react";
import {
  ArrowLeft, Phone, Mail, MapPin, Calendar, AlertCircle,
  Activity, Edit, Plus, X, CalendarPlus, ClipboardList,
  Trash2, ChevronDown, ChevronUp, Stethoscope, RotateCcw,
  Upload, Image, FileAudio, File, Eye, FolderOpen, Mic, Square, Play, Pause,
} from "lucide-react";
import Link from "next/link";
import { format, differenceInCalendarDays, isToday, isFuture } from "date-fns";
import { fr } from "date-fns/locale";
import Header from "@/components/layout/Header";
import { usePatient, useUpdatePatient } from "@/hooks/usePatients";
import {
  useAppointments, useCreateAppointment,
  useUpdateAppointmentStatus, useRescheduleAppointment, useDeleteAppointment,
} from "@/hooks/useAppointments";
import {
  useConsultations, useCreateConsultation,
  useDeleteConsultation, type Consultation,
} from "@/hooks/useConsultations";
import { usePatientFiles, useUploadPatientFile, useDeletePatientFile, useUpdatePatientFile, type PatientFile } from "@/hooks/usePatientFiles";
import api from "@/services/api";
import StatusPicker from "@/components/ui/StatusPicker";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { APPOINTMENTS_KEY } from "@/hooks/useAppointments";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { AppointmentStatus, Prescription, Medication } from "@/types";
import { prescriptionsService } from "@/services/prescriptions.service";
import { FileText, Pill, Download, Pencil } from "lucide-react";
import { getToday } from "@/lib/date-utils";

const STATUS_MAP = {
  confirmed: { l: "Confirmé",   c: "badge-confirmed" },
  pending:   { l: "En attente", c: "badge-pending" },
  cancelled: { l: "Annulé",     c: "badge-cancelled" },
  completed: { l: "Terminé",    c: "badge-completed" },
} as const;

const CONSULTATION_TYPES = ["Consultation", "Suivi", "Bilan", "Urgence", "Vaccination", "Contrôle", "Autre"];

function Countdown({ dateStr }: { dateStr: string }) {
  const days = differenceInCalendarDays(new Date(dateStr), new Date());
  if (isToday(new Date(dateStr))) return <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Aujourd&apos;hui</span>;
  if (days > 0)  return <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Dans {days} j</span>;
  if (days === -1) return <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Hier</span>;
  return <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Il y a {Math.abs(days)} j</span>;
}

export default function PatientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const { user: authUser } = useAuth();

  const { data: patient, isLoading } = usePatient(id);
  const { data: allAppointments = [] } = useAppointments();
  const { data: consultations = [], isLoading: consultationsLoading } = useConsultations(id);
  const updateMutation        = useUpdatePatient();
  const createAptMutation     = useCreateAppointment();
  const updateStatusMutation  = useUpdateAppointmentStatus();
  const rescheduleMutation    = useRescheduleAppointment();
  const deleteAptMutation     = useDeleteAppointment();
  const [reportingApt, setReportingApt] = useState<{ id: string; date: string; time: string } | null>(null);
  const [reportDate, setReportDate] = useState('');
  const [reportTime, setReportTime] = useState('');
  const createConsultMutation = useCreateConsultation(id);
  const deleteConsultMutation = useDeleteConsultation(id);

  // ── Patient Files ─────────────────────────────────────────
  const { data: patientFiles = [], isLoading: filesLoading } = usePatientFiles(id);
  const uploadFileMutation = useUploadPatientFile(id);
  const deleteFileMutation = useDeletePatientFile(id);
  const updateFileMutation = useUpdatePatientFile(id);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditFileModal, setShowEditFileModal] = useState(false);
  const [editingFile, setEditingFile] = useState<PatientFile | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editRemoveAudio, setEditRemoveAudio] = useState(false);
  const [editSelectedFile, setEditSelectedFile] = useState<File | null>(null);
  const [previewFile, setPreviewFile] = useState<PatientFile | null>(null);
  const [fileFilter, setFileFilter] = useState<string>("all");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadLabel, setUploadLabel] = useState("");
  const [uploadNotes, setUploadNotes] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // ── Audio Recorder ──────────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [isPlayingRecording, setIsPlayingRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioPlayerRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setRecordedBlob(blob);
        setRecordedUrl(URL.createObjectURL(blob));
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      setRecordedBlob(null);
      setRecordedUrl(null);
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch {
      toast.error("Impossible d'accéder au microphone");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [isRecording]);

  const discardRecording = useCallback(() => {
    setRecordedBlob(null);
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedUrl(null);
    setRecordingTime(0);
    setIsPlayingRecording(false);
    if (audioPreviewRef.current) audioPreviewRef.current.pause();
  }, [recordedUrl]);

  const saveRecording = useCallback(async () => {
    if (!recordedBlob) return;
    const timestamp = format(new Date(), "yyyy-MM-dd_HH-mm-ss");
    const file = new globalThis.File([recordedBlob] as BlobPart[], `enregistrement_${timestamp}.webm`, { type: "audio/webm" });
    await uploadFileMutation.mutateAsync({ file, label: uploadLabel || "Enregistrement vocal", notes: uploadNotes || undefined });
    discardRecording();
    setShowUploadModal(false);
    setSelectedFiles([]);
    setUploadLabel("");
    setUploadNotes("");
  }, [recordedBlob, uploadLabel, uploadNotes, uploadFileMutation, discardRecording]);

  const togglePlayRecording = useCallback(() => {
    if (!audioPreviewRef.current || !recordedUrl) return;
    if (isPlayingRecording) {
      audioPreviewRef.current.pause();
    } else {
      audioPreviewRef.current.play();
    }
    setIsPlayingRecording(!isPlayingRecording);
  }, [isPlayingRecording, recordedUrl]);

  const togglePlayFile = useCallback((fileId: string, url: string) => {
    const currentPlayer = audioPlayerRefs.current.get(fileId);
    if (playingAudioId === fileId && currentPlayer) {
      currentPlayer.pause();
      setPlayingAudioId(null);
      return;
    }
    // Stop any currently playing
    audioPlayerRefs.current.forEach((p, id) => { if (id !== fileId) p.pause(); });
    if (!currentPlayer) {
      const audio = new Audio(url);
      audio.onended = () => setPlayingAudioId(null);
      audioPlayerRefs.current.set(fileId, audio);
      audio.play();
    } else {
      currentPlayer.currentTime = 0;
      currentPlayer.play();
    }
    setPlayingAudioId(fileId);
  }, [playingAudioId]);

  function formatRecordingTime(secs: number) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    setSelectedFiles(prev => [...prev, ...files]);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  }, []);

  const handleUploadSubmit = async () => {
    if (selectedFiles.length === 0 && !recordedBlob) return;
    // If files selected: upload each, attaching audio to the first one if present
    if (selectedFiles.length > 0) {
      for (let i = 0; i < selectedFiles.length; i++) {
        const audioAttach = (i === 0 && recordedBlob) ? recordedBlob : undefined;
        await uploadFileMutation.mutateAsync({ file: selectedFiles[i], audio: audioAttach, label: uploadLabel || undefined, notes: uploadNotes || undefined });
      }
    } else if (recordedBlob) {
      // Audio only (no file selected) — save as standalone
      await saveRecording();
      return;
    }
    discardRecording();
    setShowUploadModal(false);
    setSelectedFiles([]);
    setUploadLabel("");
    setUploadNotes("");
  };

  const handleEditFileSubmit = async () => {
    if (!editingFile) return;
    await updateFileMutation.mutateAsync({
      fileId: editingFile.id,
      file: editSelectedFile || undefined,
      audio: recordedBlob || undefined,
      removeAudio: editRemoveAudio,
      label: editLabel !== editingFile.label ? editLabel : undefined,
      notes: editNotes !== (editingFile.notes || "") ? editNotes : undefined,
    });
    discardRecording();
    setShowEditFileModal(false);
    setEditingFile(null);
    setEditSelectedFile(null);
    setEditRemoveAudio(false);
  };

  const openEditModal = (f: PatientFile) => {
    setEditingFile(f);
    setEditLabel(f.label);
    setEditNotes(f.notes || "");
    setEditRemoveAudio(false);
    setEditSelectedFile(null);
    discardRecording();
    setShowEditFileModal(true);
  };

  const filteredFiles = fileFilter === "all" ? patientFiles : patientFiles.filter(f => f.category === fileFilter);

  const fileCategoryCounts = {
    all: patientFiles.length,
    image: patientFiles.filter(f => f.category === "image").length,
    pdf: patientFiles.filter(f => f.category === "pdf").length,
    document: patientFiles.filter(f => f.category === "document").length,
    audio: patientFiles.filter(f => f.category === "audio").length,
    other: patientFiles.filter(f => f.category === "other").length,
  };

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return bytes + " o";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " Ko";
    return (bytes / (1024 * 1024)).toFixed(1) + " Mo";
  }

  function fileCategoryIcon(category: string) {
    switch (category) {
      case "image": return <Image className="w-4 h-4 text-violet-500" />;
      case "pdf": return <FileText className="w-4 h-4 text-red-500" />;
      case "audio": return <FileAudio className="w-4 h-4 text-amber-500" />;
      case "document": return <File className="w-4 h-4 text-blue-500" />;
      default: return <File className="w-4 h-4 text-muted-foreground" />;
    }
  }

  function fileCategoryLabel(category: string) {
    switch (category) {
      case "image": return "Image";
      case "pdf": return "PDF";
      case "audio": return "Audio";
      case "document": return "Document";
      default: return "Autre";
    }
  }

  const _today = format(new Date(), "yyyy-MM-dd");
  const patientApts = allAppointments
    .filter(a => a.patientId === id)
    .sort((a, b) => {
      // Today first, then future ascending, then past descending
      if (a.date === _today && b.date !== _today) return -1;
      if (b.date === _today && a.date !== _today) return 1;
      const aFuture = a.date >= _today;
      const bFuture = b.date >= _today;
      if (aFuture && !bFuture) return -1;
      if (!aFuture && bFuture) return 1;
      if (aFuture) return a.date.localeCompare(b.date); // closest first
      return b.date.localeCompare(a.date);               // most recent first
    });

  // ── Modal states ──────────────────────────────────────────
  const [showEditModal,        setShowEditModal]        = useState(false);
  const [showAptModal,         setShowAptModal]         = useState(false);
  const [showConsultModal,     setShowConsultModal]     = useState(false);
  const [editingConsultation,  setEditingConsultation]  = useState<Consultation | null>(null);
  const [expandedConsult,      setExpandedConsult]      = useState<string | null>(null);

  // ── Edit patient ──────────────────────────────────────────
  const [editForm, setEditForm] = useState({ fullName: "", phone: "", email: "", dateOfBirth: "", gender: "male", address: "", bloodType: "", status: "active" });
  const openEdit = () => {
    if (!patient) return;
    setEditForm({ fullName: patient.fullName || "", phone: patient.phone || "", email: patient.email || "", dateOfBirth: patient.dateOfBirth || "", gender: patient.gender || "male", address: patient.address || "", bloodType: patient.bloodType || "", status: patient.status || "active" });
    setShowEditModal(true);
  };
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateMutation.mutateAsync({ id, data: editForm as any });
    setShowEditModal(false);
  };

  // ── Antécédents ───────────────────────────────────────────
  const [newAntecedent, setNewAntecedent] = useState("");
  const addAntecedent = async () => {
    if (!newAntecedent.trim() || !patient) return;
    await updateMutation.mutateAsync({ id, data: { medicalHistory: [...(patient.medicalHistory || []), newAntecedent.trim()] } as any });
    setNewAntecedent("");
  };
  const removeAntecedent = async (item: string) => {
    if (!patient) return;
    await updateMutation.mutateAsync({ id, data: { medicalHistory: (patient.medicalHistory || []).filter(h => h !== item) } as any });
  };

  // ── Allergies ─────────────────────────────────────────────
  const [newAllergy, setNewAllergy] = useState("");
  const addAllergy = async () => {
    if (!newAllergy.trim() || !patient) return;
    await updateMutation.mutateAsync({ id, data: { allergies: [...(patient.allergies || []), newAllergy.trim()] } as any });
    setNewAllergy("");
  };
  const removeAllergy = async (item: string) => {
    if (!patient) return;
    await updateMutation.mutateAsync({ id, data: { allergies: (patient.allergies || []).filter(a => a !== item) } as any });
  };

  // ── Nouveau RDV form ──────────────────────────────────────
  const [aptForm, setAptForm] = useState({ date: getToday(), time: "09:00", type: "Consultation", notes: "" });
  const handleAptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createAptMutation.mutateAsync({ patientId: id, doctorId: undefined, date: aptForm.date, time: aptForm.time, duration: 30, type: aptForm.type, notes: aptForm.notes || undefined });
    setShowAptModal(false);
  };

  // ── Consultation form (create + edit) ─────────────────────
  const emptyConsult = { date: getToday(), time: new Date().toTimeString().slice(0, 5), type: "Consultation", diagnosis: "", notes: "", treatment: "", nextVisit: "" };
  const [consultForm, setConsultForm] = useState(emptyConsult);

  const openNewConsult = () => { setEditingConsultation(null); setConsultForm(emptyConsult); setShowConsultModal(true); };
  const openEditConsult = (c: Consultation) => {
    setEditingConsultation(c);
    setConsultForm({ date: c.date, time: c.time, type: c.type, diagnosis: c.diagnosis || "", notes: c.notes || "", treatment: c.treatment || "", nextVisit: c.nextVisit || "" });
    setShowConsultModal(true);
  };

  const handleConsultSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const prevNextVisit = editingConsultation?.nextVisit;
    if (editingConsultation) {
      // Update existing consultation via API
      await api.put(`/consultations/${editingConsultation.id}`, {
        date: consultForm.date, time: consultForm.time, type: consultForm.type,
        diagnosis: consultForm.diagnosis || null, notes: consultForm.notes || null,
        treatment: consultForm.treatment || null, nextVisit: consultForm.nextVisit || null,
      });
      qc.invalidateQueries({ queryKey: ["consultations", id] });
      toast.success("Rapport modifié !");
    } else {
      // Create new consultation
      await createConsultMutation.mutateAsync({
        patientId: id, doctorId: undefined,
        date: consultForm.date, time: consultForm.time, type: consultForm.type,
        diagnosis: consultForm.diagnosis || undefined, notes: consultForm.notes || undefined,
        treatment: consultForm.treatment || undefined, nextVisit: consultForm.nextVisit || undefined,
      });
      // Auto-create RDV if nextVisit set
      if (consultForm.nextVisit) {
        await createAptMutation.mutateAsync({
          patientId: id, doctorId: undefined,
          date: consultForm.nextVisit, time: "09:00", duration: 30, type: "Suivi",
          notes: `Suivi suite à consultation du ${format(new Date(consultForm.date), "d MMM yyyy", { locale: fr })}`,
        });
      }
    }
    setShowConsultModal(false);
    setConsultForm(emptyConsult);
    setEditingConsultation(null);
  };

  // ── Prescriptions ─────────────────────────────────────────
  const { data: allPrescriptions = [] } = useQuery<Prescription[]>({
    queryKey: ["prescriptions"],
    queryFn: prescriptionsService.getAll,
    staleTime: 30_000,
  });
  const patientPrescriptions = allPrescriptions.filter(p => p.patientId === id)
    .sort((a, b) => b.date.localeCompare(a.date));

  const [showPrescModal, setShowPrescModal] = useState(false);
  const [prescDiagnosis, setPrescDiagnosis] = useState("");
  const [prescNotes, setPrescNotes]         = useState("");
  const [prescMeds, setPrescMeds]           = useState<Medication[]>([{ name: "", dosage: "", frequency: "1×/jour", duration: "7 jours", instructions: "" }]);

  const createPrescMutation = useMutation({
    mutationFn: () => prescriptionsService.create({
      patientId: id,
      diagnosis: prescDiagnosis,
      medications: prescMeds.filter(m => m.name.trim()),
      notes: prescNotes || undefined,
      doctorId: authUser?.id,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prescriptions"] });
      toast.success("Ordonnance créée !");
      setShowPrescModal(false);
      setPrescDiagnosis(""); setPrescNotes("");
      setPrescMeds([{ name: "", dosage: "", frequency: "1×/jour", duration: "7 jours", instructions: "" }]);
    },
    onError: () => toast.error("Erreur lors de la création"),
  });

  const [editingPresc,     setEditingPresc]     = useState<Prescription | null>(null);
  const [editPrescDiag,    setEditPrescDiag]    = useState("");
  const [editPrescNotes,   setEditPrescNotes]   = useState("");
  const [editPrescMeds,    setEditPrescMeds]    = useState<Medication[]>([]);

  const openEditPresc = (prx: Prescription) => {
    setEditingPresc(prx);
    setEditPrescDiag(prx.diagnosis || "");
    setEditPrescNotes(prx.notes || "");
    setEditPrescMeds(prx.medications.length ? prx.medications : [{ name: "", dosage: "", frequency: "1×/jour", duration: "7 jours", instructions: "" }]);
  };

  const updatePrescMutation = useMutation({
    mutationFn: (prxId: string) => prescriptionsService.update(prxId, {
      diagnosis: editPrescDiag,
      medications: editPrescMeds.filter(m => m.name.trim()),
      notes: editPrescNotes || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prescriptions"] });
      toast.success("Ordonnance modifiée !");
      setEditingPresc(null);
    },
    onError: () => toast.error("Erreur lors de la modification"),
  });

  const deletePrescMutation = useMutation({
    mutationFn: (prxId: string) => prescriptionsService.deletePrescription(prxId),
    onSuccess: (_data, prxId) => {
      qc.setQueryData<Prescription[]>(["prescriptions"], old => (old || []).filter(p => p.id !== prxId));
      toast.success("Ordonnance supprimée");
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  async function downloadPrxPDF(prx: Prescription) {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = 210, M = 18;
    doc.setFillColor(98, 114, 245); doc.rect(0, 0, W, 28, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16); doc.setFont("helvetica", "bold");
    doc.text("ORDONNANCE MÉDICALE", W / 2, 11, { align: "center" });
    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    doc.text(`Cabinet ClinicOS · ${prx.date} · ${prx.doctorName}`, W / 2, 20, { align: "center" });
    doc.text(`Patient : ${prx.patientName}`, W / 2, 25, { align: "center" });
    let y = 38;
    doc.setFillColor(98, 114, 245); doc.roundedRect(M, y, W - M * 2, 9, 2, 2, "F");
    doc.setFontSize(9); doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold");
    doc.text(`Diagnostic : ${prx.diagnosis}`, M + 4, y + 6.5);
    y += 16;
    prx.medications.forEach((med, i) => {
      doc.setFillColor(i % 2 === 0 ? 248 : 255, i % 2 === 0 ? 249 : 255, 255);
      doc.roundedRect(M, y, W - M * 2, 20, 2, 2, "F");
      doc.setFontSize(10); doc.setTextColor(30, 30, 50); doc.setFont("helvetica", "bold");
      doc.text(`${i + 1}. ${med.name}`, M + 4, y + 7);
      doc.setFontSize(8); doc.setTextColor(98, 114, 245);
      doc.text(med.dosage, W - M - 4, y + 7, { align: "right" });
      doc.setFontSize(8); doc.setTextColor(100, 100, 120); doc.setFont("helvetica", "normal");
      doc.text(`Fréquence : ${med.frequency}  ·  Durée : ${med.duration}`, M + 4, y + 14);
      if (med.instructions) doc.text(`Note : ${med.instructions}`, M + 4, y + 18);
      y += 24;
    });
    if (prx.notes) {
      doc.setFillColor(255, 251, 235); doc.roundedRect(M, y, W - M * 2, 12, 2, 2, "F");
      doc.setFontSize(8); doc.setTextColor(146, 64, 14); doc.setFont("helvetica", "bold");
      doc.text("Notes : ", M + 4, y + 6);
      doc.setFont("helvetica", "normal"); doc.text(prx.notes.slice(0, 100), M + 22, y + 6);
    }
    doc.setFillColor(98, 114, 245); doc.rect(0, 287, W, 10, "F");
    doc.setFontSize(7.5); doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "normal");
    doc.text("Ordonnance générée par ClinicOS", W / 2, 293, { align: "center" });
    doc.save(`Ordonnance-${prx.patientName}-${prx.date}.pdf`);
  }

  // ── Loading / Not found ───────────────────────────────────
  if (isLoading) return (
    <div className="flex flex-col h-full">
      <Header title="Chargement..." />
      <div className="flex-1 p-6 space-y-4">{Array(4).fill(0).map((_, i) => <div key={i} className="h-24 bg-card border border-border rounded-xl animate-pulse" />)}</div>
    </div>
  );

  if (!patient) return (
    <div className="flex flex-col h-full">
      <Header title="Patient introuvable" />
      <div className="flex-1 flex items-center justify-center text-center">
        <div>
          <p className="text-muted-foreground mb-4">Ce patient n&apos;existe pas.</p>
          <Link href="/patients" className="inline-flex items-center gap-2 text-primary text-sm hover:underline"><ArrowLeft className="w-4 h-4" /> Retour</Link>
        </div>
      </div>
    </div>
  );

  const age = patient.dateOfBirth ? new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear() : null;

  return (
    <div className="flex flex-col h-full">
      <Header title={patient.fullName} subtitle="Profil du patient" />

      <div className="flex-1 overflow-auto custom-scroll p-6 space-y-5">
        {/* Header actions */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Link href="/patients" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Retour aux patients
          </Link>
          <div className="flex gap-2">
            <button onClick={openNewConsult} className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border text-sm font-medium hover:bg-accent transition-all">
              <ClipboardList className="w-4 h-4 text-emerald-500" /> Nouveau rapport
            </button>
            <button onClick={() => setShowAptModal(true)} className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border text-sm font-medium hover:bg-accent transition-all">
              <CalendarPlus className="w-4 h-4 text-primary" /> Nouveau RDV
            </button>
            <button onClick={openEdit} className="flex items-center gap-2 px-3.5 py-2 rounded-xl gradient-primary text-white text-sm font-semibold hover:opacity-90 transition-all">
              <Edit className="w-4 h-4" /> Modifier
            </button>
          </div>
        </div>

        {/* Profile card */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center text-white font-bold text-xl shadow-lg flex-shrink-0">
              {patient.fullName.split(" ").map(w => w[0]).join("").slice(0, 2)}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-foreground">{patient.fullName}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {patient.gender === "male" ? "Homme" : "Femme"}
                {age !== null && ` · ${age} ans`}
                {patient.bloodType && ` · ${patient.bloodType}`}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
                {patient.phone && <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Phone className="w-3.5 h-3.5" />{patient.phone}</div>}
                {patient.email && <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Mail className="w-3.5 h-3.5" />{patient.email}</div>}
                {patient.address && <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="w-3.5 h-3.5" />{patient.address}</div>}
              </div>
            </div>
            <div className="text-right space-y-1.5 flex-shrink-0">
              <span className={cn("text-xs font-semibold px-3 py-1 rounded-full", patient.status === "active" ? "badge-confirmed" : "badge-cancelled")}>
                {patient.status === "active" ? "Actif" : "Inactif"}
              </span>
              <p className="text-[10px] text-muted-foreground block">Inscrit le {format(new Date(patient.createdAt), "d MMM yyyy", { locale: fr })}</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "Rapports",    value: consultations.length,                icon: ClipboardList, color: "gradient-success" },
            { label: "Rendez-vous", value: patientApts.length,                  icon: Calendar,      color: "gradient-primary" },
            { label: "Fichiers",    value: patientFiles.length,                 icon: FolderOpen,    color: "bg-gradient-to-br from-violet-500 to-purple-600" },
            { label: "Antécédents", value: (patient.medicalHistory||[]).length, icon: Activity,      color: "gradient-danger" },
            { label: "Allergies",   value: (patient.allergies||[]).length,      icon: AlertCircle,   color: "gradient-warning" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", color)}>
                <Icon className="w-4 h-4 text-white" />
              </div>
              <div><p className="text-lg font-bold text-foreground">{value}</p><p className="text-[10px] text-muted-foreground">{label}</p></div>
            </div>
          ))}
        </div>

        {/* ── Rapports de consultation ──────────────────────── */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-emerald-500" /> Rapports de consultation
              {consultations.length > 0 && <span className="text-xs font-normal text-muted-foreground">({consultations.length})</span>}
            </h3>
            <button onClick={openNewConsult} className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium">
              <Plus className="w-3.5 h-3.5" /> Nouveau rapport
            </button>
          </div>

          {consultationsLoading ? (
            <div className="space-y-2">{Array(2).fill(0).map((_, i) => <div key={i} className="h-14 bg-muted/30 rounded-xl animate-pulse" />)}</div>
          ) : consultations.length === 0 ? (
            <div className="py-8 text-center">
              <ClipboardList className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Aucun rapport enregistré</p>
              <button onClick={openNewConsult} className="mt-2 text-xs text-primary hover:underline">+ Créer le premier rapport</button>
            </div>
          ) : (
            <div className="space-y-2">
              {consultations.map((c) => {
                const isExp = expandedConsult === c.id;
                return (
                  <div key={c.id} className="border border-border rounded-xl overflow-hidden">
                    <div className="flex items-center gap-3 p-3.5 cursor-pointer hover:bg-accent/40 transition-all" onClick={() => setExpandedConsult(isExp ? null : c.id)}>
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                        <Stethoscope className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">{c.type}</p>
                          {c.diagnosis && <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium truncate max-w-[140px]">{c.diagnosis}</span>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(c.date), "EEEE d MMMM yyyy", { locale: fr })} à {c.time}</p>
                      </div>
                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                        <button onClick={() => openEditConsult(c)} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all" title="Modifier">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => { if (confirm("Supprimer ce rapport ?")) deleteConsultMutation.mutate(c.id); }} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-red-50 hover:text-red-500 transition-all" title="Supprimer">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        {isExp ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </div>
                    {isExp && (
                      <div className="px-4 pb-4 pt-2 border-t border-border/50 bg-muted/10 space-y-3">
                        {c.notes && <div><p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Notes cliniques</p><p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{c.notes}</p></div>}
                        {c.treatment && <div><p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Traitement prescrit</p><p className="text-sm text-foreground whitespace-pre-wrap">{c.treatment}</p></div>}
                        {c.nextVisit && (
                          <div className="flex items-center gap-2 text-xs text-primary font-medium">
                            <Calendar className="w-3.5 h-3.5" />
                            Prochain RDV : {format(new Date(c.nextVisit), "d MMMM yyyy", { locale: fr })}
                            <Countdown dateStr={c.nextVisit} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Antécédents + Allergies */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /> Antécédents médicaux</h3>
            <div className="space-y-2 mb-3">
              {(patient.medicalHistory||[]).length === 0 ? <p className="text-sm text-muted-foreground italic">Aucun antécédent connu</p> :
                (patient.medicalHistory||[]).map(item => (
                  <div key={item} className="flex items-center justify-between gap-2 group">
                    <div className="flex items-center gap-2 text-sm text-foreground"><div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />{item}</div>
                    <button onClick={() => removeAntecedent(item)} className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"><X className="w-3 h-3" /></button>
                  </div>
                ))}
            </div>
            <div className="flex gap-2">
              <input value={newAntecedent} onChange={e => setNewAntecedent(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addAntecedent())} placeholder="Ajouter un antécédent..."
                className="flex-1 px-3 py-2 rounded-lg border border-border bg-background/50 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
              <button onClick={addAntecedent} disabled={!newAntecedent.trim()} className="px-3 py-2 rounded-lg gradient-primary text-white text-xs hover:opacity-90 disabled:opacity-40 transition-all"><Plus className="w-3.5 h-3.5" /></button>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2"><AlertCircle className="w-4 h-4 text-red-500" /> Allergies</h3>
            <div className="flex flex-wrap gap-2 mb-3 min-h-[28px]">
              {(patient.allergies||[]).length === 0 ? <p className="text-sm text-muted-foreground italic">Aucune allergie connue</p> :
                (patient.allergies||[]).map(a => (
                  <span key={a} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-red-50 text-red-600 border border-red-200 font-medium">
                    ⚠ {a}<button onClick={() => removeAllergy(a)} className="ml-0.5 hover:text-red-800"><X className="w-3 h-3" /></button>
                  </span>
                ))}
            </div>
            <div className="flex gap-2">
              <input value={newAllergy} onChange={e => setNewAllergy(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addAllergy())} placeholder="Ajouter une allergie..."
                className="flex-1 px-3 py-2 rounded-lg border border-border bg-background/50 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
              <button onClick={addAllergy} disabled={!newAllergy.trim()} className="px-3 py-2 rounded-lg bg-red-500 text-white text-xs hover:opacity-90 disabled:opacity-40 transition-all"><Plus className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        </div>

        {/* ── Historique des rendez-vous ────────────────────── */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" /> Historique des rendez-vous
            </h3>
            <button onClick={() => setShowAptModal(true)} className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium">
              <Plus className="w-3.5 h-3.5" /> Nouveau RDV
            </button>
          </div>

          {patientApts.length === 0 ? (
            <div className="py-8 text-center">
              <Calendar className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Aucun rendez-vous enregistré</p>
              <button onClick={() => setShowAptModal(true)} className="mt-2 text-xs text-primary hover:underline">+ Créer le premier rendez-vous</button>
            </div>
          ) : (
            <div className="space-y-2">
              {patientApts.map((apt) => {
                const s = STATUS_MAP[apt.status as keyof typeof STATUS_MAP] || STATUS_MAP.pending;
                const aptDate = new Date(apt.date);
                const upcoming = isFuture(aptDate) || isToday(aptDate);
                return (
                  <div key={apt.id} className={cn("flex items-center gap-3 p-3 rounded-xl hover:bg-accent/40 transition-all", !upcoming && "opacity-60")}>
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", upcoming ? "bg-primary/10" : "bg-muted")}>
                      <Calendar className={cn("w-4 h-4", upcoming ? "text-primary" : "text-muted-foreground")} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{apt.type}</p>
                      <p className="text-xs text-muted-foreground">{format(aptDate, "EEEE d MMMM yyyy", { locale: fr })} · {apt.time}</p>
                    </div>
                    {/* Countdown + status + actions */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Countdown dateStr={apt.date} />
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", s.c)}>{s.l}</span>
                      {/* StatusPicker libre */}
                      <StatusPicker
                        current={apt.status as AppointmentStatus}
                        onChange={status => updateStatusMutation.mutate({ id: apt.id, status })}
                        disabled={updateStatusMutation.isPending}
                      />
                      {/* Reporter */}
                      <button onClick={() => { setReportingApt({ id: apt.id, date: apt.date, time: apt.time }); setReportDate(apt.date); setReportTime(apt.time); }}
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-amber-50 hover:text-amber-600 transition-all" title="Reporter">
                        <RotateCcw className="w-3 h-3" />
                      </button>
                      {/* Supprimer */}
                      <button onClick={() => { if (confirm('Supprimer ce RDV ?')) deleteAptMutation.mutate(apt.id); }}
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-red-50 hover:text-red-500 transition-all" title="Supprimer">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Ordonnances ──────────────────────────────────── */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" /> Ordonnances
              {patientPrescriptions.length > 0 && <span className="text-xs font-normal text-muted-foreground">({patientPrescriptions.length})</span>}
            </h3>
            <button onClick={() => setShowPrescModal(true)} className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium">
              <Plus className="w-3.5 h-3.5" /> Nouvelle ordonnance
            </button>
          </div>

          {patientPrescriptions.length === 0 ? (
            <div className="py-8 text-center">
              <FileText className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Aucune ordonnance enregistrée</p>
              <button onClick={() => setShowPrescModal(true)} className="mt-2 text-xs text-primary hover:underline">+ Créer la première ordonnance</button>
            </div>
          ) : (
            <div className="space-y-2">
              {patientPrescriptions.map(prx => (
                <div key={prx.id} className="flex items-center gap-3 p-3.5 rounded-xl border border-border hover:bg-accent/40 transition-all">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Pill className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{prx.diagnosis}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(prx.date), "d MMM yyyy", { locale: fr })} · {prx.medications.length} médicament{prx.medications.length > 1 ? "s" : ""}
                    </p>
                  </div>
                  <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0",
                    prx.status === "active" ? "badge-confirmed" : "badge-cancelled")}>
                    {prx.status === "active" ? "Active" : "Expirée"}
                  </span>
                  <button onClick={() => openEditPresc(prx)} title="Modifier"
                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-border hover:bg-amber-50 hover:text-amber-600 text-muted-foreground transition-all flex-shrink-0">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => { if (confirm("Supprimer cette ordonnance ?")) deletePrescMutation.mutate(prx.id); }} title="Supprimer"
                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-border hover:bg-red-50 hover:text-red-500 text-muted-foreground transition-all flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => downloadPrxPDF(prx)} title="Télécharger PDF"
                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-border hover:bg-primary/10 hover:text-primary text-muted-foreground transition-all flex-shrink-0">
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Fichiers du patient ────────────────────────────── */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-violet-500" /> Fichiers
              {patientFiles.length > 0 && <span className="text-xs font-normal text-muted-foreground">({patientFiles.length})</span>}
            </h3>
            <button onClick={() => setShowUploadModal(true)} className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium">
              <Upload className="w-3.5 h-3.5" /> Ajouter un fichier
            </button>
          </div>

          {/* Filter tabs */}
          {patientFiles.length > 0 && (
            <div className="flex gap-1.5 mb-3 bg-muted/40 rounded-xl p-1 overflow-x-auto">
              {(["all", "image", "pdf", "document", "audio", "other"] as const).map(cat => {
                const count = fileCategoryCounts[cat];
                if (cat !== "all" && count === 0) return null;
                return (
                  <button key={cat} onClick={() => setFileFilter(cat)}
                    className={cn(
                      "px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap",
                      fileFilter === cat
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}>
                    {cat === "all" ? "Tous" : fileCategoryLabel(cat)}
                    <span className={cn("ml-1 font-bold", fileFilter === cat ? "text-primary" : "text-muted-foreground")}>({count})</span>
                  </button>
                );
              })}
            </div>
          )}

          {filesLoading ? (
            <div className="space-y-2">{Array(2).fill(0).map((_, i) => <div key={i} className="h-14 bg-muted/30 rounded-xl animate-pulse" />)}</div>
          ) : patientFiles.length === 0 ? (
            <div className="py-10 text-center">
              <div className="w-16 h-16 rounded-2xl bg-violet-50 dark:bg-violet-950 flex items-center justify-center mx-auto mb-3">
                <FolderOpen className="w-7 h-7 text-violet-300" />
              </div>
              <p className="text-sm text-muted-foreground mb-1">Aucun fichier enregistré</p>
              <p className="text-xs text-muted-foreground/70 mb-3">Photos, rapports scanner, analyses, ordonnances...</p>
              <button onClick={() => setShowUploadModal(true)} className="text-xs text-primary hover:underline font-medium inline-flex items-center gap-1">
                <Upload className="w-3 h-3" /> Ajouter le premier fichier
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filteredFiles.map(f => (
                <div key={f.id} className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-accent/40 transition-all group">
                  {/* Thumbnail / Icon */}
                  {f.category === "image" ? (
                    <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 border border-border cursor-pointer relative" onClick={() => setPreviewFile(f)}>
                      <img src={f.url} alt={f.originalName} className="w-full h-full object-cover" />
                      {f.audioUrl && (
                        <button onClick={e => { e.stopPropagation(); togglePlayFile(f.id, f.audioUrl!); }}
                          className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          {playingAudioId === f.id ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white ml-0.5" />}
                        </button>
                      )}
                    </div>
                  ) : f.category === "audio" ? (
                    <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950 flex items-center justify-center flex-shrink-0 cursor-pointer group/audio"
                      onClick={() => togglePlayFile(f.id, f.url)}>
                      {playingAudioId === f.id
                        ? <Pause className="w-4 h-4 text-amber-600" />
                        : <Play className="w-4 h-4 text-amber-500 ml-0.5" />}
                    </div>
                  ) : (
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 relative",
                      f.category === "pdf" ? "bg-red-50 dark:bg-red-950" :
                      f.category === "document" ? "bg-blue-50 dark:bg-blue-950" :
                      "bg-muted"
                    )}>
                      {fileCategoryIcon(f.category)}
                      {f.audioUrl && (
                        <button onClick={() => togglePlayFile(f.id, f.audioUrl!)}
                          className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center shadow-sm border-2 border-white dark:border-card">
                          {playingAudioId === f.id ? <Pause className="w-2.5 h-2.5 text-white" /> : <Play className="w-2.5 h-2.5 text-white ml-px" />}
                        </button>
                      )}
                    </div>
                  )}
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{f.originalName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                        f.category === "image" ? "bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400" :
                        f.category === "pdf" ? "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400" :
                        f.category === "audio" ? "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400" :
                        f.category === "document" ? "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400" :
                        "bg-muted text-muted-foreground"
                      )}>{fileCategoryLabel(f.category)}</span>
                      <span className="text-[10px] text-muted-foreground">{formatFileSize(f.size)}</span>
                      <span className="text-[10px] text-muted-foreground">{format(new Date(f.createdAt), "d MMM yyyy", { locale: fr })}</span>
                      {f.audioUrl && <span className="text-[10px] font-semibold text-amber-500 flex items-center gap-0.5"><Mic className="w-2.5 h-2.5" /> Audio</span>}
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEditModal(f)} title="Modifier"
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-blue-50 hover:text-blue-500 dark:hover:bg-blue-950 transition-all">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {f.category === "image" && (
                      <button onClick={() => setPreviewFile(f)} title="Aperçu"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-violet-50 hover:text-violet-500 dark:hover:bg-violet-950 transition-all">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <a href={f.url} download={f.originalName} target="_blank" rel="noopener noreferrer" title="Télécharger"
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all">
                      <Download className="w-3.5 h-3.5" />
                    </a>
                    <button onClick={() => { if (confirm(`Supprimer ${f.originalName} ?`)) deleteFileMutation.mutate(f.id); }} title="Supprimer"
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950 transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ── Modal: Upload fichier ── */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setShowUploadModal(false); setSelectedFiles([]); }} />
          <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-foreground">Ajouter des fichiers</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Patient : {patient.fullName}</p>
              </div>
              <button onClick={() => { setShowUploadModal(false); setSelectedFiles([]); }} className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted"><X className="w-4 h-4" /></button>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all mb-4",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-accent/30"
              )}
            >
              <Upload className={cn("w-8 h-8 mx-auto mb-3", isDragging ? "text-primary" : "text-muted-foreground/50")} />
              <p className="text-sm font-medium text-foreground">Glissez vos fichiers ici</p>
              <p className="text-xs text-muted-foreground mt-1">ou cliquez pour parcourir</p>
              <p className="text-[10px] text-muted-foreground/60 mt-2">Images, PDF, Word, Audio · Max 10 Mo</p>
              <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden"
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,audio/*" />
            </div>

            {/* ── Voice Recorder ── */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1 h-4 rounded-full bg-gradient-to-b from-amber-400 to-red-500" />
                <p className="text-xs font-semibold text-foreground">Enregistrement vocal</p>
              </div>

              {!isRecording && !recordedBlob && (
                <button onClick={startRecording}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-amber-600 dark:text-amber-400 text-sm font-semibold transition-all">
                  <Mic className="w-4 h-4" /> Enregistrer un audio
                </button>
              )}

              {isRecording && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 animate-pulse">
                  <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                  <span className="text-sm font-mono font-bold text-red-600 dark:text-red-400 flex-1">{formatRecordingTime(recordingTime)}</span>
                  <span className="text-xs text-red-500 font-medium">Enregistrement...</span>
                  <button onClick={stopRecording}
                    className="w-8 h-8 rounded-lg bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-all flex-shrink-0">
                    <Square className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {recordedBlob && recordedUrl && (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700">
                    <button onClick={togglePlayRecording}
                      className="w-9 h-9 rounded-xl bg-amber-500 hover:bg-amber-600 flex items-center justify-center text-white transition-all flex-shrink-0">
                      {isPlayingRecording ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                    </button>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">Enregistrement</p>
                      <p className="text-xs text-muted-foreground">{formatRecordingTime(recordingTime)}</p>
                    </div>
                    <button onClick={discardRecording} title="Supprimer"
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950 transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <audio ref={audioPreviewRef} src={recordedUrl} onEnded={() => setIsPlayingRecording(false)} className="hidden" />
                  <button onClick={saveRecording} disabled={uploadFileMutation.isPending}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {uploadFileMutation.isPending
                      ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <><Upload className="w-3.5 h-3.5" /> Sauvegarder l&apos;enregistrement</>}
                  </button>
                </div>
              )}
            </div>

            {/* Selected files */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2 mb-4 max-h-40 overflow-y-auto custom-scroll">
                {selectedFiles.map((file, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border">
                    <File className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs font-medium text-foreground truncate flex-1">{file.name}</span>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">{formatFileSize(file.size)}</span>
                    <button onClick={() => setSelectedFiles(prev => prev.filter((_, j) => j !== i))}
                      className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-red-500"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            )}

            {/* Label + notes */}
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Étiquette</label>
                <input value={uploadLabel} onChange={e => setUploadLabel(e.target.value)}
                  placeholder="Ex: Radio panoramique, Analyse sanguine..."
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Notes</label>
                <textarea value={uploadNotes} onChange={e => setUploadNotes(e.target.value)} rows={2}
                  placeholder="Remarques optionnelles..."
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background/50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setShowUploadModal(false); setSelectedFiles([]); discardRecording(); }}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-all">Annuler</button>
              <button onClick={handleUploadSubmit}
                disabled={(selectedFiles.length === 0 && !recordedBlob) || uploadFileMutation.isPending}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {uploadFileMutation.isPending
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <><Upload className="w-3.5 h-3.5" /> Envoyer{selectedFiles.length > 0 && recordedBlob ? ` (${selectedFiles.length} + 🎤)` : selectedFiles.length > 0 ? ` (${selectedFiles.length})` : recordedBlob ? " (🎤)" : ""}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Modifier fichier ── */}
      {showEditFileModal && editingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setShowEditFileModal(false); discardRecording(); }} />
          <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-xl p-6 overflow-y-auto max-h-[90vh] custom-scroll">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-foreground">Modifier le fichier</h2>
                <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[250px]">{editingFile.originalName}</p>
              </div>
              <button onClick={() => { setShowEditFileModal(false); discardRecording(); }} className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted"><X className="w-4 h-4" /></button>
            </div>

            {/* Replace file zone */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-foreground mb-1">Remplacer le fichier (Optionnel)</label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all",
                  editSelectedFile ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-accent/30"
                )}
              >
                <Upload className={cn("w-6 h-6 mx-auto mb-2", editSelectedFile ? "text-primary" : "text-muted-foreground/50")} />
                {editSelectedFile ? (
                  <p className="text-sm font-medium text-primary truncate px-2">{editSelectedFile.name}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Cliquez pour choisir un nouveau fichier</p>
                )}
                <input ref={fileInputRef} type="file" onChange={e => { if (e.target.files?.[0]) setEditSelectedFile(e.target.files[0]); }} className="hidden"
                  accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,audio/*" />
              </div>
            </div>

            {/* Voice Recorder Edit */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1 h-4 rounded-full bg-gradient-to-b from-amber-400 to-red-500" />
                <p className="text-xs font-semibold text-foreground">Enregistrement vocal</p>
              </div>

              {editingFile.audioUrl && !editRemoveAudio && !recordedBlob && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 mb-2">
                  <button onClick={() => togglePlayFile(editingFile.id, editingFile.audioUrl!)}
                    className="w-9 h-9 rounded-xl bg-amber-500 hover:bg-amber-600 flex items-center justify-center text-white transition-all flex-shrink-0">
                    {playingAudioId === editingFile.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                  </button>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">Audio actuel</p>
                  </div>
                  <button onClick={() => setEditRemoveAudio(true)} title="Supprimer l'audio actuel"
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950 transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {editRemoveAudio && (
                <p className="text-xs text-red-500 font-medium mb-2 bg-red-50 p-2 rounded flex items-center gap-2">
                  <Trash2 className="w-3.5 h-3.5" /> L'audio actuel sera supprimé.
                  <button onClick={() => setEditRemoveAudio(false)} className="underline text-red-600 hover:text-red-700 ml-auto">Annuler</button>
                </p>
              )}

              {!isRecording && !recordedBlob && (
                <button onClick={startRecording}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-amber-600 dark:text-amber-400 text-sm font-semibold transition-all">
                  <Mic className="w-4 h-4" /> Enregistrer un {editingFile.audioUrl ? "nouvel " : ""}audio
                </button>
              )}

              {isRecording && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 animate-pulse">
                  <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                  <span className="text-sm font-mono font-bold text-red-600 dark:text-red-400 flex-1">{formatRecordingTime(recordingTime)}</span>
                  <span className="text-xs text-red-500 font-medium">Enregistrement...</span>
                  <button onClick={stopRecording}
                    className="w-8 h-8 rounded-lg bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-all flex-shrink-0">
                    <Square className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {recordedBlob && recordedUrl && (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700">
                    <button onClick={togglePlayRecording}
                      className="w-9 h-9 rounded-xl bg-amber-500 hover:bg-amber-600 flex items-center justify-center text-white transition-all flex-shrink-0">
                      {isPlayingRecording ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                    </button>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">Nouvel enregistrement</p>
                      <p className="text-xs text-muted-foreground">{formatRecordingTime(recordingTime)}</p>
                    </div>
                    <button onClick={discardRecording} title="Supprimer"
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950 transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Label + notes */}
            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Étiquette</label>
                <input value={editLabel} onChange={e => setEditLabel(e.target.value)}
                  placeholder="Ex: Radio panoramique..."
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Notes</label>
                <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2}
                  placeholder="Remarques..."
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background/50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setShowEditFileModal(false); discardRecording(); }}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-all">Annuler</button>
              <button onClick={handleEditFileSubmit} disabled={updateFileMutation.isPending}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {updateFileMutation.isPending
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : "Sauvegarder"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Preview image ── */}
      {previewFile && previewFile.category === "image" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setPreviewFile(null)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
          <div className="relative max-w-3xl max-h-[85vh] rounded-2xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <button onClick={() => setPreviewFile(null)}
              className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-all">
              <X className="w-4 h-4" />
            </button>
            <img src={previewFile.url} alt={previewFile.originalName} className="max-h-[85vh] object-contain" />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
              <p className="text-white font-semibold text-sm">{previewFile.originalName}</p>
              <p className="text-white/60 text-xs">{formatFileSize(previewFile.size)} · {format(new Date(previewFile.createdAt), "d MMM yyyy", { locale: fr })}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Nouvelle ordonnance ── */}
      {showPrescModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowPrescModal(false)} />
          <div className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-xl p-6 max-h-[90vh] overflow-y-auto custom-scroll">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-foreground">Nouvelle ordonnance</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Patient : {patient.fullName}</p>
              </div>
              <button onClick={() => setShowPrescModal(false)} className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted"><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">Diagnostic *</label>
                <input value={prescDiagnosis} onChange={e => setPrescDiagnosis(e.target.value)}
                  placeholder="Ex: Infection respiratoire, Hypertension..."
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5"><Pill className="w-3.5 h-3.5 text-primary" /> Médicaments *</label>
                  <button type="button" onClick={() => setPrescMeds(m => [...m, { name: "", dosage: "", frequency: "1×/jour", duration: "7 jours", instructions: "" }])}
                    className="text-xs text-primary hover:underline font-semibold flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Ajouter
                  </button>
                </div>
                <div className="space-y-2">
                  {prescMeds.map((med, idx) => (
                    <div key={idx} className="bg-muted/20 border border-border rounded-xl p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">{idx + 1}</div>
                        <input value={med.name} onChange={e => setPrescMeds(m => m.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))}
                          placeholder="Médicament *" className="flex-1 px-2 py-1.5 rounded-lg border border-border bg-background/50 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 font-semibold" />
                        <input value={med.dosage} onChange={e => setPrescMeds(m => m.map((x, i) => i === idx ? { ...x, dosage: e.target.value } : x))}
                          placeholder="500mg" className="w-20 px-2 py-1.5 rounded-lg border border-border bg-background/50 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20" />
                        {prescMeds.length > 1 && (
                          <button type="button" onClick={() => setPrescMeds(m => m.filter((_, i) => i !== idx))}
                            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-red-100 text-muted-foreground hover:text-red-500 flex-shrink-0">
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-muted-foreground block mb-0.5">Fréquence</label>
                          <select value={med.frequency} onChange={e => setPrescMeds(m => m.map((x, i) => i === idx ? { ...x, frequency: e.target.value } : x))}
                            className="w-full px-2 py-1.5 rounded-lg border border-border bg-background/50 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20">
                            {["1×/jour","2×/jour","3×/jour","Matin-Soir","Matin-Midi-Soir","Si besoin","Le soir","À jeun"].map(f => <option key={f} value={f}>{f}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground block mb-0.5">Durée</label>
                          <select value={med.duration} onChange={e => setPrescMeds(m => m.map((x, i) => i === idx ? { ...x, duration: e.target.value } : x))}
                            className="w-full px-2 py-1.5 rounded-lg border border-border bg-background/50 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20">
                            {["3 jours","5 jours","7 jours","10 jours","14 jours","1 mois","3 mois","À vie"].map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">Notes</label>
                <textarea value={prescNotes} onChange={e => setPrescNotes(e.target.value)} rows={2}
                  placeholder="Conseils, contre-indications..."
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowPrescModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-all">Annuler</button>
                <button type="button" disabled={createPrescMutation.isPending || !prescDiagnosis.trim()}
                  onClick={() => { if (!prescDiagnosis.trim()) { toast.error("Diagnostic requis"); return; } if (!prescMeds.some(m => m.name.trim())) { toast.error("Au moins un médicament requis"); return; } createPrescMutation.mutate(); }}
                  className="flex-1 py-2.5 rounded-xl gradient-primary text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50">
                  {createPrescMutation.isPending ? "Création..." : "Créer l'ordonnance"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Rapport de consultation (create + edit) ── */}
      {showConsultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setShowConsultModal(false); setEditingConsultation(null); }} />
          <div className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-xl p-6 max-h-[90vh] overflow-y-auto custom-scroll">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-foreground">{editingConsultation ? "Modifier le rapport" : "Nouveau rapport"}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Patient : {patient.fullName}</p>
              </div>
              <button onClick={() => { setShowConsultModal(false); setEditingConsultation(null); }} className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleConsultSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">Date *</label>
                  <input type="date" required value={consultForm.date} onChange={e => setConsultForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">Heure *</label>
                  <input type="time" required value={consultForm.time} onChange={e => setConsultForm(f => ({ ...f, time: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">Type</label>
                <select value={consultForm.type} onChange={e => setConsultForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
                  {CONSULTATION_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">Diagnostic</label>
                <input value={consultForm.diagnosis} onChange={e => setConsultForm(f => ({ ...f, diagnosis: e.target.value }))}
                  placeholder="Ex: Hypertension artérielle..."
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">Notes cliniques</label>
                <textarea rows={3} value={consultForm.notes} onChange={e => setConsultForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Observations, symptômes..."
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">Traitement prescrit</label>
                <textarea rows={2} value={consultForm.treatment} onChange={e => setConsultForm(f => ({ ...f, treatment: e.target.value }))}
                  placeholder="Médicaments, posologie..."
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Prochain rendez-vous
                  {!editingConsultation && <span className="text-muted-foreground font-normal ml-1">(crée automatiquement un RDV de suivi)</span>}
                </label>
                <input type="date" value={consultForm.nextVisit} onChange={e => setConsultForm(f => ({ ...f, nextVisit: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowConsultModal(false); setEditingConsultation(null); }}
                  className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-all">Annuler</button>
                <button type="submit" disabled={createConsultMutation.isPending}
                  className="flex-1 py-2.5 rounded-xl gradient-primary text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                  {createConsultMutation.isPending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : editingConsultation ? "Enregistrer" : "Créer le rapport"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Modifier patient ────────────────────────── */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowEditModal(false)} />
          <div className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-xl p-6 max-h-[90vh] overflow-y-auto custom-scroll">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-foreground">Modifier le patient</h2>
              <button onClick={() => setShowEditModal(false)} className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-foreground mb-1.5">Nom complet *</label>
                  <input required value={editForm.fullName} onChange={e => setEditForm(f => ({ ...f, fullName: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">Téléphone *</label>
                  <input required value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">Genre</label>
                  <select value={editForm.gender} onChange={e => setEditForm(f => ({ ...f, gender: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
                    <option value="male">Homme</option><option value="female">Femme</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">Email</label>
                  <input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">Date de naissance</label>
                  <input type="date" value={editForm.dateOfBirth} onChange={e => setEditForm(f => ({ ...f, dateOfBirth: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">Groupe sanguin</label>
                  <select value={editForm.bloodType} onChange={e => setEditForm(f => ({ ...f, bloodType: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
                    <option value="">Inconnu</option>
                    {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-foreground mb-1.5">Adresse</label>
                  <input value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">Statut</label>
                  <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
                    <option value="active">Actif</option><option value="inactive">Inactif</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-all">Annuler</button>
                <button type="submit" disabled={updateMutation.isPending} className="flex-1 py-2.5 rounded-xl gradient-primary text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                  {updateMutation.isPending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Nouveau RDV ──────────────────────────────── */}
      {showAptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAptModal(false)} />
          <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-foreground">Nouveau rendez-vous</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Pour : {patient.fullName}</p>
              </div>
              <button onClick={() => setShowAptModal(false)} className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleAptSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">Date *</label>
                  <input type="date" required value={aptForm.date} onChange={e => setAptForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">Heure *</label>
                  <input type="time" required value={aptForm.time} onChange={e => setAptForm(f => ({ ...f, time: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">Type</label>
                <select value={aptForm.type} onChange={e => setAptForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
                  {CONSULTATION_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">Notes</label>
                <textarea rows={2} value={aptForm.notes} onChange={e => setAptForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes optionnelles..."
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none" />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowAptModal(false)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-all">Annuler</button>
                <button type="submit" disabled={createAptMutation.isPending} className="flex-1 py-2.5 rounded-xl gradient-primary text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                  {createAptMutation.isPending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Créer le RDV"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    
      {/* ── Modal: Reporter un RDV ──────────────────────── */}
      {reportingApt && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
          <div className='absolute inset-0 bg-black/40 backdrop-blur-sm' onClick={() => setReportingApt(null)} />
          <div className='relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-xl p-6'>
            <div className='flex items-center justify-between mb-5'>
              <div>
                <h2 className='text-lg font-bold text-foreground'>Reporter le RDV</h2>
                <p className='text-xs text-muted-foreground mt-0.5'>Choisir une nouvelle date</p>
              </div>
              <button onClick={() => setReportingApt(null)} className='w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted'>
                <X className='w-4 h-4' />
              </button>
            </div>
            <form onSubmit={async (e) => { e.preventDefault(); if (!reportingApt || !reportDate) return; await rescheduleMutation.mutateAsync({ id: reportingApt.id, date: reportDate, time: reportTime }); setReportingApt(null); }} className='space-y-4'>
              <div>
                <label className='block text-xs font-semibold text-foreground mb-1.5'>Nouvelle date *</label>
                <input type='date' required value={reportDate} onChange={e => setReportDate(e.target.value)} min={new Date().toISOString().split('T')[0]}
                  className='w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all' />
              </div>
              <div>
                <label className='block text-xs font-semibold text-foreground mb-1.5'>Nouvelle heure</label>
                <input type='time' value={reportTime} onChange={e => setReportTime(e.target.value)}
                  className='w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all' />
              </div>
              <div className='flex gap-3'>
                <button type='button' onClick={() => setReportingApt(null)} className='flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-all'>Annuler</button>
                <button type='submit' disabled={rescheduleMutation.isPending || !reportDate}
                  className='flex-1 py-2.5 rounded-xl gradient-primary text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-60 flex items-center justify-center gap-2'>
                  {rescheduleMutation.isPending ? <div className='w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin' /> : 'Reporter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ── Modal: Modifier une ordonnance ───────────────── */}
      {editingPresc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditingPresc(null)} />
          <div className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-xl p-6 max-h-[90vh] overflow-y-auto custom-scroll">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-foreground">Modifier l&apos;ordonnance</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Patient : {patient.fullName}</p>
              </div>
              <button onClick={() => setEditingPresc(null)} className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted"><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">Diagnostic *</label>
                <input value={editPrescDiag} onChange={e => setEditPrescDiag(e.target.value)}
                  placeholder="Ex: Infection respiratoire, Hypertension..."
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5"><Pill className="w-3.5 h-3.5 text-primary" /> Médicaments *</label>
                  <button type="button" onClick={() => setEditPrescMeds(m => [...m, { name: "", dosage: "", frequency: "1×/jour", duration: "7 jours", instructions: "" }])}
                    className="text-xs text-primary hover:underline font-semibold flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Ajouter
                  </button>
                </div>
                <div className="space-y-2">
                  {editPrescMeds.map((med, idx) => (
                    <div key={idx} className="bg-muted/20 border border-border rounded-xl p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">{idx + 1}</div>
                        <input value={med.name} onChange={e => setEditPrescMeds(m => m.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))}
                          placeholder="Médicament *" className="flex-1 px-2 py-1.5 rounded-lg border border-border bg-background/50 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 font-semibold" />
                        <input value={med.dosage} onChange={e => setEditPrescMeds(m => m.map((x, i) => i === idx ? { ...x, dosage: e.target.value } : x))}
                          placeholder="500mg" className="w-20 px-2 py-1.5 rounded-lg border border-border bg-background/50 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20" />
                        {editPrescMeds.length > 1 && (
                          <button type="button" onClick={() => setEditPrescMeds(m => m.filter((_, i) => i !== idx))}
                            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-red-100 text-muted-foreground hover:text-red-500 flex-shrink-0">
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-muted-foreground block mb-0.5">Fréquence</label>
                          <select value={med.frequency} onChange={e => setEditPrescMeds(m => m.map((x, i) => i === idx ? { ...x, frequency: e.target.value } : x))}
                            className="w-full px-2 py-1.5 rounded-lg border border-border bg-background/50 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20">
                            {["1×/jour","2×/jour","3×/jour","Matin-Soir","Matin-Midi-Soir","Si besoin","Le soir","À jeun"].map(f => <option key={f} value={f}>{f}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground block mb-0.5">Durée</label>
                          <select value={med.duration} onChange={e => setEditPrescMeds(m => m.map((x, i) => i === idx ? { ...x, duration: e.target.value } : x))}
                            className="w-full px-2 py-1.5 rounded-lg border border-border bg-background/50 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20">
                            {["3 jours","5 jours","7 jours","10 jours","14 jours","1 mois","3 mois","À vie"].map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">Notes</label>
                <textarea value={editPrescNotes} onChange={e => setEditPrescNotes(e.target.value)} rows={2}
                  placeholder="Conseils, contre-indications..."
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setEditingPresc(null)}
                  className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-all">Annuler</button>
                <button type="button" disabled={updatePrescMutation.isPending || !editPrescDiag.trim()}
                  onClick={() => { if (!editPrescDiag.trim()) { toast.error("Diagnostic requis"); return; } updatePrescMutation.mutate(editingPresc.id); }}
                  className="flex-1 py-2.5 rounded-xl gradient-primary text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50">
                  {updatePrescMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}