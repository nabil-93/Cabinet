"use client";

import { useState, useEffect, useCallback } from "react";
import { MessageCircle, Clock, Send, Search, RefreshCw, User, Calendar, Phone, Check, Trash2 } from "lucide-react";
import { format, addDays, isWithinInterval, parseISO, startOfDay } from "date-fns";
import { fr, de, type Locale } from "date-fns/locale";
import Header from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import {
  WhatsAppModal,
  loadWaHistory,
  saveWaMessage,
  deleteWaMessage,
  WA_TEMPLATES,
  getWaLogo,
  type WaPatient,
  type WaAppointment,
  type WhatsAppMessage,
} from "@/components/whatsapp/WhatsAppModal";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  date: string;
  time: string;
  type: string;
  status: string;
  phone?: string;
}

interface PendingItem {
  appointment: Appointment;
  patient: WaPatient;
  daysUntil: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateDisplay(dateStr: string, locale: Locale) {
  try {
    return format(parseISO(dateStr), "EEEE d MMMM", { locale });
  } catch {
    return dateStr;
  }
}

function formatSentAt(isoStr: string, locale: Locale) {
  try {
    return format(new Date(isoStr), "d MMM yyyy · HH:mm", { locale });
  } catch {
    return isoStr;
  }
}

function daysUntilLabel(days: number, isDE: boolean) {
  if (days === 0) return isDE ? "Heute" : "Aujourd'hui";
  if (days === 1) return isDE ? "Morgen" : "Demain";
  return isDE ? `In ${days} Tagen` : `Dans ${days} jours`;
}

function urgencyColor(days: number) {
  if (days === 0) return "bg-red-100 text-red-700 border-red-200";
  if (days === 1) return "bg-orange-100 text-orange-700 border-orange-200";
  return "bg-blue-100 text-blue-700 border-blue-200";
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WhatsAppPage() {
  const { lang, t } = useLang();
  const isDE = lang === "de";
  const locale = isDE ? de : fr;

  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [search, setSearch] = useState("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Record<string, { phone?: string }>>({});
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<WhatsAppMessage[]>([]);
  const [modalData, setModalData] = useState<{ patient: WaPatient; apt: WaAppointment } | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  // Load history from localStorage
  const refreshHistory = useCallback(() => {
    setHistory(loadWaHistory());
  }, []);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  // Fetch appointments for next 3 days
  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date();
      const end = addDays(today, 3);
      const dateFrom = format(today, "yyyy-MM-dd");
      const dateTo = format(end, "yyyy-MM-dd");

      // Fetch appointments range by month (then filter client-side by date range)
      const month = format(today, "yyyy-MM");
      const res = await fetch(`/api/v1/appointments?month=${month}`);
      if (!res.ok) throw new Error("Fetch failed");
      const data = await res.json();
      const list: Appointment[] = (data.data || data || []).filter((a: Appointment) => {
        try {
          const d = parseISO(a.date);
          return isWithinInterval(d, { start: startOfDay(today), end: startOfDay(end) });
        } catch {
          return false;
        }
      });

      setAppointments(list);

      // Fetch patient phone numbers for those without it
      const missingIds = list
        .filter(a => !a.phone)
        .map(a => a.patientId)
        .filter((id, i, arr) => arr.indexOf(id) === i);

      if (missingIds.length > 0) {
        const phoneMap: Record<string, { phone?: string }> = {};
        await Promise.all(
          missingIds.map(async (id) => {
            try {
              const r = await fetch(`/api/v1/patients/${id}`);
              if (r.ok) {
                const pd = await r.json();
                phoneMap[id] = { phone: (pd.data || pd).phone };
              }
            } catch {}
          })
        );
        setPatients(phoneMap);
      }
    } catch (e) {
      console.error("WhatsApp page: failed to fetch appointments", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Build pending list — appointments in next 3 days not yet messaged
  const sentAptIds = new Set([
    ...history.map(m => m.appointmentId).filter(Boolean),
    ...sentIds,
  ]);

  const today = new Date();
  const pendingItems: PendingItem[] = appointments
    .filter(a => !sentAptIds.has(a.id) && a.status !== "cancelled")
    .map(a => {
      const phone = a.phone || patients[a.patientId]?.phone;
      const daysUntil = Math.round(
        (startOfDay(parseISO(a.date)).getTime() - startOfDay(today).getTime()) / 86400000
      );
      return {
        appointment: { ...a, phone },
        patient: {
          id: a.patientId,
          fullName: a.patientName,
          phone,
        },
        daysUntil,
      };
    })
    .sort((a, b) => a.daysUntil - b.daysUntil || a.appointment.time.localeCompare(b.appointment.time));

  // Filter by search
  const filteredPending = pendingItems.filter(item =>
    item.patient.fullName.toLowerCase().includes(search.toLowerCase())
  );
  const filteredHistory = history.filter(m =>
    m.patientName.toLowerCase().includes(search.toLowerCase())
  );

  const openModal = (item: PendingItem) => {
    setModalData({
      patient: item.patient,
      apt: {
        id: item.appointment.id,
        date: formatDateDisplay(item.appointment.date, locale),
        rawDate: item.appointment.date,
        time: item.appointment.time,
        type: item.appointment.type,
      },
    });
  };

  const handleSent = (msg: WhatsAppMessage) => {
    setSentIds(prev => {
      const next = new Set(prev);
      if (msg.appointmentId) next.add(msg.appointmentId);
      return next;
    });
    setHistory(prev => [msg, ...prev]);
    setModalData(null);
  };

  const clearHistory = () => {
    if (!confirm(isDE ? "Verlauf wirklich löschen?" : "Vider l'historique ?")) return;
    localStorage.removeItem("clinicos-whatsapp-history");
    setHistory([]);
  };

  return (
    <div className="flex flex-col h-full min-h-screen bg-background">
      <Header title={isDE ? "WhatsApp" : "WhatsApp"} />

      <main className="flex-1 p-4 md:p-6 max-w-4xl mx-auto w-full space-y-4">

        {/* Page header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#25D366] flex items-center justify-center text-white shadow-md shadow-[#25D366]/30">
            <span className="w-5 h-5">{getWaLogo()}</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {isDE ? "WhatsApp-Nachrichten" : "Messages WhatsApp"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {isDE
                ? "Erinnerungen für Patienten in den nächsten 3 Tagen"
                : "Rappels pour les patients des 3 prochains jours"}
            </p>
          </div>
          <button
            onClick={fetchAppointments}
            className="ml-auto p-2 rounded-xl hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title={isDE ? "Aktualisieren" : "Actualiser"}
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center">
              <Send className="w-4 h-4 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{pendingItems.length}</p>
              <p className="text-[11px] text-muted-foreground">
                {isDE ? "À versenden" : "À envoyer"}
              </p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#25D366]/10 flex items-center justify-center">
              <Check className="w-4 h-4 text-[#25D366]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{history.length}</p>
              <p className="text-[11px] text-muted-foreground">
                {isDE ? "Gesendet" : "Envoyés"}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted/50 rounded-xl p-1">
          {(["pending", "history"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all",
                activeTab === tab
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab === "pending" ? (
                <><Send className="w-3.5 h-3.5" />{isDE ? "À versenden" : "À envoyer"}
                  {pendingItems.length > 0 && (
                    <span className="ml-1 text-[10px] font-bold bg-orange-500 text-white rounded-full w-4 h-4 flex items-center justify-center">
                      {pendingItems.length > 9 ? "9+" : pendingItems.length}
                    </span>
                  )}
                </>
              ) : (
                <><Clock className="w-3.5 h-3.5" />{isDE ? "Verlauf" : "Historique"}
                  {history.length > 0 && (
                    <span className="ml-1 text-[10px] font-semibold text-muted-foreground">({history.length})</span>
                  )}
                </>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={isDE ? "Patient suchen…" : "Rechercher un patient…"}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#25D366]/30"
          />
        </div>

        {/* ── TAB: À envoyer ── */}
        {activeTab === "pending" && (
          <div className="space-y-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-2xl p-4 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-muted rounded w-40" />
                      <div className="h-2 bg-muted rounded w-28" />
                    </div>
                    <div className="w-24 h-8 bg-muted rounded-xl" />
                  </div>
                </div>
              ))
            ) : filteredPending.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-12 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[#25D366]/10 flex items-center justify-center mx-auto mb-3">
                  <Check className="w-7 h-7 text-[#25D366]" />
                </div>
                <p className="font-semibold text-foreground">
                  {isDE ? "Alle erledigt!" : "Tout est envoyé !"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {isDE
                    ? "Keine ausstehenden Nachrichten in den nächsten 3 Tagen."
                    : "Aucun rappel en attente pour les 3 prochains jours."}
                </p>
              </div>
            ) : (
              filteredPending.map(item => (
                <PendingCard
                  key={item.appointment.id}
                  item={item}
                  isDE={isDE}
                  locale={locale}
                  onSend={() => openModal(item)}
                />
              ))
            )}
          </div>
        )}

        {/* ── TAB: Historique ── */}
        {activeTab === "history" && (
          <div className="space-y-3">
            {filteredHistory.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-12 text-center">
                <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                  <Clock className="w-7 h-7 text-muted-foreground/40" />
                </div>
                <p className="font-semibold text-foreground">
                  {isDE ? "Noch kein Verlauf" : "Aucun message envoyé"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {isDE
                    ? "Gesendete Nachrichten erscheinen hier."
                    : "Les messages envoyés apparaîtront ici."}
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {isDE ? `${filteredHistory.length} Nachricht(en)` : `${filteredHistory.length} message(s)`}
                  </p>
                  <button
                    onClick={clearHistory}
                    className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {isDE ? "Verlauf löschen" : "Vider l'historique"}
                  </button>
                </div>
                {filteredHistory.map(msg => (
                  <HistoryCard
                    key={msg.id}
                    msg={msg}
                    isDE={isDE}
                    locale={locale}
                    onDelete={(id) => {
                      deleteWaMessage(id);
                      setHistory(prev => prev.filter(m => m.id !== id));
                    }}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </main>

      {/* Modal */}
      {modalData && (
        <WhatsAppModal
          patient={modalData.patient}
          nextApt={modalData.apt}
          onClose={() => setModalData(null)}
          onSent={handleSent}
          lang={lang}
        />
      )}
    </div>
  );
}

// ─── Pending Card ─────────────────────────────────────────────────────────────

function PendingCard({
  item,
  isDE,
  locale,
  onSend,
}: {
  item: PendingItem;
  isDE: boolean;
  locale: Locale;
  onSend: () => void;
}) {
  const { appointment: apt, patient, daysUntil } = item;
  return (
    <div className="bg-card border border-border rounded-2xl p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <User className="w-5 h-5 text-primary" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground truncate">{patient.fullName}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Calendar className="w-3 h-3" />
              {formatDateDisplay(apt.date, locale)} · {apt.time}
            </span>
            <span className="text-[10px] text-muted-foreground/50">•</span>
            <span className="text-[11px] text-muted-foreground">{apt.type}</span>
            {patient.phone && (
              <>
                <span className="text-[10px] text-muted-foreground/50">•</span>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Phone className="w-3 h-3" />
                  {patient.phone}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Urgency badge + send button */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", urgencyColor(daysUntil))}>
            {daysUntilLabel(daysUntil, isDE)}
          </span>
          <button
            onClick={onSend}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366] hover:bg-[#20b858] text-white text-xs font-bold rounded-xl transition-colors shadow-sm shadow-[#25D366]/20"
          >
            <Send className="w-3.5 h-3.5" />
            {isDE ? "Senden" : "Envoyer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── History Card ─────────────────────────────────────────────────────────────

function appointmentBadge(rawDate: string | undefined, isDE: boolean) {
  if (!rawDate) return null;
  try {
    const days = Math.round(
      (startOfDay(parseISO(rawDate)).getTime() - startOfDay(new Date()).getTime()) / 86400000
    );
    let label: string;
    let color: string;
    if (days < 0) {
      label = isDE ? `Vor ${Math.abs(days)} Tagen` : `Il y a ${Math.abs(days)} j`;
      color = "bg-muted text-muted-foreground border-border";
    } else if (days === 0) {
      label = isDE ? "Heute" : "Aujourd'hui";
      color = "bg-red-100 text-red-700 border-red-200";
    } else if (days === 1) {
      label = isDE ? "Morgen" : "Demain";
      color = "bg-orange-100 text-orange-700 border-orange-200";
    } else {
      label = isDE ? `In ${days} Tagen` : `Dans ${days} j`;
      color = "bg-blue-100 text-blue-700 border-blue-200";
    }
    return (
      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", color)}>
        {label}
      </span>
    );
  } catch {
    return null;
  }
}

function HistoryCard({
  msg,
  isDE,
  locale,
  onDelete,
}: {
  msg: WhatsAppMessage;
  isDE: boolean;
  locale: Locale;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const template = WA_TEMPLATES.find(t => t.id === msg.templateId);
  const templateLabel = template ? (isDE ? template.labelDE : template.label) : msg.templateId;
  const badge = appointmentBadge(msg.appointmentDate, isDE);

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-3 flex-1 min-w-0 text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-[#25D366]/10 flex items-center justify-center flex-shrink-0">
            <Check className="w-5 h-5 text-[#25D366]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm text-foreground truncate">{msg.patientName}</p>
              {badge}
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-[11px] text-[#25D366] font-medium">
                {template?.emoji ?? "💬"} {templateLabel}
              </span>
              <span className="text-[10px] text-muted-foreground/50">•</span>
              <span className="text-[11px] text-muted-foreground">+{msg.phone}</span>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-[11px] text-muted-foreground">{formatSentAt(msg.sentAt, locale)}</p>
            <p className={cn("text-[10px] mt-0.5 transition-transform duration-200", expanded ? "rotate-180" : "")}>▼</p>
          </div>
        </button>

        {/* Delete button */}
        <button
          onClick={() => onDelete(msg.id)}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
          title={isDE ? "Löschen" : "Supprimer"}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-border/40 pt-3">
          <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed bg-muted/30 rounded-xl p-3">
            {msg.message}
          </p>
        </div>
      )}
    </div>
  );
}
