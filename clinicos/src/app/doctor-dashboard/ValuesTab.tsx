"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell,
  PieChart, Pie, Legend,
} from "recharts";
import {
  Upload, Loader2, AlertTriangle, CheckCircle2, XCircle,
  Microscope, TrendingUp, Info, X, ChevronRight, Plus,
  FileText, Clock, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExtractedValue {
  label: string;
  value: string;
  unit: string;
  refMin: number | null;
  refMax: number | null;
  status: "ok" | "warn" | "danger";
  category: string;
}

interface LabReport {
  id: string;
  uploadedAt: string;
  imageName?: string;
  imageThumb?: string;   // small base64 (max 400px, 60%) for list
  imagePreview?: string; // medium base64 (max 1400px, 90%) for lightbox
  labName?: string;
  reportDate?: string;
  summary?: string;
  values: ExtractedValue[];
  medicalReport?: string;
  // generation options
  hasGraphs?: boolean;
  hasReport?: boolean;
}

interface ValuesTabProps {
  patientId: string;
  patientName?: string;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

const REPORTS_KEY = (id: string) => `clinicos-lab-reports-${id}`;

function loadReports(patientId: string): LabReport[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(REPORTS_KEY(patientId)) ?? "[]") || []; } catch { return []; }
}
function saveReports(patientId: string, reports: LabReport[]) {
  try { localStorage.setItem(REPORTS_KEY(patientId), JSON.stringify(reports)); } catch {}
}

// ─── Image utilities ──────────────────────────────────────────────────────────

/** Compress image — maxPx sets the larger dimension, quality 0-1 */
async function compressImage(dataUrl: string, maxPx: number, quality: number): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width  = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve("");
    img.src = dataUrl;
  });
}

const compressToThumb   = (url: string) => compressImage(url, 400,  0.6);
const compressToPreview = (url: string) => compressImage(url, 1400, 0.9);

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS = {
  ok:     { label: "Normal",    color: "#10b981", bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-800" },
  warn:   { label: "Attention", color: "#f59e0b", bg: "bg-amber-50 dark:bg-amber-950/30",    text: "text-amber-700 dark:text-amber-300",     border: "border-amber-200 dark:border-amber-800" },
  danger: { label: "Critique",  color: "#ef4444", bg: "bg-red-50 dark:bg-red-950/30",        text: "text-red-700 dark:text-red-300",         border: "border-red-200 dark:border-red-800" },
};

// ─── Markdown-lite renderer ───────────────────────────────────────────────────

function MdText({ text }: { text: string }) {
  return (
    <div className="space-y-1.5 text-xs text-foreground leading-relaxed">
      {text.split("\n").map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1.5" />;
        const parts = line.split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
          p.startsWith("**") && p.endsWith("**") ? <strong key={j}>{p.slice(2, -2)}</strong> : p
        );
        if (/^\d+\./.test(line)) return <p key={i} className="pl-3 border-l-2 border-primary/30">{parts}</p>;
        if (line.startsWith("- ") || line.startsWith("• ")) return <p key={i} className="pl-3 flex gap-2"><span className="text-primary flex-shrink-0 mt-0.5">•</span><span>{parts}</span></p>;
        if (line.startsWith("#")) return <p key={i} className="font-bold text-foreground mt-2 first:mt-0">{line.replace(/^#+\s*/, "")}</p>;
        return <p key={i}>{parts}</p>;
      })}
    </div>
  );
}

// ─── Value Card ────────────────────────────────────────────────────────────────

