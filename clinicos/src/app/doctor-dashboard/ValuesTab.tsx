"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell,
  PieChart, Pie, Legend,
} from "recharts";
import {
  Upload, Loader2, AlertTriangle, CheckCircle2, XCircle,
  RefreshCw, Microscope, TrendingUp, Info, X, ChevronRight,
  FileText, Stethoscope, ShieldAlert, ListChecks, HeartPulse,
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

interface ExtractionResult {
  values: ExtractedValue[];
  summary: string | null;
  reportDate: string | null;
  labName: string | null;
}

interface ValuesTabProps {
  patientId: string;
  patientName?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS = {
  ok:     { label: "Normal",    color: "#10b981", bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-800" },
  warn:   { label: "Attention", color: "#f59e0b", bg: "bg-amber-50 dark:bg-amber-950/30",    text: "text-amber-700 dark:text-amber-300",     border: "border-amber-200 dark:border-amber-800" },
  danger: { label: "Critique",  color: "#ef4444", bg: "bg-red-50 dark:bg-red-950/30",        text: "text-red-700 dark:text-red-300",         border: "border-red-200 dark:border-red-800" },
};

const STORAGE_KEY = (patientId: string) => `clinicos-lab-values-${patientId}`;

function loadSaved(patientId: string): ExtractionResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY(patientId));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function save(patientId: string, result: ExtractionResult) {
  try {
    localStorage.setItem(STORAGE_KEY(patientId), JSON.stringify(result));
  } catch {}
}

// ─── Markdown-lite renderer ───────────────────────────────────────────────────

function MdText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-2 text-xs text-foreground leading-relaxed">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;
        // Heading **text**
        if (line.startsWith("**") && line.endsWith("**") && line.length > 4) {
          return <p key={i} className="font-bold text-foreground mt-3 first:mt-0">{line.slice(2, -2)}</p>;
        }
        // Bold inline
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        const rendered = parts.map((part, j) =>
          part.startsWith("**") && part.endsWith("**")
            ? <strong key={j}>{part.slice(2, -2)}</strong>
            : part
        );
        if (/^\d+\./.test(line)) {
          return <p key={i} className="pl-2 border-l-2 border-primary/30">{rendered}</p>;
        }
        if (line.startsWith("- ") || line.startsWith("• ")) {
          return <p key={i} className="pl-3 flex gap-2"><span className="text-primary flex-shrink-0">•</span><span>{rendered}</span></p>;
        }
        return <p key={i}>{rendered}</p>;
      })}
    </div>
  );
}

// ─── Value Card ────────────────────────────────────────────────────────────────

