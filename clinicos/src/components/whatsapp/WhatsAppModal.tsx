"use client";

import { useState, useEffect } from "react";
import { X, MessageSquare, ChevronDown, Send, Clock, Check, Phone, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WaPatient {
  id: string;
  fullName: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
}

export interface WaAppointment {
  id?: string;
  date: string;
  time: string;
  type: string;
}

export interface WhatsAppMessage {
  id: string;
  patientId: string;
  patientName: string;
  phone: string;
  message: string;
  templateId: string;
  sentAt: string;
  appointmentId?: string;
}

// ─── Country codes ────────────────────────────────────────────────────────────

export const COUNTRY_CODES = [
  { code: "212", flag: "🇲🇦", name: "Maroc",       nameDE: "Marokko",    localPrefix: "0", localLen: 10 },
  { code: "49",  flag: "🇩🇪", name: "Allemagne",   nameDE: "Deutschland",localPrefix: "0", localLen: 11 },
  { code: "33",  flag: "🇫🇷", name: "France",      nameDE: "Frankreich", localPrefix: "0", localLen: 10 },
  { code: "32",  flag: "🇧🇪", name: "Belgique",    nameDE: "Belgien",    localPrefix: "0", localLen: 9  },
  { code: "41",  flag: "🇨🇭", name: "Suisse",      nameDE: "Schweiz",    localPrefix: "0", localLen: 9  },
  { code: "34",  flag: "🇪🇸", name: "Espagne",     nameDE: "Spanien",    localPrefix: "",  localLen: 9  },
  { code: "44",  flag: "🇬🇧", name: "Royaume-Uni", nameDE: "Großbritannien", localPrefix: "0", localLen: 11 },
  { code: "1",   flag: "🇺🇸", name: "USA/Canada",  nameDE: "USA/Kanada", localPrefix: "1", localLen: 11 },
];

// ─── Phone formatter ──────────────────────────────────────────────────────────

export function formatPhone(raw: string, countryCode: string): string {
  const clean = raw.replace(/[\s\-\.\(\)\+]/g, "");
  if (clean.startsWith(countryCode)) return clean;
  const cc = COUNTRY_CODES.find(c => c.code === countryCode);
  if (!cc) return clean;
  if (cc.localPrefix && clean.startsWith(cc.localPrefix)) {
    return countryCode + clean.slice(cc.localPrefix.length);
  }
  return countryCode + clean;
}

export function buildWhatsAppUrl(phone: string, countryCode: string, message: string): string {
  const formatted = formatPhone(phone, countryCode);
  return `https://wa.me/${formatted}?text=${encodeURIComponent(message)}`;
}

// ─── Templates ────────────────────────────────────────────────────────────────

export interface WaTemplate {
  id: string;
  emoji: string;
  label: string;
  labelDE: string;
  generate: (p: WaPatient, apt?: WaAppointment | null, lang?: string) => string;
}

export const WA_TEMPLATES: WaTemplate[] = [
  {
    id: "rdv_rappel",
    emoji: "📅",
    label: "Rappel de rendez-vous",
    labelDE: "Terminerinnerung",
    generate: (p, apt, lang) => lang === "de"
      ? `Guten Tag ${p.fullName},\n\nWir möchten Sie an Ihren Termin am ${apt?.date ?? "—"} um ${apt?.time ?? "—"} Uhr (${apt?.type ?? "Konsultation"}) erinnern.\n\nBitte bestätigen Sie Ihre Anwesenheit oder kontaktieren Sie uns.\n\nMit freundlichen Grüßen,\nIhre Arztpraxis`
      : `Bonjour ${p.fullName},\n\nNous vous rappelons votre rendez-vous prévu le ${apt?.date ?? "—"} à ${apt?.time ?? "—"} (${apt?.type ?? "Consultation"}).\n\nMerci de confirmer votre présence ou de nous contacter.\n\nCordialement,\nVotre cabinet médical`,
  },
  {
    id: "rdv_confirm",
    emoji: "✅",
    label: "Confirmation de rendez-vous",
    labelDE: "Terminbestätigung",
    generate: (p, apt, lang) => lang === "de"
      ? `Guten Tag ${p.fullName},\n\nIhr Termin am ${apt?.date ?? "—"} um ${apt?.time ?? "—"} Uhr ist bestätigt.\n\nBitte erscheinen Sie 5 Minuten vor Ihrem Termin.\n\nMit freundlichen Grüßen,\nIhre Arztpraxis`
      : `Bonjour ${p.fullName},\n\nVotre rendez-vous du ${apt?.date ?? "—"} à ${apt?.time ?? "—"} est bien confirmé.\n\nMerci d'arriver 5 minutes avant l'heure.\n\nCordialement,\nVotre cabinet médical`,
  },
  {
    id: "resultats",
    emoji: "📋",
    label: "Résultats disponibles",
    labelDE: "Ergebnisse verfügbar",
    generate: (p, _apt, lang) => lang === "de"
      ? `Guten Tag ${p.fullName},\n\nIhre Analyseergebnisse sind verfügbar.\nBitte kontaktieren Sie uns oder kommen Sie vorbei.\n\nMit freundlichen Grüßen,\nIhre Arztpraxis`
      : `Bonjour ${p.fullName},\n\nVos résultats d'analyses sont disponibles.\nMerci de nous contacter ou de passer au cabinet.\n\nCordialement,\nVotre cabinet médical`,
  },
  {
    id: "annulation",
    emoji: "❌",
    label: "Consultation annulée",
    labelDE: "Termin abgesagt",
    generate: (p, apt, lang) => lang === "de"
      ? `Guten Tag ${p.fullName},\n\nIhr Termin am ${apt?.date ?? "—"} um ${apt?.time ?? "—"} Uhr muss leider abgesagt werden.\nBitte kontaktieren Sie uns für einen neuen Termin.\n\nMit freundlichen Grüßen,\nIhre Arztpraxis`
      : `Bonjour ${p.fullName},\n\nNous sommes dans l'obligation d'annuler votre rendez-vous du ${apt?.date ?? "—"} à ${apt?.time ?? "—"}.\nMerci de nous contacter pour reprogrammer.\n\nCordialement,\nVotre cabinet médical`,
  },
  {
    id: "suivi",
    emoji: "💊",
    label: "Rappel de suivi / traitement",
    labelDE: "Erinnerung Nachsorge",
    generate: (p, _apt, lang) => lang === "de"
      ? `Guten Tag ${p.fullName},\n\nDies ist eine Erinnerung, Ihre Behandlung fortzusetzen und einen Kontrolltermin zu vereinbaren.\n\nMit freundlichen Grüßen,\nIhre Arztpraxis`
      : `Bonjour ${p.fullName},\n\nCeci est un rappel pour continuer votre traitement et programmer un rendez-vous de suivi.\n\nCordialement,\nVotre cabinet médical`,
  },
  {
    id: "custom",
    emoji: "✏️",
    label: "Message personnalisé",
    labelDE: "Benutzerdefinierte Nachricht",
    generate: (p, _apt, lang) => lang === "de"
      ? `Guten Tag ${p.fullName},\n\n\n\nMit freundlichen Grüßen,\nIhre Arztpraxis`
      : `Bonjour ${p.fullName},\n\n\n\nCordialement,\nVotre cabinet médical`,
  },
];

// ─── History helpers ──────────────────────────────────────────────────────────

const HISTORY_KEY = "clinicos-whatsapp-history";

export function loadWaHistory(): WhatsAppMessage[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]"); } catch { return []; }
}