function ValueCard({ v, onClick }: { v: ExtractedValue; onClick?: () => void }) {
  const s = STATUS[v.status];
  const num = parseFloat(v.value);
  const hasRange = v.refMin !== null && v.refMax !== null;
  const pct = hasRange && !isNaN(num)
    ? Math.min(100, Math.max(0, ((num - v.refMin!) / ((v.refMax! - v.refMin!) || 1)) * 100))
    : null;
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-xl border p-3 flex flex-col gap-2 text-left w-full transition-all group relative",
        s.bg, s.border,
        onClick && "cursor-pointer hover:shadow-md hover:scale-[1.02]"
      )}>
      <div className="flex items-start justify-between gap-1">
        <span className="text-[11px] text-muted-foreground font-medium leading-tight">{v.label}</span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {v.status === "ok"     && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
          {v.status === "warn"   && <AlertTriangle className="w-3 h-3 text-amber-500" />}
          {v.status === "danger" && <AlertTriangle className="w-3 h-3 text-red-500" />}
          {onClick && <ChevronRight className="w-3 h-3 text-muted-foreground/0 group-hover:text-muted-foreground transition-all" />}
        </div>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={cn("text-xl font-bold", s.text)}>{v.value}</span>
        <span className="text-[10px] text-muted-foreground">{v.unit}</span>
      </div>
      {hasRange && (
        <>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${pct ?? 50}%`, background: STATUS[v.status].color }} />
          </div>
          <p className="text-[9px] text-muted-foreground">Réf: {v.refMin} – {v.refMax} {v.unit}</p>
        </>
      )}
    </div>
  );
}

// ─── Value Detail Panel ───────────────────────────────────────────────────────

function DetailPanel({ v, patientName, onClose }: {
  v: ExtractedValue;
  patientName?: string;
  onClose: () => void;
}) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);
  const s = STATUS[v.status];

  useEffect(() => {
    let cancelled = false;
    const prompt = `Tu es un médecin expert en biologie médicale. Analyse cette valeur biologique et donne une explication détaillée.

**Valeur:** ${v.label}
**Résultat:** ${v.value} ${v.unit}
**Plage normale:** ${v.refMin ?? "?"} – ${v.refMax ?? "?"} ${v.unit}
**Statut:** ${v.status === "danger" ? "CRITIQUE" : v.status === "warn" ? "ATTENTION" : "NORMAL"}
${patientName ? `**Patient:** ${patientName}` : ""}

Donne une réponse structurée avec:

**Qu'est-ce que cet examen mesure ?**
Explication simple de ce que mesure cet examen et son rôle dans l'organisme.

**Pourquoi cette valeur est ${v.status === "ok" ? "normale" : "anormale"} ?**
Interprétation clinique précise de ce résultat.

**Causes possibles** ${v.status !== "ok" ? "(les plus fréquentes)" : ""}
Liste des causes principales de ce résultat.

**Risques associés**
Quels sont les risques si ce n'est pas traité (si anormal) ou les implications.

**Recommandations médicales**
Ce que le médecin doit envisager comme bilan complémentaire ou traitement.

**Conseils pratiques pour le patient**
Instructions concrètes: alimentation, activité physique, médicaments, signes d'alarme, quand consulter.

Réponse concise, professionnelle, en français.`;

    fetch("/api/v1/medical-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        values: [v],
        patientName,
        summary: `Analyse de: ${v.label} = ${v.value} ${v.unit}`,
        reportDate: null,
        customPrompt: prompt,
      }),
    })
      .then(r => r.json())
      .then(d => { if (!cancelled) setExplanation(d.report ?? d.error ?? "Analyse non disponible."); })
      .catch(() => { if (!cancelled) setExplanation("Erreur de connexion."); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [v, patientName]);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-lg h-full bg-card shadow-2xl flex flex-col overflow-hidden">
        <div className={cn("px-6 py-4 border-b border-border flex items-start justify-between gap-4", s.bg)}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {v.status === "danger" && <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />}
              {v.status === "warn"   && <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />}
              {v.status === "ok"     && <CheckCircle2  className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
              <h2 className="text-base font-bold text-foreground">{v.label}</h2>
              <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full border", s.bg, s.border, s.text)}>{s.label}</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className={cn("text-2xl font-bold", s.text)}>{v.value}</span>
              <span className="text-sm text-muted-foreground">{v.unit}</span>
              {v.refMin !== null && v.refMax !== null && (
                <span className="text-xs text-muted-foreground ml-2">(norme: {v.refMin} – {v.refMax} {v.unit})</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-muted flex items-center justify-center flex-shrink-0">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Analyse médicale en cours...</p>
            </div>
          ) : explanation ? <MdText text={explanation} /> : null}
        </div>
      </div>
    </div>
  );
}

// ─── Charts ────────────────────────────────────────────────────────────────────

function StatusPieChart({ values }: { values: ExtractedValue[] }) {
  const ok = values.filter(v => v.status === "ok").length;
  const warn = values.filter(v => v.status === "warn").length;
  const danger = values.filter(v => v.status === "danger").length;
  const data = [
    { name: "Normal",    value: ok,     fill: "#10b981" },
    { name: "Attention", value: warn,   fill: "#f59e0b" },
    { name: "Critique",  value: danger, fill: "#ef4444" },
  ].filter(d => d.value > 0);

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
        <TrendingUp className="w-3.5 h-3.5 text-primary" /> Répartition des valeurs
      </h4>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
            {data.map((e, i) => <Cell key={i} fill={e.fill} />)}
          </Pie>
          <Legend formatter={v => <span className="text-xs text-muted-foreground">{v}</span>} />
          <Tooltip formatter={(val: any) => [`${val} valeur${val !== 1 ? "s" : ""}`, ""]} />
        </PieChart>
      </ResponsiveContainer>
      <div className="grid grid-cols-3 gap-2 mt-2">
        {[{ label: "Normal", count: ok, color: "text-emerald-600" }, { label: "Attention", count: warn, color: "text-amber-600" }, { label: "Critique", count: danger, color: "text-red-600" }]
          .map(({ label, count, color }) => (
            <div key={label} className="text-center bg-muted/30 rounded-xl py-2">
              <p className={cn("text-2xl font-bold", color)}>{count}</p>
              <p className="text-[9px] text-muted-foreground">{label}</p>
            </div>
          ))}
      </div>
    </div>
  );
}

function ValuesBarChart({ values }: { values: ExtractedValue[] }) {
  const withRange = values.filter(v => v.refMin !== null && v.refMax !== null && !isNaN(parseFloat(v.value))).slice(0, 12);
  if (!withRange.length) return null;
  const data = withRange.map(v => {
    const num = parseFloat(v.value);
    const mid = (v.refMin! + v.refMax!) / 2;
    const range = v.refMax! - v.refMin!;
    return {
      name: v.label.length > 14 ? v.label.slice(0, 13) + "…" : v.label,
      fullName: v.label, value: Math.round(range > 0 ? ((num - mid) / (range / 2)) * 50 + 50 : 50),
      actual: num, unit: v.unit, refMin: v.refMin, refMax: v.refMax, status: v.status,
    };
  });
  const Tip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-card border border-border rounded-xl p-3 shadow-lg text-xs space-y-1">
        <p className="font-semibold">{d.fullName}</p>
        <p className="text-muted-foreground">Valeur: <strong>{d.actual} {d.unit}</strong></p>
        <p className="text-muted-foreground">Réf: {d.refMin} – {d.refMax} {d.unit}</p>
        <span className={cn("inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold", STATUS[d.status as keyof typeof STATUS].bg, STATUS[d.status as keyof typeof STATUS].text)}>
          {STATUS[d.status as keyof typeof STATUS].label}
        </span>
      </div>
    );
  };
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <h4 className="text-xs font-semibold text-foreground mb-1 flex items-center gap-2"><TrendingUp className="w-3.5 h-3.5 text-primary" />Positionnement dans les normes</h4>
      <p className="text-[10px] text-muted-foreground mb-3">50% = centre de la plage normale</p>
      <ResponsiveContainer width="100%" height={Math.max(180, withRange.length * 26)}>
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 40, top: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
          <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} />
          <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} />
          <Tooltip content={<Tip />} />
          <ReferenceLine x={50} stroke="#6b7280" strokeDasharray="4 4" />
          <ReferenceLine x={20} stroke="#f59e0b" strokeDasharray="2 2" strokeOpacity={0.5} />
          <ReferenceLine x={80} stroke="#f59e0b" strokeDasharray="2 2" strokeOpacity={0.5} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={16}>
            {data.map((d, i) => <Cell key={i} fill={STATUS[d.status as keyof typeof STATUS].color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CategoryRadarChart({ values }: { values: ExtractedValue[] }) {
  const cats = Array.from(new Set(values.map(v => v.category))).slice(0, 8);
  if (cats.length < 3) return null;
  const data = cats.map(cat => {
    const cv = values.filter(v => v.category === cat);
    return { category: cat.length > 16 ? cat.slice(0, 15) + "…" : cat, score: Math.round((cv.filter(v => v.status === "ok").length / cv.length) * 100) };
  });
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2"><TrendingUp className="w-3.5 h-3.5 text-primary" />Score par catégorie</h4>
      <ResponsiveContainer width="100%" height={240}>
        <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis dataKey="category" tick={{ fontSize: 10, fill: "#6b7280" }} />
          <Radar name="Score" dataKey="score" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.25} strokeWidth={2} />
          <Tooltip formatter={(val: any) => [`${val}% normal`, "Score"]} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Report Card (in timeline list) ──────────────────────────────────────────

function ReportCard({ report, isSelected, onClick, onDelete }: {
  report: LabReport;
  isSelected: boolean;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const danger  = report.values.filter(v => v.status === "danger").length;
  const warn    = report.values.filter(v => v.status === "warn").length;
  const ok      = report.values.filter(v => v.status === "ok").length;
  const date    = new Date(report.uploadedAt);
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all border group",
        isSelected ? "bg-primary/5 border-primary/30 shadow-sm" : "bg-card border-border hover:bg-accent/40"
      )}>
      {/* Thumbnail */}
      <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-muted border border-border">
        {report.imageThumb
          ? <img src={report.imageThumb} alt="" className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center"><FileText className="w-5 h-5 text-muted-foreground" /></div>
        }
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground truncate">
          {report.labName ?? (report.imageName?.replace(/\.[^.]+$/, "") ?? "Rapport")}
        </p>
        <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
          <Clock className="w-2.5 h-2.5" />
          {format(date, "d MMM yyyy · HH:mm", { locale: fr })}
        </p>
        <div className="flex items-center gap-1.5 mt-1">
          {danger > 0 && <span className="text-[9px] font-bold text-red-600 bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded-full">{danger} crit.</span>}
          {warn   > 0 && <span className="text-[9px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded-full">{warn} att.</span>}
          <span className="text-[9px] text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded-full">{ok} norm.</span>
          {report.medicalReport && <span className="text-[9px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">Rapport ✓</span>}
        </div>
      </div>
      {/* Delete */}
      <button
        onClick={onDelete}
        className="w-6 h-6 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
        title="Supprimer">
        <Trash2 className="w-3 h-3" />
      </button>
    </button>
  );
}

// ─── Generate Choice Modal ────────────────────────────────────────────────────

function GenerateChoiceModal({ report, onConfirm, onClose }: {
  report: LabReport;
  onConfirm: (graphs: boolean, fullReport: boolean) => void;
  onClose: () => void;
}) {
  const [graphs, setGraphs]         = useState(true);
  const [fullReport, setFullReport] = useState(true);
  const danger = report.values.filter(v => v.status === "danger").length;
  const warn   = report.values.filter(v => v.status === "warn").length;
  const ok     = report.values.filter(v => v.status === "ok").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Microscope className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Rapport extrait avec succès</h3>
              <p className="text-[10px] text-muted-foreground">{report.labName ?? report.imageName ?? "Rapport biologique"}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Extraction summary */}
        <div className="px-6 py-4 bg-muted/20 border-b border-border/60">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <p className="text-xs font-semibold text-foreground">{report.values.length} valeurs biologiques extraites</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full">{ok} normales</span>
            {warn   > 0 && <span className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full">{warn} attention</span>}
            {danger > 0 && <span className="text-[10px] text-red-600 bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded-full">{danger} critiques</span>}
          </div>
          {report.summary && <p className="text-[10px] text-muted-foreground mt-2 italic">{report.summary}</p>}
        </div>

        {/* Options */}
        <div className="px-6 py-4 space-y-3">
          <p className="text-xs font-semibold text-foreground mb-2">Que souhaitez-vous générer ?</p>

          <label className={cn(
            "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all",
            graphs ? "bg-primary/5 border-primary/30" : "bg-muted/30 border-border hover:bg-muted/50"
          )}>
            <input type="checkbox" checked={graphs} onChange={e => setGraphs(e.target.checked)} className="w-4 h-4 accent-primary" />
            <div>
              <p className="text-xs font-semibold text-foreground">Analyse graphique</p>
              <p className="text-[10px] text-muted-foreground">Donut, histogramme et radar de positionnement</p>
            </div>
          </label>

          <label className={cn(
            "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all",
            fullReport ? "bg-primary/5 border-primary/30" : "bg-muted/30 border-border hover:bg-muted/50"
          )}>
            <input type="checkbox" checked={fullReport} onChange={e => setFullReport(e.target.checked)} className="w-4 h-4 accent-primary" />
            <div>
              <p className="text-xs font-semibold text-foreground">Rapport médical complet</p>
              <p className="text-[10px] text-muted-foreground">Diagnostic, recommandations, plan de suivi par IA</p>
            </div>
          </label>

          {!graphs && !fullReport && (
            <p className="text-[10px] text-amber-600 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Sélectionnez au moins une option ou continuez avec les valeurs uniquement.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 pb-5 flex gap-3">
          <button
            onClick={() => onConfirm(graphs, fullReport)}
            className="flex-1 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
            <Microscope className="w-4 h-4" />
            {(!graphs && !fullReport) ? "Enregistrer les valeurs" : "Générer"}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-xl transition-colors">
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Upload Zone ──────────────────────────────────────────────────────────────

function UploadZone({ onFile, compact = false }: { onFile: (f: File) => void; compact?: boolean }) {
  const [dragOver, setDragOver] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
      onClick={() => ref.current?.click()}
      className={cn(
        "border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all",
        dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-primary/5",
        compact ? "p-4" : "p-8"
      )}>
      <div className={cn("rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3", compact ? "w-10 h-10" : "w-14 h-14")}>
        <Upload className={cn("text-primary", compact ? "w-5 h-5" : "w-7 h-7")} />
      </div>
      <p className={cn("font-semibold text-foreground mb-1", compact ? "text-xs" : "text-sm")}>
        {compact ? "Ajouter un rapport" : "Déposez ou cliquez pour analyser un rapport"}
      </p>
      {!compact && <p className="text-xs text-muted-foreground">Image JPG, PNG · Rapport de laboratoire, bilan biologique</p>}
      <input ref={ref} type="file" accept="image/*,.pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { onFile(f); e.target.value = ""; } }} />
    </div>
  );
}

// ─── Main ValuesTab ───────────────────────────────────────────────────────────

export function ValuesTab({ patientId, patientName }: ValuesTabProps) {
  const [reports, setReports]         = useState<LabReport[]>(() => loadReports(patientId));
  const [selectedId, setSelectedId]   = useState<string | null>(() => loadReports(patientId)[0]?.id ?? null);
  const [uploading, setUploading]     = useState(false);
  const [uploadStep, setUploadStep]   = useState<"" | "extracting" | "reporting">("");
  const [selectedValue, setSelectedValue]     = useState<ExtractedValue | null>(null);
  const [lightboxSrc, setLightboxSrc]         = useState<string | null>(null);
  const [pendingReport, setPendingReport]     = useState<LabReport | null>(null); // waiting for user choice

  // Reset when patient changes
  useEffect(() => {
    const r = loadReports(patientId);
    setReports(r);
    setSelectedId(r[0]?.id ?? null);
    setSelectedValue(null);
  }, [patientId]);

  const selectedReport = reports.find(r => r.id === selectedId) ?? null;

  // ── Save helper ─────────────────────────────────────────────────────────────
  const updateAndSave = useCallback((next: LabReport[]) => {
    setReports(next);
    saveReports(patientId, next);
  }, [patientId]);

  // ── Upload → extract → show choice modal ──────────────────────────────────
  const handleFile = useCallback(async (file: File) => {
    setUploading(true);
    setUploadStep("extracting");

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      const b64 = dataUrl.split(",")[1];

      // Compress both sizes in parallel
      const [thumb, preview] = await Promise.all([
        compressToThumb(dataUrl).catch(() => ""),
        compressToPreview(dataUrl).catch(() => ""),
      ]);

      try {
        const extRes = await fetch("/api/v1/lab-extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: b64 }),
        });
        const extData = await extRes.json();
        if (!extRes.ok || extData.error) throw new Error(extData.error ?? "Extraction échouée");

        const extracted: LabReport = {
          id: `rep-${Date.now()}`,
          uploadedAt: new Date().toISOString(),
          imageName: file.name,
          imageThumb: thumb,
          imagePreview: preview,
          labName: extData.labName ?? undefined,
          reportDate: extData.reportDate ?? undefined,
          summary: extData.summary ?? undefined,
          values: extData.values ?? [],
        };

        setUploading(false);
        setUploadStep("");
        setPendingReport(extracted); // Show choice modal
      } catch (err) {
        console.error("Extraction failed:", err);
        setUploading(false);
        setUploadStep("");
      }
    };
    reader.readAsDataURL(file);
  }, []);

  // ── Confirm generation choices ─────────────────────────────────────────────
  const confirmGenerate = useCallback(async (wantGraphs: boolean, wantReport: boolean) => {
    if (!pendingReport) return;
    const report = { ...pendingReport, hasGraphs: wantGraphs, hasReport: wantReport };
    setPendingReport(null);

    // Save immediately (values are already extracted)
    const existing = loadReports(patientId);
    const withNew = [report, ...existing];
    updateAndSave(withNew);
    setSelectedId(report.id);

    // Generate medical report if requested
    if (wantReport) {
      setUploadStep("reporting");
      try {
        const repRes = await fetch("/api/v1/medical-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            values: report.values,
            patientName,
            summary: report.summary,
            reportDate: report.reportDate,
          }),
        });
        const repData = await repRes.json();
        const withReport = loadReports(patientId).map(r =>
          r.id === report.id ? { ...r, medicalReport: repData.report ?? undefined } : r
        );
        updateAndSave(withReport);
      } finally {
        setUploadStep("");
      }
    }
  }, [pendingReport, patientId, patientName, updateAndSave]);

  const deleteReport = useCallback((id: string) => {
    if (!confirm("Supprimer ce rapport ?")) return;
    const next = reports.filter(r => r.id !== id);
    updateAndSave(next);
    if (selectedId === id) setSelectedId(next[0]?.id ?? null);
  }, [reports, selectedId, updateAndSave]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const categories = selectedReport ? Array.from(new Set(selectedReport.values.map(v => v.category))) : [];
  const ok     = selectedReport?.values.filter(v => v.status === "ok").length    ?? 0;
  const warn   = selectedReport?.values.filter(v => v.status === "warn").length   ?? 0;
  const danger = selectedReport?.values.filter(v => v.status === "danger").length ?? 0;
  const score  = selectedReport?.values.length ? Math.round((ok / selectedReport.values.length) * 100) : 0;

  return (
    <div className="flex gap-4 h-full min-h-0">

      {/* ── LEFT: Reports timeline ── */}
      <div className="w-64 flex-shrink-0 flex flex-col gap-3 overflow-y-auto custom-scroll">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-semibold text-foreground">Rapports biologiques</h3>
          <span className="text-[10px] text-muted-foreground">{reports.length} rapport{reports.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Upload zone (compact if has reports) */}
        {uploading || uploadStep === "reporting" ? (
          <div className="bg-card border border-border rounded-2xl p-4 text-center space-y-2">
            <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto" />
            <p className="text-[10px] text-muted-foreground font-medium">
              {uploadStep === "extracting" ? "Lecture du rapport…" : "Génération du rapport médical…"}
            </p>
            <p className="text-[9px] text-muted-foreground">
              {uploadStep === "extracting" ? "GPT-4o extrait les valeurs biologiques" : "Analyse clinique en cours"}
            </p>
          </div>
        ) : (
          <UploadZone onFile={handleFile} compact={reports.length > 0} />
        )}

        {/* Reports list */}
        <div className="space-y-2">
          {reports.map(report => (
            <ReportCard
              key={report.id}
              report={report}
              isSelected={selectedId === report.id}
              onClick={() => setSelectedId(report.id)}
              onDelete={e => { e.stopPropagation(); deleteReport(report.id); }}
            />
          ))}
        </div>
      </div>

      {/* ── RIGHT: Selected report detail ── */}
      <div className="flex-1 min-w-0 overflow-y-auto custom-scroll space-y-4">
        {!selectedReport ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center py-16">
              <Microscope className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">Aucun rapport sélectionné</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Uploadez une image de rapport biologique pour commencer</p>
            </div>
          </div>
        ) : (
          <>
            {/* Report header */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-start gap-4">
                {selectedReport.imageThumb && (
                  <button
                    onClick={() => setLightboxSrc(selectedReport.imagePreview || selectedReport.imageThumb || null)}
                    className="w-16 h-16 rounded-xl overflow-hidden border border-border flex-shrink-0 hover:ring-2 hover:ring-primary transition-all cursor-zoom-in group relative"
                    title="Voir le rapport en grand">
                    <img src={selectedReport.imageThumb} alt="rapport" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <span className="text-white text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">Voir</span>
                    </div>
                  </button>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="text-sm font-bold text-foreground">
                      {selectedReport.labName ?? selectedReport.imageName?.replace(/\.[^.]+$/, "") ?? "Rapport biologique"}
                    </h3>
                    {selectedReport.reportDate && (
                      <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        Rapport du {format(new Date(selectedReport.reportDate), "d MMM yyyy", { locale: fr })}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-2">
                    Uploadé le {format(new Date(selectedReport.uploadedAt), "d MMM yyyy à HH:mm", { locale: fr })}
                  </p>
                  {/* Summary banner */}
                  {selectedReport.summary && (
                    <div className={cn(
                      "rounded-xl border p-2.5 flex items-start gap-2",
                      danger > 0 ? "bg-red-50 dark:bg-red-950/20 border-red-200" : warn > 0 ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200" : "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200"
                    )}>
                      {danger > 0 ? <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                        : warn > 0 ? <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                        : <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />}
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-foreground">{selectedReport.summary}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] text-emerald-600 font-medium">{ok} normales</span>
                          {warn   > 0 && <span className="text-[10px] text-amber-600 font-medium">{warn} attention</span>}
                          {danger > 0 && <span className="text-[10px] text-red-600 font-medium">{danger} critiques</span>}
                          <span className="text-[10px] text-muted-foreground ml-auto">Score: <strong>{score}%</strong></span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Values by category */}
            {categories.map(cat => {
              const catVals = selectedReport.values.filter(v => v.category === cat);
              const catDanger = catVals.filter(v => v.status === "danger").length;
              const catWarn   = catVals.filter(v => v.status === "warn").length;
              return (
                <div key={cat} className="bg-card border border-border rounded-2xl overflow-hidden">
                  <div className={cn("px-4 py-2.5 border-b border-border/60 flex items-center justify-between", catDanger > 0 ? "bg-red-50/60 dark:bg-red-950/10" : catWarn > 0 ? "bg-amber-50/60 dark:bg-amber-950/10" : "")}>
                    <h4 className="text-xs font-semibold text-foreground">{cat}</h4>
                    <div className="flex items-center gap-2">
                      {catDanger > 0 && <span className="text-[9px] font-bold text-red-600 bg-red-100 dark:bg-red-950/30 px-1.5 py-0.5 rounded-full">{catDanger} critique{catDanger !== 1 ? "s" : ""}</span>}
                      {catWarn   > 0 && <span className="text-[9px] font-bold text-amber-600 bg-amber-100 dark:bg-amber-950/30 px-1.5 py-0.5 rounded-full">{catWarn} attention</span>}
                    </div>
                  </div>
                  <div className="p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                    {catVals.map((v, i) => (
                      <ValueCard key={i} v={v} onClick={() => setSelectedValue(v)} />
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Charts — only if user chose them (or hasGraphs is undefined = old report) */}
            {selectedReport.values.length > 0 && selectedReport.hasGraphs !== false && (
              <div className="bg-muted/20 rounded-2xl border border-border/60 p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Analyse graphique</h3>
                  <span className="text-[10px] text-muted-foreground">{selectedReport.values.length} valeurs</span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <StatusPieChart values={selectedReport.values} />
                  {categories.length >= 3 && <CategoryRadarChart values={selectedReport.values} />}
                </div>
                <ValuesBarChart values={selectedReport.values} />
                <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                  <Info className="w-3 h-3 flex-shrink-0" />
                  Cliquez sur une valeur pour l&apos;analyser en détail.
                  {selectedReport.labName && ` Source: ${selectedReport.labName}.`}
                </p>
              </div>
            )}

            {/* Medical report — only if user chose it */}
            {selectedReport.hasReport !== false && <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border/60 flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Rapport médical complet</h3>
                {!selectedReport.medicalReport && (
                  <span className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded-full flex items-center gap-1 ml-auto">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" /> Génération en cours…
                  </span>
                )}
              </div>
              <div className="p-4">
                {selectedReport.medicalReport ? (
                  <MdText text={selectedReport.medicalReport} />
                ) : (
                  <div className="flex items-center gap-3 py-6 justify-center text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <p className="text-xs">Le rapport médical est en cours de génération par l&apos;IA…</p>
                  </div>
                )}
                <p className="text-[9px] text-muted-foreground mt-4 flex items-center gap-1">
                  <Info className="w-3 h-3 flex-shrink-0" />
                  Ce rapport est généré par IA à titre indicatif. Il ne remplace pas le jugement clinique du médecin.
                </p>
              </div>
            </div>}
          </>
        )}
      </div>

      {/* Value detail panel */}
      {selectedValue && (
        <DetailPanel v={selectedValue} patientName={patientName} onClose={() => setSelectedValue(null)} />
      )}

      {/* Generation choice modal */}
      {pendingReport && (
        <GenerateChoiceModal
          report={pendingReport}
          onConfirm={confirmGenerate}
          onClose={() => setPendingReport(null)}
        />
      )}

      {/* Image lightbox */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxSrc(null)}>
          <button
            onClick={() => setLightboxSrc(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
          <img
            src={lightboxSrc}
            alt="rapport biologique"
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
