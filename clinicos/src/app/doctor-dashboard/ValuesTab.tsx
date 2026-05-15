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
  FileText, Clock, Trash2, RefreshCw, Download, Edit2, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr, de as deLocale } from "date-fns/locale";

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
  lang?: "fr" | "de";
}

// ─── ValuesTab Translations ────────────────────────────────────────────────────

const VT = {
  fr: {
    reports: "Rapports biologiques", report: "rapport", addReport: "Ajouter un rapport",
    reading: "Lecture du rapport…", generating: "Génération du rapport médical…",
    extracting: "GPT-4o extrait les valeurs biologiques", analyzing: "Analyse clinique en cours",
    extracted: "valeurs biologiques extraites", chooseWhat: "Que souhaitez-vous générer ?",
    graphs: "Analyse graphique", graphsDesc: "Donut, histogramme et radar de positionnement",
    fullReport: "Rapport médical complet", fullReportDesc: "Diagnostic, recommandations, plan de suivi par IA",
    saveOnly: "Enregistrer les valeurs", generate: "Générer",
    cancel: "Annuler", noReport: "Aucun rapport sélectionné",
    uploadHint: "Uploadez une image de rapport biologique pour commencer",
    dropOrClick: "Déposez ou cliquez pour analyser un rapport",
    formats: "Image JPG, PNG · PDF — Rapport de laboratoire, bilan biologique",
    medicalReport: "Rapport médical complet", generating2: "Génération en cours…",
    generatingLong: "Le rapport médical est en cours de génération par l'IA…",
    disclaimer: "Ce rapport est généré par IA à titre indicatif. Il ne remplace pas le jugement clinique du médecin.",
    analyzeGraphic: "Analyse graphique", valuesCount: "valeurs",
    clickDetail: "Cliquez sur une valeur pour l'analyser en détail.",
    source: "Source:",
    detailAnalyzing: "Analyse médicale en cours...",
    normal: "Normal", attention: "Attention", critique: "Critique",
    globalScore: "Score global:",
    normales: "normales", surveillees: "à surveiller", critiques: "critiques",
    byCategory: "Score par catégorie", distribution: "Répartition des valeurs",
    positioning: "Positionnement dans les normes", positioningDesc: "50% = centre de la plage normale",
    ref: "Réf:", uploadedOn: "Uploadé le",
    reportFrom: "Rapport du", successExtracted: "valeurs biologiques extraites",
    view: "Voir", regenBtn: "Régénérer", regenLangBtn: "Régénérer en FR",
    regenLoading: "Régénération...", translateLabels: "Traduire labels", translatingLabels: "Traduction...",
    downloadPdf: "Télécharger PDF", downloading: "Génération PDF...",
    editValue: "Modifier la valeur", deleteValue: "Supprimer", deleteValueConfirm: "Supprimer cette valeur du rapport ?",
    editLabel: "Nom", editVal: "Valeur", editUnit: "Unité", editRefMin: "Réf. min", editRefMax: "Réf. max",
    editStatus: "Statut", editCategory: "Catégorie", saveEdit: "Enregistrer", cancelEdit: "Annuler",
    statusOk: "Normal", statusWarn: "Attention", statusDanger: "Critique",
  },
  de: {
    reports: "Biologische Berichte", report: "Bericht", addReport: "Bericht hinzufügen",
    reading: "Bericht wird gelesen…", generating: "Medizinischer Bericht wird erstellt…",
    extracting: "GPT-4o extrahiert biologische Werte", analyzing: "Klinische Analyse läuft",
    extracted: "biologische Werte extrahiert", chooseWhat: "Was möchten Sie erstellen?",
    graphs: "Grafische Analyse", graphsDesc: "Donut, Histogramm und Radar",
    fullReport: "Vollständiger Medizinbericht", fullReportDesc: "Diagnose, Empfehlungen, Nachsorgeplan durch KI",
    saveOnly: "Werte speichern", generate: "Erstellen",
    cancel: "Abbrechen", noReport: "Kein Bericht ausgewählt",
    uploadHint: "Laden Sie ein Bild des biologischen Berichts hoch, um zu beginnen",
    dropOrClick: "Ablegen oder klicken, um einen Bericht zu analysieren",
    formats: "Bild JPG, PNG · PDF — Laborbericht, biologisches Profil",
    medicalReport: "Vollständiger Medizinbericht", generating2: "Wird erstellt…",
    generatingLong: "Der Medizinbericht wird von der KI erstellt…",
    disclaimer: "Dieser Bericht wird von KI als Hinweis erstellt. Er ersetzt nicht das klinische Urteil des Arztes.",
    analyzeGraphic: "Grafische Analyse", valuesCount: "Werte",
    clickDetail: "Klicken Sie auf einen Wert, um ihn im Detail zu analysieren.",
    source: "Quelle:",
    detailAnalyzing: "Medizinische Analyse läuft...",
    normal: "Normal", attention: "Achtung", critique: "Kritisch",
    globalScore: "Gesamtpunktzahl:",
    normales: "normal", surveillees: "zu beachten", critiques: "kritisch",
    byCategory: "Punktzahl nach Kategorie", distribution: "Werteverteilung",
    positioning: "Positionierung im Normalbereich", positioningDesc: "50% = Mitte des Normalbereichs",
    ref: "Ref:", uploadedOn: "Hochgeladen am",
    reportFrom: "Bericht vom", successExtracted: "biologische Werte extrahiert",
    view: "Ansehen", regenBtn: "Neu generieren", regenLangBtn: "Auf Deutsch generieren",
    regenLoading: "Wird neu generiert...", translateLabels: "Labels übersetzen", translatingLabels: "Übersetzen...",
    downloadPdf: "PDF herunterladen", downloading: "PDF wird erstellt...",
    editValue: "Wert bearbeiten", deleteValue: "Löschen", deleteValueConfirm: "Diesen Wert aus dem Bericht löschen?",
    editLabel: "Name", editVal: "Wert", editUnit: "Einheit", editRefMin: "Ref. min", editRefMax: "Ref. max",
    editStatus: "Status", editCategory: "Kategorie", saveEdit: "Speichern", cancelEdit: "Abbrechen",
    statusOk: "Normal", statusWarn: "Achtung", statusDanger: "Kritisch",
  },
};
type VTLang = typeof VT.fr;

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

