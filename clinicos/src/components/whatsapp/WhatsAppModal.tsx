"use client";

import { useState, useEffect } from "react";
import { X, MessageSquare, ChevronDown, Send, Clock, Check, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Patient {
  id: string;
  fullName: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
}

interface Appointment {
  date: string;
  time: string;
  type: string;
}

interface WhatsAppMessage {
  id: string;
  patientId: string;
  patientName: string;
  phone: string;
  message: string;
  templateId: string;
  sentAt: string;
}

interface WhatsAppModalProps {
  patient: Patient;
  nextApt?: Appointment | null;
  onClose: () => void;
  lang?: "fr" | "de";
}

// ─── Phone formatter ──────────────────────────────────────────────────────────

export function formatMoroccanPhone(raw: string): string {
  const clean = raw.replace(/[\s\-\.\(\)]/g, "");
  if (clean.startsWith("+212")) return clean.slice(1);
  if (clean.startsWith("212") && clean.length >= 12) return clean;
  if (clean.startsWith("0") && clean.length === 10) return "212" + clean.slice(1);
  if (clean.length === 9 && /^[5-7]/.test(clean)) return "212" + clean;
  return clean;
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const formatted = formatMoroccanPhone(phone);
  return `https://wa.me/${formatted}?text=${encodeURIComponent(message)}`;
}

// ─── Templates ────────────────────────────────────────────────────────────────

interface Template {
  id: string;
  emoji: string;
  label: string;
  labelDe: string;
  generate: (p: Patient, apt?: Appointment | null, lang?: string) => string;
}

const TEMPLATES: Template[] = [
  {
    id: "rdv_rappel",
    emoji: "📅",
    label: "Rappel de rendez-vous",
    labelDe: "Terminerinnerung",
    generate: (p, apt, lang) => lang === "de"
      ? `Guten Tag ${p.fullName},\n\nWir möchten Sie an Ihren Termin am ${apt?.date ?? "—"} um ${apt?.time ?? "—"} Uhr erinnern (${apt?.type ?? "Konsultation"}).\n\nBitte bestätigen Sie Ihre Anwesenheit oder kontaktieren Sie uns für eine Umplanung.\n\nMit freundlichen Grüßen,\nIhre Arztpraxis`
      : `Bonjour ${p.fullName},\n\nNous vous rappelons votre rendez-vous prévu le ${apt?.date ?? "—"} à ${apt?.time ?? "—"} (${apt?.type ?? "Consultation"}).\n\nMerci de confirmer votre présence ou de nous contacter pour reporter.\n\nCordialement,\nVotre cabinet médical`,
  },
  {
    id: "rdv_confirm",
    emoji: "✅",
    label: "Confirmation de rendez-vous",
    labelDe: "Terminbestätigung",
    generate: (p, apt, lang) => lang === "de"
      ? `Guten Tag ${p.fullName},\n\nIhr Termin am ${apt?.date ?? "—"} um ${apt?.time ?? "—"} Uhr ist bestätigt.\n\nBitte erscheinen Sie 5 Minuten vor Ihrem Termin.\n\nMit freundlichen Grüßen,\nIhre Arztpraxis`
      : `Bonjour ${p.fullName},\n\nVotre rendez-vous du ${apt?.date ?? "—"} à ${apt?.time ?? "—"} est bien confirmé.\n\nMerci d'arriver 5 minutes avant l'heure prévue.\n\nCordialement,\nVotre cabinet médical`,
  },
  {
    id: "resultats",
    emoji: "📋",
    label: "Résultats disponibles",
    labelDe: "Ergebnisse verfügbar",
    generate: (p, _apt, lang) => lang === "de"
      ? `Guten Tag ${p.fullName},\n\nIhre Analyseergebnisse sind verfügbar. Bitte kontaktieren Sie uns oder kommen Sie vorbei, um diese zu besprechen.\n\nMit freundlichen Grüßen,\nIhre Arztpraxis`
      : `Bonjour ${p.fullName},\n\nVos résultats d'analyses sont disponibles. Merci de nous contacter ou de passer au cabinet pour en discuter avec le médecin.\n\nCordialement,\nVotre cabinet médical`,
  },
  {
    id: "annulation",
    emoji: "❌",
    label: "Consultation annulée",
    labelDe: "Konsultation abgesagt",
    generate: (p, apt, lang) => lang === "de"
      ? `Guten Tag ${p.fullName},\n\nIhr Termin am ${apt?.date ?? "—"} um ${apt?.time ?? "—"} Uhr muss leider abgesagt werden.\n\nBitte kontaktieren Sie uns, um einen neuen Termin zu vereinbaren.\n\nMit freundlichen Grüßen,\nIhre Arztpraxis`
      : `Bonjour ${p.fullName},\n\nNous sommes dans l'obligation d'annuler votre rendez-vous du ${apt?.date ?? "—"} à ${apt?.time ?? "—"}.\n\nMerci de nous contacter pour reprogrammer une nouvelle consultation.\n\nCordialement,\nVotre cabinet médical`,
  },
  {
    id: "suivi",
    emoji: "💊",
    label: "Rappel de suivi / traitement",
    labelDe: "Erinnerung Nachsorge",
    generate: (p, _apt, lang) => lang === "de"
      ? `Guten Tag ${p.fullName},\n\nDies ist eine Erinnerung, Ihre Behandlung/Medikamente wie empfohlen fortzusetzen und einen Kontrolltermin zu vereinbaren.\n\nMit freundlichen Grüßen,\nIhre Arztpraxis`
      : `Bonjour ${p.fullName},\n\nCeci est un rappel pour continuer votre traitement selon les recommandations et programmer un rendez-vous de suivi.\n\nCordialement,\nVotre cabinet médical`,
  },
  {
    id: "custom",
    emoji: "✏️",
    label: "Message personnalisé",
    labelDe: "Benutzerdefinierte Nachricht",
    generate: (p, _apt, lang) => lang === "de"
      ? `Guten Tag ${p.fullName},\n\n\n\nMit freundlichen Grüßen,\nIhre Arztpraxis`
      : `Bonjour ${p.fullName},\n\n\n\nCordialement,\nVotre cabinet médical`,
  },
];

// ─── History helpers ──────────────────────────────────────────────────────────

const HISTORY_KEY = "clinicos-whatsapp-history";

function loadHistory(): WhatsAppMessage[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]"); } catch { return []; }
}