function ValueCard({ v, onClick }: { v: ExtractedValue; onClick: () => void }) {
  const s = STATUS[v.status];
  const numVal = parseFloat(v.value);
  const hasRange = v.refMin !== null && v.refMax !== null;
  const pct = hasRange && !isNaN(numVal)
    ? Math.min(100, Math.max(0, ((numVal - v.refMin!) / ((v.refMax! - v.refMin!) || 1)) * 100))
    : null;

  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-xl border p-3 flex flex-col gap-2 text-left w-full transition-all hover:shadow-md hover:scale-[1.02] cursor-pointer group relative",
        s.bg, s.border
      )}>
      <div className="flex items-start justify-between gap-1">
        <span className="text-[11px] text-muted-foreground font-medium leading-tight">{v.label}</span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {v.status === "ok"     && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
          {v.status === "warn"   && <AlertTriangle className="w-3 h-3 text-amber-500" />}
          {v.status === "danger" && <AlertTriangle className="w-3 h-3 text-red-500" />}
          <ChevronRight className="w-3 h-3 text-muted-foreground/0 group-hover:text-muted-foreground transition-all" />
        </div>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={cn("text-xl font-bold", s.text)}>{v.value}</span>
        <span className="text-[10px] text-muted-foreground">{v.unit}</span>
      </div>
      {hasRange && (
        <>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct ?? 50}%`, background: STATUS[v.status].color }} />
          </div>
          <p className="text-[9px] text-muted-foreground">Réf: {v.refMin} – {v.refMax} {v.unit}</p>
        </>
      )}
    </button>
  );
}

// ─── Detail Panel ──────────────────────────────────────────────────────────────

function DetailPanel({ v, explanation, loading, onClose }: {
  v: ExtractedValue;
  explanation: string | null;
  loading: boolean;
  onClose: () => void;
}) {
  const s = STATUS[v.status];
  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel — slides in from right */}
      <div className="relative ml-auto w-full max-w-lg h-full bg-card shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className={cn("px-6 py-4 border-b border-border flex items-start justify-between gap-4", s.bg)}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {v.status === "danger" && <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />}
              {v.status === "warn"   && <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />}
              {v.status === "ok"     && <CheckCircle2  className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
              <h2 className="text-base font-bold text-foreground">{v.label}</h2>
              <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full", s.bg, s.border, s.text, "border")}>
                {s.label}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className={cn("text-2xl font-bold", s.text)}>{v.value}</span>
              <span className="text-sm text-muted-foreground">{v.unit}</span>
              {v.refMin !== null && v.refMax !== null && (
                <span className="text-xs text-muted-foreground ml-2">
                  (norme: {v.refMin} – {v.refMax} {v.unit})
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-muted flex items-center justify-center flex-shrink-0 transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Analyse médicale en cours...</p>
            </div>
          ) : explanation ? (
            <MdText text={explanation} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── Charts ────────────────────────────────────────────────────────────────────

function StatusPieChart({ values }: { values: ExtractedValue[] }) {
  const ok     = values.filter(v => v.status === "ok").length;
  const warn   = values.filter(v => v.status === "warn").length;
  const danger = values.filter(v => v.status === "danger").length;
  const data = [
    { name: "Normal",    value: ok,     fill: "#10b981" },
    { name: "Attention", value: warn,   fill: "#f59e0b" },
    { name: "Critique",  value: danger, fill: "#ef4444" },
  ].filter(d => d.value > 0);

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
        <div className="w-5 h-5 rounded-lg bg-primary/10 flex items-center justify-center">
          <TrendingUp className="w-3 h-3 text-primary" />
        </div>
        Répartition des valeurs
      </h4>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
            {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
          </Pie>
          <Legend formatter={(v) => <span className="text-xs text-muted-foreground">{v}</span>} />
          <Tooltip formatter={(val: any, name: any) => [`${val} valeur${val !== 1 ? "s" : ""}`, name]} />
        </PieChart>
      </ResponsiveContainer>
      <div className="grid grid-cols-3 gap-2 mt-2">
        {[
          { label: "Normal",    count: ok,     color: "text-emerald-600 dark:text-emerald-400" },
          { label: "Attention", count: warn,   color: "text-amber-600 dark:text-amber-400" },
          { label: "Critique",  count: danger, color: "text-red-600 dark:text-red-400" },
        ].map(({ label, count, color }) => (
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
  const withRange = values
    .filter(v => v.refMin !== null && v.refMax !== null && !isNaN(parseFloat(v.value)))
    .slice(0, 12);

  if (withRange.length === 0) return null;

  const data = withRange.map(v => {
    const num = parseFloat(v.value);
    const mid = ((v.refMin! + v.refMax!) / 2);
    const range = v.refMax! - v.refMin!;
    const normalized = range > 0 ? ((num - mid) / (range / 2)) * 50 + 50 : 50;
    return {
      name: v.label.length > 14 ? v.label.slice(0, 13) + "…" : v.label,
      fullName: v.label,
      value: Math.round(normalized),
      actual: num,
      unit: v.unit,
      refMin: v.refMin,
      refMax: v.refMax,
      status: v.status,
    };
  });

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-card border border-border rounded-xl p-3 shadow-lg text-xs space-y-1">
        <p className="font-semibold text-foreground">{d.fullName}</p>
        <p className="text-muted-foreground">Valeur: <span className="font-bold text-foreground">{d.actual} {d.unit}</span></p>
        <p className="text-muted-foreground">Réf: {d.refMin} – {d.refMax} {d.unit}</p>
        <span className={cn("inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold", STATUS[d.status as keyof typeof STATUS].bg, STATUS[d.status as keyof typeof STATUS].text)}>
          {STATUS[d.status as keyof typeof STATUS].label}
        </span>
      </div>
    );
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <h4 className="text-xs font-semibold text-foreground mb-1 flex items-center gap-2">
        <div className="w-5 h-5 rounded-lg bg-primary/10 flex items-center justify-center">
          <TrendingUp className="w-3 h-3 text-primary" />
        </div>
        Positionnement dans les normes
      </h4>
      <p className="text-[10px] text-muted-foreground mb-3">50% = centre de la plage normale</p>
      <ResponsiveContainer width="100%" height={Math.max(200, withRange.length * 28)}>
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 40, top: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
          <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} />
          <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine x={50} stroke="#6b7280" strokeDasharray="4 4" label={{ value: "Norme", position: "top", fontSize: 9, fill: "#6b7280" }} />
          <ReferenceLine x={20} stroke="#f59e0b" strokeDasharray="2 2" strokeOpacity={0.5} />
          <ReferenceLine x={80} stroke="#f59e0b" strokeDasharray="2 2" strokeOpacity={0.5} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={18}>
            {data.map((d, i) => (
              <Cell key={i} fill={STATUS[d.status as keyof typeof STATUS].color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CategoryRadarChart({ values }: { values: ExtractedValue[] }) {
  const categories = Array.from(new Set(values.map(v => v.category))).slice(0, 8);
  if (categories.length < 3) return null;

  const data = categories.map(cat => {
    const catValues = values.filter(v => v.category === cat);
    const okCount = catValues.filter(v => v.status === "ok").length;
    const score = catValues.length > 0 ? Math.round((okCount / catValues.length) * 100) : 50;
    return { category: cat.length > 16 ? cat.slice(0, 15) + "…" : cat, score };
  });

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
        <div className="w-5 h-5 rounded-lg bg-primary/10 flex items-center justify-center">
          <TrendingUp className="w-3 h-3 text-primary" />
        </div>
        Score par catégorie
      </h4>
      <ResponsiveContainer width="100%" height={260}>
        <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis dataKey="category" tick={{ fontSize: 10, fill: "#6b7280" }} />
          <Radar name="Score" dataKey="score" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.25} strokeWidth={2} />
          <Tooltip formatter={(val: any) => [`${val}% normal`, "Score"]} />
        </RadarChart>
      </ResponsiveContainer>
      <p className="text-[9px] text-muted-foreground text-center mt-1">100% = toutes valeurs normales dans la catégorie</p>
    </div>
  );
}

// ─── Main ValuesTab ───────────────────────────────────────────────────────────

export function ValuesTab({ patientId, patientName }: ValuesTabProps) {
  const [result, setResult]   = useState<ExtractionResult | null>(() => loadSaved(patientId));
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Detail panel
  const [selectedValue, setSelectedValue]     = useState<ExtractedValue | null>(null);
  const [valueExplanation, setValueExplanation] = useState<string | null>(null);
  const [explainLoading, setExplainLoading]   = useState(false);
  const explanationCache = useRef<Record<string, string>>({});

  // General report
  const [generalReport, setGeneralReport]         = useState<string | null>(null);
  const [generalReportLoading, setGeneralReportLoading] = useState(false);

  // Reset when patient changes
  useEffect(() => {
    setResult(loadSaved(patientId));
    setPreview(null);
    setError(null);
    setSelectedValue(null);
    setValueExplanation(null);
    setGeneralReport(null);
    explanationCache.current = {};
  }, [patientId]);

  const openValueDetail = useCallback(async (v: ExtractedValue) => {
    setSelectedValue(v);
    const cacheKey = `${v.label}-${v.value}`;
    if (explanationCache.current[cacheKey]) {
      setValueExplanation(explanationCache.current[cacheKey]);
      return;
    }
    setValueExplanation(null);
    setExplainLoading(true);
    try {
      const statusLabel = v.status === "danger" ? "CRITIQUE — très anormal" : v.status === "warn" ? "ATTENTION — légèrement anormal" : "NORMAL";
      const prompt = `Tu es un médecin expert en biologie médicale et clinique. Analyse cette valeur:

**Examen:** ${v.label}
**Résultat:** ${v.value} ${v.unit}
**Plage normale:** ${v.refMin ?? "?"} – ${v.refMax ?? "?"} ${v.unit}
**Statut:** ${statusLabel}
**Catégorie:** ${v.category}

Fournis une analyse médicale complète structurée ainsi (utilise des titres en **gras**):

**1. Qu'est-ce que cet examen mesure ?**
Explication simple de ce que mesure cet indicateur et son rôle physiologique.

**2. Interprétation de ce résultat**
Pourquoi cette valeur est-elle ${v.status === "ok" ? "normale et rassurante" : "préoccupante"} ? Ce que ça signifie cliniquement.

**3. Causes possibles** ${v.status !== "ok" ? "(les plus fréquentes)" : ""}
Liste les causes les plus courantes de ce résultat.

**4. Risques si non traité** ${v.status !== "ok" ? "(à court et long terme)" : ""}
Quelles sont les conséquences potentielles.

**5. Recommandations médicales**
Ce que le médecin devrait envisager comme examens complémentaires ou traitements.

**6. Conseils pour le patient**
Ce que le patient doit faire concrètement (alimentation, activité, médicaments, consultation urgente ?).

Réponse claire, professionnelle, en français. Sois précis et utile.`;

      // Use lab-extract endpoint for direct GPT-4o without function-calling
      const res = await fetch("/api/v1/medical-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          values: [v],
          patientName,
          summary: `Analyse détaillée de: ${v.label} = ${v.value} ${v.unit}`,
          reportDate: null,
          mode: "single_value",
          customPrompt: prompt,
        }),
      });
      const data = await res.json();
      const explanation = data.report ?? "Analyse non disponible.";
      explanationCache.current[cacheKey] = explanation;
      setValueExplanation(explanation);
    } catch {
      setValueExplanation("Erreur lors de l'analyse. Veuillez réessayer.");
    } finally {
      setExplainLoading(false);
    }
  }, []);

  const generateGeneralReport = useCallback(async () => {
    if (!result) return;
    setGeneralReportLoading(true);
    setGeneralReport(null);
    try {
      const criticalVals = result.values.filter(v => v.status === "danger");
      const warnVals     = result.values.filter(v => v.status === "warn");
      const okVals       = result.values.filter(v => v.status === "ok");
      const fmt = (vals: ExtractedValue[]) =>
        vals.map(v => `- ${v.label}: ${v.value} ${v.unit} [norme: ${v.refMin ?? "?"}-${v.refMax ?? "?"} ${v.unit}]`).join("\n");

      const prompt = `Tu es un médecin clinicien senior. Génère un rapport médical complet et professionnel basé sur ces résultats d'analyses biologiques pour ${patientName ?? "ce patient"}:

**VALEURS CRITIQUES (${criticalVals.length}):**
${fmt(criticalVals) || "Aucune"}

**VALEURS À SURVEILLER (${warnVals.length}):**
${fmt(warnVals) || "Aucune"}

**VALEURS NORMALES (${okVals.length}):**
${fmt(okVals) || "Aucune"}

${result.summary ? `**Interprétation du laboratoire:** ${result.summary}` : ""}
**Score global:** ${Math.round((okVals.length / result.values.length) * 100)}% des valeurs normales

Génère un rapport structuré et complet:

**RÉSUMÉ EXÉCUTIF**
État de santé général du patient en 2-3 phrases. Niveau d'urgence.

**ANALYSE DES FINDINGS CRITIQUES**
Pour chaque valeur critique: signification clinique, causes probables, risques immédiats.

**HYPOTHÈSES DIAGNOSTIQUES**
Les diagnostics les plus probables au vu de ce tableau biologique.

**PLAN THÉRAPEUTIQUE RECOMMANDÉ**
Traitements et interventions à envisager par ordre de priorité.

**EXAMENS COMPLÉMENTAIRES**
Quels examens supplémentaires sont nécessaires et dans quel délai.

**CONSEILS AU PATIENT**
Instructions claires pour le patient: régime, activité physique, médicaments, signes d'alarme à surveiller.

**SUIVI RECOMMANDÉ**
Quand revoir le patient, quels contrôles biologiques refaire et à quelle fréquence.

**NIVEAU D'URGENCE**
Urgence immédiate / Semi-urgent (< 48h) / Consultation programmée. Justification.

Réponse professionnelle, structurée, en français. Sois précis et cliniquement utile.`;

      // Use dedicated endpoint — direct GPT-4o, no function-calling, no patient ID lookup
      const res = await fetch("/api/v1/medical-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          values: result.values,
          patientName,
          summary: result.summary,
          reportDate: result.reportDate,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Erreur serveur");
      setGeneralReport(data.report ?? "Rapport non disponible.");
    } catch (err: any) {
      setGeneralReport(`Erreur: ${err.message}`);
    } finally {
      setGeneralReportLoading(false);
    }
  }, [result, patientName]);

  const extractValues = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      setPreview(dataUrl);
      const b64 = dataUrl.split(",")[1];
      try {
        const res = await fetch("/api/v1/lab-extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: b64 }),
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error ?? "Erreur d'extraction");
        setResult(data);
        save(patientId, data);
      } catch (err: any) {
        setError(err.message ?? "Erreur lors de l'analyse");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  }, [patientId]);

  const handleFile = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      setError("Format non supporté. Utilisez une image (JPG, PNG) ou PDF.");
      return;
    }
    extractValues(file);
  };

  const categories = result ? Array.from(new Set(result.values.map(v => v.category))) : [];
  const okCount = result?.values.filter(v => v.status === "ok").length ?? 0;
  const warnCount = result?.values.filter(v => v.status === "warn").length ?? 0;
  const dangerCount = result?.values.filter(v => v.status === "danger").length ?? 0;
  const globalScore = result?.values.length
    ? Math.round((okCount / result.values.length) * 100)
    : 0;

  return (
    <div className="space-y-4">

      {/* ── Upload zone ── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Microscope className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Analyse IA — Rapport biologique</h3>
              <p className="text-[10px] text-muted-foreground">{patientName ?? "Patient"}</p>
            </div>
          </div>
          {result && (
            <div className="flex items-center gap-2">
              {result.reportDate && (
                <span className="text-[10px] text-muted-foreground">
                  Rapport du {format(new Date(result.reportDate), "d MMM yyyy", { locale: fr })}
                </span>
              )}
              <button
                onClick={() => { setResult(null); setPreview(null); setError(null); localStorage.removeItem(STORAGE_KEY(patientId)); }}
                className="text-[10px] text-red-500 hover:text-red-700 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                <X className="w-3 h-3" /> Effacer
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="text-[10px] text-primary flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-primary/10 transition-colors border border-primary/20">
                <RefreshCw className="w-3 h-3" /> Nouveau rapport
              </button>
            </div>
          )}
        </div>

        <div className="p-4">
          {!result && !loading ? (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
              onClick={() => fileRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all",
                dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-primary/5"
              )}>
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Upload className="w-7 h-7 text-primary" />
              </div>
              <p className="text-sm font-semibold text-foreground mb-1">Déposez ou cliquez pour analyser un rapport</p>
              <p className="text-xs text-muted-foreground">Image JPG, PNG · Rapport de laboratoire, bilan biologique</p>
              <p className="text-[10px] text-primary/70 mt-2 font-medium">
                L&apos;IA extrait automatiquement toutes les valeurs et leur statut
              </p>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center gap-4 py-10">
              {preview && (
                <img src={preview} alt="rapport" className="h-24 rounded-xl object-contain opacity-60 border border-border" />
              )}
              <div className="flex items-center gap-3">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Analyse en cours...</p>
                  <p className="text-xs text-muted-foreground">GPT-4o lit et extrait toutes les valeurs biologiques</p>
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-start gap-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-4">
              <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-700 dark:text-red-300">Erreur d&apos;extraction</p>
                <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5">{error}</p>
                <button onClick={() => { setError(null); fileRef.current?.click(); }}
                  className="mt-2 text-xs text-red-600 dark:text-red-400 underline">
                  Réessayer
                </button>
              </div>
            </div>
          ) : result ? (
            <>
              {/* Summary banner */}
              <div className={cn(
                "rounded-xl border p-3 mb-4 flex items-start gap-3",
                dangerCount > 0 ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
                  : warnCount > 0 ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
                  : "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
              )}>
                {dangerCount > 0
                  ? <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  : warnCount > 0
                  ? <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  : <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                }
                <div className="flex-1">
                  {result.summary && <p className="text-xs font-semibold text-foreground">{result.summary}</p>}
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">{okCount} normales</span>
                    {warnCount > 0 && <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">{warnCount} à surveiller</span>}
                    {dangerCount > 0 && <span className="text-[10px] text-red-600 dark:text-red-400 font-medium">{dangerCount} critiques</span>}
                    <span className="text-[10px] text-muted-foreground ml-auto">Score global: <span className="font-bold">{globalScore}%</span></span>
                  </div>
                </div>
              </div>
            </>
          ) : null}
          <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden"
            onChange={e => handleFile(e.target.files?.[0] ?? null)} />
        </div>
      </div>

      {/* ── Values by category ── */}
      {result && result.values.length > 0 && (
        <>
          {categories.map(cat => {
            const catValues = result.values.filter(v => v.category === cat);
            const catDanger = catValues.filter(v => v.status === "danger").length;
            const catWarn   = catValues.filter(v => v.status === "warn").length;
            return (
              <div key={cat} className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className={cn(
                  "px-4 py-2.5 border-b border-border/60 flex items-center justify-between",
                  catDanger > 0 ? "bg-red-50/60 dark:bg-red-950/10" : catWarn > 0 ? "bg-amber-50/60 dark:bg-amber-950/10" : ""
                )}>
                  <h4 className="text-xs font-semibold text-foreground">{cat}</h4>
                  <div className="flex items-center gap-2">
                    {catDanger > 0 && (
                      <span className="text-[9px] font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-950/30 px-1.5 py-0.5 rounded-full">
                        {catDanger} critique{catDanger !== 1 ? "s" : ""}
                      </span>
                    )}
                    {catWarn > 0 && (
                      <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/30 px-1.5 py-0.5 rounded-full">
                        {catWarn} attention
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                  {catValues.map((v, i) => (
                    <ValueCard key={i} v={v} onClick={() => openValueDetail(v)} />
                  ))}
                </div>
              </div>
            );
          })}

          {/* ── Charts section ── */}
          <div className="bg-muted/20 rounded-2xl border border-border/60 p-4">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Analyse graphique</h3>
              <span className="text-[10px] text-muted-foreground">{result.values.length} valeurs analysées</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <StatusPieChart values={result.values} />
              {categories.length >= 3 && <CategoryRadarChart values={result.values} />}
            </div>
            <div className="mt-4">
              <ValuesBarChart values={result.values} />
            </div>
            <p className="text-[9px] text-muted-foreground mt-3 flex items-center gap-1">
              <Info className="w-3 h-3 flex-shrink-0" />
              Valeurs extraites par IA depuis le rapport fourni.
              {result.labName && ` Source: ${result.labName}.`}
              {" "}Cliquez sur une valeur pour l&apos;analyser en détail.
            </p>
          </div>

          {/* ── General report ── */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Rapport médical complet</h3>
                  <p className="text-[10px] text-muted-foreground">Analyse IA — Recommandations et plan de suivi</p>
                </div>
              </div>
              <button
                onClick={generateGeneralReport}
                disabled={generalReportLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-60 transition-colors">
                {generalReportLoading
                  ? <><Loader2 className="w-3 h-3 animate-spin" /> Génération...</>
                  : generalReport
                  ? <><RefreshCw className="w-3 h-3" /> Regénérer</>
                  : <><Stethoscope className="w-3 h-3" /> Générer le rapport</>
                }
              </button>
            </div>

            {!generalReport && !generalReportLoading ? (
              <div className="p-8 text-center">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Stethoscope className="w-7 h-7 text-primary/60" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">Rapport médical personnalisé</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Cliquez sur &quot;Générer le rapport&quot; pour obtenir une analyse complète avec diagnostic, recommandations thérapeutiques et plan de suivi.
                </p>
                <div className="flex items-center justify-center gap-4 mt-4 text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Findings critiques</div>
                  <div className="flex items-center gap-1"><ListChecks className="w-3 h-3" /> Plan thérapeutique</div>
                  <div className="flex items-center gap-1"><HeartPulse className="w-3 h-3" /> Suivi recommandé</div>
                </div>
              </div>
            ) : generalReportLoading ? (
              <div className="flex flex-col items-center gap-3 py-10">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Analyse complète en cours...</p>
                <p className="text-[10px] text-muted-foreground/60">GPT-4o génère le rapport médical complet</p>
              </div>
            ) : generalReport ? (
              <div className="p-6">
                <MdText text={generalReport} />
                <div className="mt-6 pt-4 border-t border-border/60">
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                    <Info className="w-3 h-3 flex-shrink-0" />
                    Ce rapport est généré par IA à titre indicatif. Il ne remplace pas le jugement clinique du médecin.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </>
      )}

      {/* ── Detail Panel ── */}
      {selectedValue && (
        <DetailPanel
          v={selectedValue}
          explanation={valueExplanation}
          loading={explainLoading}
          onClose={() => { setSelectedValue(null); setValueExplanation(null); }}
        />
      )}
    </div>
  );
}