export function saveWaMessage(msg: WhatsAppMessage) {
  const history = loadWaHistory();
  const next = [msg, ...history].slice(0, 200);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch {}
}

export function deleteWaMessage(id: string) {
  const next = loadWaHistory().filter(m => m.id !== id);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch {}
}

export function getWaLogo() {
  return (
    <svg viewBox="0 0 24 24" className="fill-current">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

interface WhatsAppModalProps {
  patient: WaPatient;
  nextApt?: WaAppointment | null;
  onClose: () => void;
  onSent?: (msg: WhatsAppMessage) => void;
  lang?: "fr" | "de";
}

export function WhatsAppModal({ patient, nextApt, onClose, onSent, lang = "fr" }: WhatsAppModalProps) {
  const isDE = lang === "de";
  const defaultCC = isDE ? "49" : "212";

  const [countryCode, setCountryCode] = useState(defaultCC);
  const [showCC, setShowCC]           = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(WA_TEMPLATES[0]);
  const [message, setMessage]  = useState(() => WA_TEMPLATES[0].generate(patient, nextApt, lang));
  const [phone, setPhone]      = useState(patient.phone ?? "");
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory]  = useState<WhatsAppMessage[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => {
    setHistory(loadWaHistory().filter(m => m.patientId === patient.id));
  }, [patient.id]);

  const selectTemplate = (t: typeof WA_TEMPLATES[0]) => {
    setSelectedTemplate(t);
    setMessage(t.generate(patient, nextApt, lang));
    setShowTemplates(false);
  };

  const cc = COUNTRY_CODES.find(c => c.code === countryCode) ?? COUNTRY_CODES[0];
  const formatted = formatPhone(phone, countryCode);
  const isPhoneValid = formatted.replace(/\D/g, "").length >= 9;

  const handleSend = () => {
    if (!isPhoneValid) return;
    const url = buildWhatsAppUrl(phone, countryCode, message);
    window.open(url, "_blank", "noopener,noreferrer");

    const msg: WhatsAppMessage = {
      id: `wa-${Date.now()}`,
      patientId: patient.id,
      patientName: patient.fullName,
      phone: formatted,
      message,
      templateId: selectedTemplate.id,
      sentAt: new Date().toISOString(),
      appointmentId: nextApt ? (nextApt as any).id : undefined,
    };
    saveWaMessage(msg);
    setHistory(prev => [msg, ...prev]);
    onSent?.(msg);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-[#25D366]/10 border-b border-[#25D366]/20 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#25D366] flex items-center justify-center text-white">
              {getWaLogo()}
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">WhatsApp</h2>
              <p className="text-[10px] text-muted-foreground">{patient.fullName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowHistory(!showHistory)}
              className={cn("flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg transition-colors",
                showHistory ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted")}>
              <Clock className="w-3 h-3" /> {isDE ? "Verlauf" : "Historique"}
              {history.length > 0 && <span className="ml-1 text-[#25D366]">({history.length})</span>}
            </button>
            <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {showHistory ? (
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
                        {WA_TEMPLATES.find(t => t.id === msg.templateId)?.[isDE ? "labelDE" : "label"] ?? msg.templateId}
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
            <div className="p-5 space-y-4">
              {/* Phone + country code */}
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
                  {isDE ? "Telefonnummer" : "Numéro de téléphone"}
                </label>
                <div className="flex items-center gap-2">
                  {/* Country code selector */}
                  <div className="relative flex-shrink-0">
                    <button onClick={() => setShowCC(!showCC)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-muted/50 border border-border rounded-lg text-xs text-foreground hover:border-[#25D366]/40 transition-colors whitespace-nowrap">
                      <span>{cc.flag}</span>
                      <span className="font-semibold">+{cc.code}</span>
                      <ChevronDown className={cn("w-3 h-3 text-muted-foreground transition-transform", showCC && "rotate-180")} />
                    </button>
                    {showCC && (
                      <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-xl shadow-lg z-20 overflow-hidden w-52">
                        {COUNTRY_CODES.map(c => (
                          <button key={c.code} onClick={() => { setCountryCode(c.code); setShowCC(false); }}
                            className={cn("w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-accent transition-colors",
                              countryCode === c.code && "bg-[#25D366]/10 font-semibold")}>
                            <span>{c.flag}</span>
                            <span className="flex-1">{isDE ? c.nameDE : c.name}</span>
                            <span className="text-muted-foreground font-mono">+{c.code}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input value={phone} onChange={e => setPhone(e.target.value)}
                    placeholder={cc.localPrefix + "6 12 34 56 78"}
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#25D366]/40" />
                </div>
                {phone && (
                  <p className="text-[10px] mt-1 flex items-center gap-1">
                    {isPhoneValid
                      ? <><Check className="w-3 h-3 text-[#25D366]" /><span className="text-[#25D366]">+{formatted}</span></>
                      : <span className="text-red-500">{isDE ? "Ungültige Nummer" : "Numéro invalide"}</span>}
                  </p>
                )}
              </div>

              {/* Template selector */}
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
                  {isDE ? "Vorlage" : "Modèle de message"}
                </label>
                <div className="relative">
                  <button onClick={() => setShowTemplates(!showTemplates)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-muted/50 border border-border rounded-xl text-xs text-foreground hover:border-[#25D366]/40 transition-colors">
                    <span>{selectedTemplate.emoji} {isDE ? selectedTemplate.labelDE : selectedTemplate.label}</span>
                    <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", showTemplates && "rotate-180")} />
                  </button>
                  {showTemplates && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg z-10 overflow-hidden">
                      {WA_TEMPLATES.map(t => (
                        <button key={t.id} onClick={() => selectTemplate(t)}
                          className={cn("w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs hover:bg-accent transition-colors",
                            selectedTemplate.id === t.id && "bg-[#25D366]/10 text-[#25D366] font-semibold")}>
                          <span>{t.emoji}</span>
                          <span>{isDE ? t.labelDE : t.label}</span>
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
                  <span className="text-[10px] text-muted-foreground">{message.length} / 1000</span>
                </div>
                <textarea value={message} onChange={e => setMessage(e.target.value)} rows={8} maxLength={1000}
                  className="w-full px-3 py-2.5 rounded-xl bg-muted/50 border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-[#25D366]/40 resize-none font-mono leading-relaxed" />
              </div>

              <div className="flex items-center gap-2 text-[10px] text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
                <MessageSquare className="w-3 h-3 flex-shrink-0" />
                <span>{isDE ? "WhatsApp Web öffnet sich mit vorausgefüllter Nachricht." : "WhatsApp Web s'ouvrira avec le message pré-rempli."}</span>
              </div>
            </div>
          )}
        </div>

        {!showHistory && (
          <div className="px-5 py-4 border-t border-border/60 flex gap-3 flex-shrink-0">
            <button onClick={onClose}
              className="flex-1 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-xl transition-colors">
              {isDE ? "Abbrechen" : "Annuler"}
            </button>
            <button onClick={handleSend} disabled={!isPhoneValid || !message.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#25D366] hover:bg-[#20b858] text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-[#25D366]/20">
              <Send className="w-4 h-4" />
              {isDE ? "WhatsApp öffnen" : "Ouvrir WhatsApp"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