function saveToHistory(msg: WhatsAppMessage) {
  const history = loadHistory();
  const next = [msg, ...history].slice(0, 100); // keep last 100
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch {}
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export function WhatsAppModal({ patient, nextApt, onClose, lang = "fr" }: WhatsAppModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0]);
  const [message, setMessage] = useState(() => TEMPLATES[0].generate(patient, nextApt, lang));
  const [phone, setPhone] = useState(patient.phone ?? "");
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<WhatsAppMessage[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const isDE = lang === "de";

  useEffect(() => { setHistory(loadHistory().filter(m => m.patientId === patient.id)); }, [patient.id]);

  const selectTemplate = (t: Template) => {
    setSelectedTemplate(t);
    setMessage(t.generate(patient, nextApt, lang));
    setShowTemplates(false);
  };

  const formatted = formatMoroccanPhone(phone);
  const isPhoneValid = formatted.length >= 10;

  const handleSend = () => {
    if (!isPhoneValid) return;
    const url = buildWhatsAppUrl(phone, message);
    window.open(url, "_blank", "noopener,noreferrer");

    const msg: WhatsAppMessage = {
      id: `wa-${Date.now()}`,
      patientId: patient.id,
      patientName: patient.fullName,
      phone: formatted,
      message,
      templateId: selectedTemplate.id,
      sentAt: new Date().toISOString(),
    };
    saveToHistory(msg);
    setHistory(prev => [msg, ...prev]);
  };

  const charCount = message.length;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-[#25D366]/10 border-b border-[#25D366]/20 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#25D366] flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">WhatsApp</h2>
              <p className="text-[10px] text-muted-foreground">{patient.fullName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowHistory(!showHistory)}
              className={cn("flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg transition-colors",
                showHistory ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
              )}>
              <Clock className="w-3 h-3" /> {isDE ? "Verlauf" : "Historique"}
              {history.length > 0 && <span className="ml-1 text-primary">({history.length})</span>}
            </button>
            <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {showHistory ? (
            /* History panel */
            <div className="p-4 space-y-3">
              {history.length === 0 ? (
                <div className="py-8 text-center">
                  <MessageSquare className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{isDE ? "Noch kein Verlauf" : "Aucun message envoyé"}</p>
                </div>
              ) : (
                history.map(msg => (
                  <div key={msg.id} className="bg-muted/30 rounded-xl p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-[#25D366]">
                        {TEMPLATES.find(t => t.id === msg.templateId)?.[isDE ? "labelDe" : "label"] ?? msg.templateId}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(msg.sentAt).toLocaleDateString(isDE ? "de-DE" : "fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-xs text-foreground/80 line-clamp-3 whitespace-pre-wrap">{msg.message}</p>
                    <div className="flex items-center gap-1">
                      <Check className="w-3 h-3 text-[#25D366]" />
                      <span className="text-[9px] text-muted-foreground">+{msg.phone}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            /* Compose panel */
            <div className="p-5 space-y-4">
              {/* Phone */}
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
                  {isDE ? "Telefonnummer" : "Numéro de téléphone"}
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-muted/50 border border-border rounded-lg text-xs text-muted-foreground flex-shrink-0">
                    <Phone className="w-3 h-3" /> +212
                  </div>
                  <input
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="06 12 34 56 78"
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#25D366]/40"
                  />
                </div>
                {phone && (
                  <p className="text-[10px] mt-1 flex items-center gap-1">
                    {isPhoneValid
                      ? <><Check className="w-3 h-3 text-[#25D366]" /> <span className="text-[#25D366]">+{formatted}</span></>
                      : <span className="text-red-500">{isDE ? "Ungültige Nummer" : "Numéro invalide"}</span>
                    }
                  </p>
                )}
              </div>

              {/* Template selector */}
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
                  {isDE ? "Vorlage" : "Modèle de message"}
                </label>
                <div className="relative">
                  <button
                    onClick={() => setShowTemplates(!showTemplates)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-muted/50 border border-border rounded-xl text-xs text-foreground hover:border-[#25D366]/40 transition-colors"
                  >
                    <span>{selectedTemplate.emoji} {isDE ? selectedTemplate.labelDe : selectedTemplate.label}</span>
                    <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", showTemplates && "rotate-180")} />
                  </button>
                  {showTemplates && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg z-10 overflow-hidden">
                      {TEMPLATES.map(t => (
                        <button key={t.id} onClick={() => selectTemplate(t)}
                          className={cn(
                            "w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs hover:bg-accent transition-colors",
                            selectedTemplate.id === t.id && "bg-[#25D366]/10 text-[#25D366] font-semibold"
                          )}>
                          <span>{t.emoji}</span>
                          <span>{isDE ? t.labelDe : t.label}</span>
                          {selectedTemplate.id === t.id && <Check className="w-3 h-3 ml-auto" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Message editor */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    {isDE ? "Nachricht" : "Message"}
                  </label>
                  <span className="text-[10px] text-muted-foreground">{charCount} / 1000</span>
                </div>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={8}
                  maxLength={1000}
                  className="w-full px-3 py-2.5 rounded-xl bg-muted/50 border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#25D366]/40 resize-none font-mono leading-relaxed"
                />
              </div>

              {/* Preview badge */}
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
                <MessageSquare className="w-3 h-3 flex-shrink-0" />
                <span>{isDE ? "WhatsApp Web öffnet sich mit vorausgefüllter Nachricht. Einfach auf Senden drücken." : "WhatsApp Web s'ouvrira avec le message pré-rempli. Il suffit d'appuyer sur Envoyer."}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!showHistory && (
          <div className="px-5 py-4 border-t border-border/60 flex gap-3 flex-shrink-0">
            <button onClick={onClose}
              className="flex-1 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-xl transition-colors">
              {isDE ? "Abbrechen" : "Annuler"}
            </button>
            <button
              onClick={handleSend}
              disabled={!isPhoneValid || !message.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#25D366] hover:bg-[#20b858] text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-[#25D366]/20"
            >
              <Send className="w-4 h-4" />
              {isDE ? "Öffnen & Senden" : "Ouvrir WhatsApp"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