/** Convert first page of a PDF (base64) to a JPEG dataUrl using pdfjs-dist */
async function pdfToImageDataUrl(pdfBase64: string): Promise<string> {
  // Dynamic import — client only
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const pdfBytes = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0));
  const loadTask = pdfjsLib.getDocument({ data: pdfBytes });
  const pdf      = await loadTask.promise;
  const page     = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2.5 }); // high scale for clarity

  const canvas = document.createElement("canvas");
  canvas.width  = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx as any, viewport, canvas }).promise;
  return canvas.toDataURL("image/jpeg", 0.92);
}

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

function ValueCard({ v, onClick, onEdit, onDelete }: { v: ExtractedValue; onClick?: () => void; onEdit?: () => void; onDelete?: () => void }) {
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
      {(onEdit || onDelete) && (
        <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <button onClick={e => { e.stopPropagation(); onEdit(); }}
              className="w-5 h-5 rounded-md bg-card/90 border border-border shadow-sm flex items-center justify-center hover:bg-primary/10 hover:border-primary/30 text-muted-foreground hover:text-primary transition-colors">
              <Edit2 className="w-2.5 h-2.5" />
            </button>
          )}
          {onDelete && (
            <button onClick={e => { e.stopPropagation(); onDelete(); }}
              className="w-5 h-5 rounded-md bg-card/90 border border-border shadow-sm flex items-center justify-center hover:bg-red-50 hover:border-red-200 text-muted-foreground hover:text-red-500 transition-colors">
              <Trash2 className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Value Detail Panel ───────────────────────────────────────────────────────

function DetailPanel({ v, patientName, onClose, lang }: {
  v: ExtractedValue;
  patientName?: string;
  onClose: () => void;
  lang?: "fr" | "de";
}) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);
  const s = STATUS[v.status];
  const dvt = VT[lang ?? "fr"];

  useEffect(() => {
    let cancelled = false;
    const isDE = lang === "de";
    const statusLabel = v.status === "danger"
      ? (isDE ? "KRITISCH" : "CRITIQUE")
      : v.status === "warn"
      ? (isDE ? "ACHTUNG" : "ATTENTION")
      : (isDE ? "NORMAL" : "NORMAL");
    const normalAbnormal = v.status === "ok"
      ? (isDE ? "normal" : "normale")
      : (isDE ? "abnormal" : "anormale");

    const prompt = isDE
      ? `Du bist ein Experte für medizinische Biologie. Analysiere diesen biologischen Wert und gib eine detaillierte Erklärung auf Deutsch.

**Wert:** ${v.label}
**Ergebnis:** ${v.value} ${v.unit}
**Normalbereich:** ${v.refMin ?? "?"} – ${v.refMax ?? "?"} ${v.unit}
**Status:** ${statusLabel}
${patientName ? `**Patient:** ${patientName}` : ""}

Gib eine strukturierte Antwort auf Deutsch mit:

**Was misst dieser Test?**
Einfache Erklärung, was dieser Test misst und welche Rolle er im Körper spielt.

**Warum ist dieser Wert ${normalAbnormal}?**
Genaue klinische Interpretation dieses Ergebnisses.

**Mögliche Ursachen** ${v.status !== "ok" ? "(die häufigsten)" : ""}
Liste der Hauptursachen für dieses Ergebnis.

**Verbundene Risiken**
Welche Risiken bestehen, wenn es nicht behandelt wird (falls abnormal).

**Medizinische Empfehlungen**
Was der Arzt als ergänzende Untersuchungen oder Behandlung in Betracht ziehen sollte.

**Praktische Tipps für den Patienten**
Konkrete Anweisungen: Ernährung, körperliche Aktivität, Medikamente, Warnsignale, wann sofort zum Arzt.

Antwort präzise, professionell, auf Deutsch.`
      : `Tu es un médecin expert en biologie médicale. Analyse cette valeur biologique et donne une explication détaillée.

**Valeur:** ${v.label}
**Résultat:** ${v.value} ${v.unit}
**Plage normale:** ${v.refMin ?? "?"} – ${v.refMax ?? "?"} ${v.unit}
**Statut:** ${statusLabel}
${patientName ? `**Patient:** ${patientName}` : ""}

Donne une réponse structurée avec:

**Qu'est-ce que cet examen mesure ?**
Explication simple de ce que mesure cet examen et son rôle dans l'organisme.

**Pourquoi cette valeur est ${normalAbnormal} ?**
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
        lang,
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
              <p className="text-sm text-muted-foreground">{dvt.detailAnalyzing}</p>
            </div>
          ) : explanation ? <MdText text={explanation} /> : null}
        </div>
      </div>
    </div>
  );
}

// ─── Charts ────────────────────────────────────────────────────────────────────

function StatusPieChart({ values, vt }: { values: ExtractedValue[]; vt: VTLang }) {
  const ok = values.filter(v => v.status === "ok").length;
  const warn = values.filter(v => v.status === "warn").length;
  const danger = values.filter(v => v.status === "danger").length;
  const data = [
    { name: vt.normal,    value: ok,     fill: "#10b981" },
    { name: vt.attention, value: warn,   fill: "#f59e0b" },
    { name: vt.critique,  value: danger, fill: "#ef4444" },
  ].filter(d => d.value > 0);

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
        <TrendingUp className="w-3.5 h-3.5 text-primary" /> {vt.distribution}
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
        {[{ label: vt.normal, count: ok, color: "text-emerald-600" }, { label: vt.attention, count: warn, color: "text-amber-600" }, { label: vt.critique, count: danger, color: "text-red-600" }]
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

function ValuesBarChart({ values, vt }: { values: ExtractedValue[]; vt: VTLang }) {
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
      <h4 className="text-xs font-semibold text-foreground mb-1 flex items-center gap-2"><TrendingUp className="w-3.5 h-3.5 text-primary" />{vt.positioning}</h4>
      <p className="text-[10px] text-muted-foreground mb-3">{vt.positioningDesc}</p>
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

function CategoryRadarChart({ values, vt }: { values: ExtractedValue[]; vt: VTLang }) {
  const cats = Array.from(new Set(values.map(v => v.category))).slice(0, 8);
  if (cats.length < 3) return null;
  const data = cats.map(cat => {
    const cv = values.filter(v => v.category === cat);
    return { category: cat.length > 16 ? cat.slice(0, 15) + "…" : cat, score: Math.round((cv.filter(v => v.status === "ok").length / cv.length) * 100) };
  });
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2"><TrendingUp className="w-3.5 h-3.5 text-primary" />{vt.byCategory}</h4>
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

function ReportCard({ report, isSelected, onClick, onDelete, dateLocale = fr }: {
  report: LabReport;
  isSelected: boolean;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
  dateLocale?: typeof fr;
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
          {format(date, "d MMM yyyy · HH:mm", { locale: dateLocale })}
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

function GenerateChoiceModal({ report, onConfirm, onClose, vt }: {
  report: LabReport;
  onConfirm: (graphs: boolean, fullReport: boolean) => void;
  onClose: () => void;
  vt: VTLang;
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
            <p className="text-xs font-semibold text-foreground">{report.values.length} {vt.successExtracted}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full">{ok} {vt.normales}</span>
            {warn   > 0 && <span className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full">{warn} {vt.surveillees}</span>}
            {danger > 0 && <span className="text-[10px] text-red-600 bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded-full">{danger} {vt.critiques}</span>}
          </div>
          {report.summary && <p className="text-[10px] text-muted-foreground mt-2 italic">{report.summary}</p>}
        </div>

        {/* Options */}
        <div className="px-6 py-4 space-y-3">
          <p className="text-xs font-semibold text-foreground mb-2">{vt.chooseWhat}</p>

          <label className={cn(
            "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all",
            graphs ? "bg-primary/5 border-primary/30" : "bg-muted/30 border-border hover:bg-muted/50"
          )}>
            <input type="checkbox" checked={graphs} onChange={e => setGraphs(e.target.checked)} className="w-4 h-4 accent-primary" />
            <div>
              <p className="text-xs font-semibold text-foreground">{vt.graphs}</p>
              <p className="text-[10px] text-muted-foreground">{vt.graphsDesc}</p>
            </div>
          </label>

          <label className={cn(
            "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all",
            fullReport ? "bg-primary/5 border-primary/30" : "bg-muted/30 border-border hover:bg-muted/50"
          )}>
            <input type="checkbox" checked={fullReport} onChange={e => setFullReport(e.target.checked)} className="w-4 h-4 accent-primary" />
            <div>
              <p className="text-xs font-semibold text-foreground">{vt.fullReport}</p>
              <p className="text-[10px] text-muted-foreground">{vt.fullReportDesc}</p>
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
            {(!graphs && !fullReport) ? vt.saveOnly : vt.generate}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-xl transition-colors">
            {vt.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Value Modal ──────────────────────────────────────────────────────────

function EditValueModal({ value, vt, onSave, onClose }: {
  value: ExtractedValue;
  vt: VTLang;
  onSave: (updated: ExtractedValue) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({ ...value });
  const set = (k: keyof ExtractedValue, v: any) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">{vt.editValue}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center"><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">{vt.editLabel}</label>
              <input value={form.label} onChange={e => set("label", e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">{vt.editVal}</label>
              <input value={form.value} onChange={e => set("value", e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">{vt.editUnit}</label>
              <input value={form.unit} onChange={e => set("unit", e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">{vt.editRefMin}</label>
              <input type="number" value={form.refMin ?? ""} onChange={e => set("refMin", e.target.value === "" ? null : Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">{vt.editRefMax}</label>
              <input type="number" value={form.refMax ?? ""} onChange={e => set("refMax", e.target.value === "" ? null : Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">{vt.editStatus}</label>
              <select value={form.status} onChange={e => set("status", e.target.value as ExtractedValue["status"])}
                className="w-full px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40">
                <option value="ok">{vt.statusOk}</option>
                <option value="warn">{vt.statusWarn}</option>
                <option value="danger">{vt.statusDanger}</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">{vt.editCategory}</label>
              <input value={form.category} onChange={e => set("category", e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => onSave(form)}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary/90 transition-colors">
              <Check className="w-3.5 h-3.5" /> {vt.saveEdit}
            </button>
            <button onClick={onClose} className="px-4 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-xl transition-colors">
              {vt.cancelEdit}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Upload Zone ──────────────────────────────────────────────────────────────

function UploadZone({ onFile, compact = false, vt }: { onFile: (f: File) => void; compact?: boolean; vt: VTLang }) {
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
        {compact ? vt.addReport : vt.dropOrClick}
      </p>
      {!compact && <p className="text-xs text-muted-foreground">{vt.formats}</p>}
      <input ref={ref} type="file" accept="image/*,.pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { onFile(f); e.target.value = ""; } }} />
    </div>
  );
}

// ─── Main ValuesTab ───────────────────────────────────────────────────────────

export function ValuesTab({ patientId, patientName, lang }: ValuesTabProps) {
  const vt: VTLang = VT[lang ?? "fr"];
  const dateFnsLocale = lang === "de" ? deLocale : fr;
  const [reports, setReports]         = useState<LabReport[]>(() => loadReports(patientId));
  const [selectedId, setSelectedId]   = useState<string | null>(() => loadReports(patientId)[0]?.id ?? null);
  const [uploading, setUploading]     = useState(false);
  const [uploadStep, setUploadStep]   = useState<"" | "extracting" | "reporting">("");
  const [selectedValue, setSelectedValue]     = useState<ExtractedValue | null>(null);
  const [lightboxSrc, setLightboxSrc]         = useState<string | null>(null);
  const [pendingReport, setPendingReport]     = useState<LabReport | null>(null); // waiting for user choice
  const [regenReportId, setRegenReportId]     = useState<string | null>(null);    // which report is being regenerated
  const [translatingId, setTranslatingId]     = useState<string | null>(null);    // which report labels are being translated
  const [editingValue, setEditingValue]       = useState<{ reportId: string; index: number } | null>(null);
  const [downloadingPdf, setDownloadingPdf]   = useState(false);
  const reportRef                             = useRef<HTMLDivElement>(null);

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

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    const reader = new FileReader();
    reader.onload = async (e) => {
      let dataUrl = e.target?.result as string;
      let b64 = dataUrl.split(",")[1];

      // Convert PDF first page to image
      if (isPdf) {
        try {
          const imageDataUrl = await pdfToImageDataUrl(b64);
          dataUrl = imageDataUrl;
          b64 = imageDataUrl.split(",")[1];
        } catch (err) {
          console.error("PDF conversion failed:", err);
          setUploading(false);
          setUploadStep("");
          return;
        }
      }

      // Compress both sizes in parallel
      const [thumb, preview] = await Promise.all([
        compressToThumb(dataUrl).catch(() => ""),
        compressToPreview(dataUrl).catch(() => ""),
      ]);

      try {
        const extRes = await fetch("/api/v1/lab-extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: b64, lang: lang ?? "fr" }),
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
            lang,
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

  // Translate labels of existing report to current language via GPT
  const translateReportLabels = useCallback(async (report: LabReport) => {
    if (!lang || lang === "fr") return; // only meaningful for DE
    setTranslatingId(report.id);
    try {
      const valuesJson = JSON.stringify(report.values.map(v => ({ label: v.label, category: v.category })));
      const prompt = `Traduis ces noms d'examens biologiques et catégories du français vers l'allemand. Retourne UNIQUEMENT un JSON avec le même tableau, juste les champs "label" et "category" traduits:
${valuesJson}
Retourne un tableau JSON, même ordre, même nombre d'éléments.`;

      const res = await fetch("/api/v1/medical-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          values: report.values,
          patientName: "",
          summary: "",
          reportDate: null,
          lang,
          customPrompt: prompt,
        }),
      });
      const data = await res.json();
      // Parse the translated labels from the report text
      try {
        const match = (data.report ?? "").match(/\[[\s\S]*\]/);
        if (match) {
          const translated: Array<{ label: string; category: string }> = JSON.parse(match[0]);
          const updatedValues = report.values.map((v, i) => ({
            ...v,
            label: translated[i]?.label ?? v.label,
            category: translated[i]?.category ?? v.category,
          }));
          const updated = loadReports(patientId).map(r =>
            r.id === report.id ? { ...r, values: updatedValues } : r
          );
          updateAndSave(updated);
        }
      } catch { /* parse failed, keep original */ }
    } finally {
      setTranslatingId(null);
    }
  }, [patientId, lang, updateAndSave]);

  // Edit a single value
  const saveValueEdit = useCallback((reportId: string, index: number, updated: ExtractedValue) => {
    const all = loadReports(patientId);
    const next = all.map(r => {
      if (r.id !== reportId) return r;
      const newValues = r.values.map((v, i) => i === index ? updated : v);
      return { ...r, values: newValues };
    });
    updateAndSave(next);
    setEditingValue(null);
  }, [patientId, updateAndSave]);

  // Delete a single value
  const deleteValue = useCallback((reportId: string, index: number) => {
    if (!confirm(vt.deleteValueConfirm)) return;
    const all = loadReports(patientId);
    const next = all.map(r => {
      if (r.id !== reportId) return r;
      return { ...r, values: r.values.filter((_, i) => i !== index) };
    });
    updateAndSave(next);
  }, [patientId, vt.deleteValueConfirm, updateAndSave]);

  // Download full report as PDF — pixel-perfect screenshot
  const downloadPdf = useCallback(async (report: LabReport) => {
    if (!reportRef.current) return;
    setDownloadingPdf(true);

    const el = reportRef.current;

    // Save original inline styles
    const origOverflow = el.style.overflow;
    const origHeight   = el.style.height;
    const origMaxH     = el.style.maxHeight;

    try {
      const [{ jsPDF }, html2canvas] = await Promise.all([
        import("jspdf"),
        import("html2canvas").then(m => m.default),
      ]);

      // Temporarily expand the scrollable container so html2canvas sees all content
      el.style.overflow  = "visible";
      el.style.height    = "auto";
      el.style.maxHeight = "none";

      // Wait one frame for the browser to reflow
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        scrollX: 0,
        scrollY: 0,
      });

      // Restore original styles immediately after capture
      el.style.overflow  = origOverflow;
      el.style.height    = origHeight;
      el.style.maxHeight = origMaxH;

      const pdfW      = 210;
      const pdfH      = 297;
      const margin    = 10;
      const contentW  = pdfW - margin * 2;
      const contentH  = pdfH - margin * 2;
      const canvasW   = canvas.width;
      const canvasH   = canvas.height;
      const mmPerPx   = contentW / canvasW;
      const totalMmH  = canvasH * mmPerPx;

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      let yOffset = 0;
      let page = 0;

      while (yOffset < totalMmH) {
        if (page > 0) doc.addPage();
        const slicePxH  = Math.round(contentH / mmPerPx);
        const sliceY    = Math.round(yOffset / mmPerPx);
        const sliceH    = Math.min(slicePxH, canvasH - sliceY);

        const pageCanvas = document.createElement("canvas");
        pageCanvas.width  = canvasW;
        pageCanvas.height = sliceH;
        const ctx = pageCanvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          ctx.drawImage(canvas, 0, sliceY, canvasW, sliceH, 0, 0, canvasW, sliceH);
        }
        doc.addImage(pageCanvas.toDataURL("image/jpeg", 0.95), "JPEG", margin, margin, contentW, sliceH * mmPerPx);
        yOffset += contentH;
        page++;
      }

      const fname = `rapport-${(patientName ?? "patient").replace(/\s+/g, "-").toLowerCase()}-${report.reportDate ?? report.uploadedAt.slice(0, 10)}.pdf`;
      doc.save(fname);
    } catch (err) {
      console.error("PDF error:", err);
      // Ensure styles are restored even on error
      el.style.overflow  = origOverflow;
      el.style.height    = origHeight;
      el.style.maxHeight = origMaxH;
    } finally {
      setDownloadingPdf(false);
    }
  }, [patientName]);

  // Regenerate the medical report of a specific lab report in the current language
  const regenerateReport = useCallback(async (report: LabReport) => {
    setRegenReportId(report.id);
    try {
      const res = await fetch("/api/v1/medical-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          values: report.values,
          patientName,
          summary: report.summary,
          reportDate: report.reportDate,
          lang: lang ?? "fr",
        }),
      });
      const data = await res.json();
      if (data.report) {
        const updated = loadReports(patientId).map(r =>
          r.id === report.id ? { ...r, medicalReport: data.report } : r
        );
        updateAndSave(updated);
      }
    } finally {
      setRegenReportId(null);
    }
  }, [patientId, patientName, lang, updateAndSave]);

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
          <h3 className="text-xs font-semibold text-foreground">{vt.reports}</h3>
          <span className="text-[10px] text-muted-foreground">{reports.length} {vt.report}{reports.length !== 1 && lang !== "de" ? "s" : ""}</span>
        </div>

        {/* Upload zone (compact if has reports) */}
        {uploading || uploadStep === "reporting" ? (
          <div className="bg-card border border-border rounded-2xl p-4 text-center space-y-2">
            <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto" />
            <p className="text-[10px] text-muted-foreground font-medium">
              {uploadStep === "extracting" ? vt.reading : vt.generating}
            </p>
            <p className="text-[9px] text-muted-foreground">
              {uploadStep === "extracting" ? vt.extracting : vt.analyzing}
            </p>
          </div>
        ) : (
          <UploadZone onFile={handleFile} compact={reports.length > 0} vt={vt} />
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
              dateLocale={dateFnsLocale}
            />
          ))}
        </div>
      </div>

      {/* ── RIGHT: Selected report detail ── */}
      <div ref={reportRef} className="flex-1 min-w-0 overflow-y-auto custom-scroll space-y-4">
        {!selectedReport ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center py-16">
              <Microscope className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">{vt.noReport}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">{vt.uploadHint}</p>
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
                      <span className="text-white text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">{vt.view}</span>
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
                        {vt.reportFrom} {format(new Date(selectedReport.reportDate), "d MMM yyyy", { locale: dateFnsLocale })}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-2">
                    {vt.uploadedOn} {format(new Date(selectedReport.uploadedAt), "d MMM yyyy à HH:mm", { locale: dateFnsLocale })}
                  </p>
                  {/* Action buttons row */}
                  <div className="flex flex-wrap gap-2 mb-2">
                    {/* Translate labels — FR↔DE */}
                    {selectedReport.values.length > 0 && (
                      <button
                        onClick={() => translateReportLabels(selectedReport)}
                        disabled={translatingId === selectedReport.id}
                        className="flex items-center gap-1.5 text-[10px] font-semibold text-primary bg-primary/5 hover:bg-primary/15 border border-primary/20 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50">
                        {translatingId === selectedReport.id
                          ? <><Loader2 className="w-3 h-3 animate-spin" /> {vt.translatingLabels}</>
                          : <><RefreshCw className="w-3 h-3" /> {vt.translateLabels} ({lang === "de" ? "FR" : "DE"})</>
                        }
                      </button>
                    )}
                    {/* Download PDF */}
                    <button
                      onClick={() => downloadPdf(selectedReport)}
                      disabled={downloadingPdf}
                      className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50">
                      {downloadingPdf
                        ? <><Loader2 className="w-3 h-3 animate-spin" /> {vt.downloading}</>
                        : <><Download className="w-3 h-3" /> {vt.downloadPdf}</>
                      }
                    </button>
                  </div>

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
                          <span className="text-[10px] text-emerald-600 font-medium">{ok} {vt.normales}</span>
                          {warn   > 0 && <span className="text-[10px] text-amber-600 font-medium">{warn} {vt.surveillees}</span>}
                          {danger > 0 && <span className="text-[10px] text-red-600 font-medium">{danger} {vt.critiques}</span>}
                          <span className="text-[10px] text-muted-foreground ml-auto">{vt.globalScore} <strong>{score}%</strong></span>
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
                    {catVals.map((v, i) => {
                      const globalIdx = selectedReport.values.indexOf(v);
                      return (
                        <ValueCard
                          key={i}
                          v={v}
                          onClick={() => setSelectedValue(v)}
                          onEdit={() => setEditingValue({ reportId: selectedReport.id, index: globalIdx })}
                          onDelete={() => deleteValue(selectedReport.id, globalIdx)}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Charts — only if user chose them (or hasGraphs is undefined = old report) */}
            {selectedReport.values.length > 0 && selectedReport.hasGraphs !== false && (
              <div className="bg-muted/20 rounded-2xl border border-border/60 p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">{vt.analyzeGraphic}</h3>
                  <span className="text-[10px] text-muted-foreground">{selectedReport.values.length} {vt.valuesCount}</span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <StatusPieChart values={selectedReport.values} vt={vt} />
                  {categories.length >= 3 && <CategoryRadarChart values={selectedReport.values} vt={vt} />}
                </div>
                <ValuesBarChart values={selectedReport.values} vt={vt} />
                <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                  <Info className="w-3 h-3 flex-shrink-0" />
                  {vt.clickDetail}
                  {selectedReport.labName && ` ${vt.source} ${selectedReport.labName}.`}
                </p>
              </div>
            )}

            {/* Medical report — only if user chose it */}
            {selectedReport.hasReport !== false && <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border/60 flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">{vt.medicalReport}</h3>
                {!selectedReport.medicalReport ? (
                  <span className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded-full flex items-center gap-1 ml-auto">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" /> {vt.generating2}
                  </span>
                ) : (
                  <button
                    onClick={() => regenerateReport(selectedReport)}
                    disabled={regenReportId === selectedReport.id}
                    className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/5 hover:bg-primary/15 border border-primary/20 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                    title={vt.regenBtn}>
                    {regenReportId === selectedReport.id
                      ? <><Loader2 className="w-3 h-3 animate-spin" /> {vt.regenLoading}</>
                      : <><RefreshCw className="w-3 h-3" /> {lang === "de" ? "Auf Deutsch" : "Changer de langue"}</>
                    }
                  </button>
                )}
              </div>
              <div className="p-4">
                {selectedReport.medicalReport ? (
                  <MdText text={selectedReport.medicalReport} />
                ) : (
                  <div className="flex items-center gap-3 py-6 justify-center text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <p className="text-xs">{vt.generatingLong}</p>
                  </div>
                )}
                <p className="text-[9px] text-muted-foreground mt-4 flex items-center gap-1">
                  <Info className="w-3 h-3 flex-shrink-0" />
                  {vt.disclaimer}
                </p>
              </div>
            </div>}
          </>
        )}
      </div>

      {/* Value detail panel */}
      {selectedValue && (
        <DetailPanel v={selectedValue} patientName={patientName} onClose={() => setSelectedValue(null)} lang={lang} />
      )}

      {/* Edit value modal */}
      {editingValue && (() => {
        const rep = reports.find(r => r.id === editingValue.reportId);
        const val = rep?.values[editingValue.index];
        if (!val) return null;
        return (
          <EditValueModal
            value={val}
            vt={vt}
            onSave={updated => saveValueEdit(editingValue.reportId, editingValue.index, updated)}
            onClose={() => setEditingValue(null)}
          />
        );
      })()}

      {/* Generation choice modal */}
      {pendingReport && (
        <GenerateChoiceModal
          report={pendingReport}
          onConfirm={confirmGenerate}
          onClose={() => setPendingReport(null)}
          vt={vt}
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
