"use client";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity, LogIn, LogOut, Edit, Trash2, UserPlus, Filter, RefreshCw,
  CalendarPlus, RotateCcw, FileText, CreditCard, ArrowRight, CheckCircle,
  X, ClipboardList, Pill, UserCog, Smartphone, Monitor, Download,
  Image, MessageCircle, Navigation, ChevronRight, Search, Calendar, ChevronDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatDistanceToNow, format, startOfDay, startOfWeek, startOfMonth } from "date-fns";
import { fr, de, type Locale } from "date-fns/locale";
import Header from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import api from "@/services/api";
import { useLang } from "@/lib/i18n";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface ActivityLog {
  id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_label: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  "oklch(0.55 0.18 240)", "oklch(0.52 0.20 165)", "oklch(0.55 0.18 300)",
  "oklch(0.55 0.18 30)",  "oklch(0.52 0.18 200)", "oklch(0.55 0.20 120)",
  "oklch(0.52 0.19 270)", "oklch(0.55 0.18 60)",
];

const ACTION_ICON_MAP: Record<string, { color: string; icon: LucideIcon }> = {
  // ── Auth ──
  login:                     { color: "text-emerald-500", icon: LogIn },
  logout:                    { color: "text-red-500",     icon: LogOut },
  // ── Patients ──
  create_patient:            { color: "text-blue-500",    icon: UserPlus },
  update_patient:            { color: "text-amber-500",   icon: Edit },
  delete_patient:            { color: "text-red-500",     icon: Trash2 },
  // ── Appointments ──
  create_appointment:        { color: "text-blue-500",    icon: CalendarPlus },
  update_appointment_status: { color: "text-amber-500",   icon: RefreshCw },
  reschedule_appointment:    { color: "text-amber-500",   icon: RotateCcw },
  delete_appointment:        { color: "text-red-500",     icon: Trash2 },
  // ── Invoices ──
  create_invoice:            { color: "text-blue-500",    icon: FileText },
  update_invoice:            { color: "text-amber-500",   icon: Edit },
  pay_invoice:               { color: "text-emerald-500", icon: CreditCard },
  delete_invoice:            { color: "text-red-500",     icon: Trash2 },
  // ── Waiting room ──
  add_to_waiting_room:       { color: "text-blue-500",    icon: UserPlus },
  call_patient:              { color: "text-emerald-500", icon: ArrowRight },
  finish_consultation:       { color: "text-emerald-500", icon: CheckCircle },
  remove_from_waiting_room:  { color: "text-red-400",     icon: X },
  // ── Consultations ──
  create_consultation:       { color: "text-blue-500",    icon: ClipboardList },
  // ── Prescriptions ──
  create_prescription:       { color: "text-blue-500",    icon: Pill },
  update_prescription:       { color: "text-amber-500",   icon: Edit },
  delete_prescription:       { color: "text-red-500",     icon: Trash2 },
  // ── Users ──
  create_user:               { color: "text-purple-500",  icon: UserCog },
  update_user:               { color: "text-amber-500",   icon: Edit },
  delete_user:               { color: "text-red-500",     icon: Trash2 },
  activate_user:             { color: "text-emerald-500", icon: UserCog },
  deactivate_user:           { color: "text-gray-500",    icon: UserCog },
  reset_password:            { color: "text-amber-600",   icon: UserCog },
  // ── Navigation ──
  page_view:                 { color: "text-indigo-500",  icon: Navigation },
  navigate:                  { color: "text-indigo-500",  icon: ArrowRight },
  view_patient:              { color: "text-violet-500",  icon: UserPlus },
  // ── Downloads / Exports ──
  export_excel:              { color: "text-green-500",   icon: Download },
  export_pdf:                { color: "text-green-500",   icon: FileText },
  export_image:              { color: "text-green-500",   icon: Image },
  // ── WhatsApp ──
  click_whatsapp:            { color: "text-green-500",   icon: MessageCircle },
  whatsapp_sent:             { color: "text-green-500",   icon: MessageCircle },
};

const DATE_RANGE_OPTIONS = [
  { value: "all",   label: "Tout" },
  { value: "today", label: "Aujourd'hui" },
  { value: "week",  label: "Cette semaine" },
  { value: "month", label: "Ce mois" },
];

// ─── Helpers ────────────────────────────────────────────────────────────────────
function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

function getUserColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getDateFrom(range: string): string | null {
  const now = new Date();
  if (range === "today") return startOfDay(now).toISOString();
  if (range === "week")  return startOfWeek(now, { weekStartsOn: 1 }).toISOString();
  if (range === "month") return startOfMonth(now).toISOString();
  return null;
}

// ─── Detail Drawer component ────────────────────────────────────────────────────
interface DetailDrawerProps {
  log: ActivityLog | null;
  onClose: () => void;
  lang: string;
  dateLocale: Locale;
  getActionLabel: (action: string) => string;
  getActionMeta: (action: string) => { color: string; icon: LucideIcon };
  roleBadge: (role: string) => string;
  translateEntityLabel: (label: string) => string;
}

function DetailDrawer({
  log,
  onClose,
  lang,
  dateLocale,
  getActionLabel,
  getActionMeta,
  roleBadge,
  translateEntityLabel,
}: DetailDrawerProps) {
  if (!log) return null;

  const meta = getActionMeta(log.action);
  const Icon = meta.icon;
  const avatarColor = getUserColor(log.user_id);
  const details = log.details as Record<string, unknown> | null;

  // Render a single detail key-value pair
  function renderDetailRow(key: string, value: unknown): React.ReactNode {
    const strVal = String(value);

    if (key === "from" || key === "to") return null; // handled together below
    if (key === "device") {
      const isMobile = strVal === "mobile";
      return (
        <div key={key} className="flex items-center gap-2 text-sm">
          {isMobile ? <Smartphone className="w-4 h-4 text-muted-foreground" /> : <Monitor className="w-4 h-4 text-muted-foreground" />}
          <span className="text-muted-foreground capitalize">{strVal}</span>
        </div>
      );
    }
    if (key === "filename") {
      return (
        <div key={key} className="flex items-start gap-2 text-sm">
          <Download className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div>
            <span className="text-muted-foreground">Fichier: </span>
            <span className="text-foreground font-medium break-all">{strVal}</span>
          </div>
        </div>
      );
    }
    if (key === "count") {
      return (
        <div key={key} className="flex items-center gap-2 text-sm">
          <ClipboardList className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground">Entrées: </span>
          <span className="text-foreground font-semibold">{strVal}</span>
        </div>
      );
    }
    if (key === "duration_ms") {
      const ms = Number(value);
      const display = isNaN(ms) ? strVal : `${(ms / 1000).toFixed(1)}s`;
      return (
        <div key={key} className="flex items-center gap-2 text-sm">
          <Activity className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground">Durée: </span>
          <span className="text-foreground font-medium">{display}</span>
        </div>
      );
    }
    // Generic key-value
    return (
      <div key={key} className="flex items-start gap-2 text-sm">
        <span className="text-muted-foreground min-w-0 break-all">
          <span className="font-medium text-foreground/70">{key}:</span> {strVal}
        </span>
      </div>
    );
  }

  const hasNavigation = details && typeof details.from === "string" && typeof details.to === "string";
  const otherKeys = details
    ? Object.keys(details).filter(k => k !== "from" && k !== "to")
    : [];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-card border-l border-border shadow-2xl z-50 flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <h2 className="text-base font-semibold text-foreground">Détail de l&apos;activité</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scroll">

          {/* User info */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm text-white flex-shrink-0"
              style={{ background: avatarColor }}
            >
              {initials(log.user_name || "?")}
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {log.user_role === "doctor" ? `Dr. ${log.user_name}` : log.user_name}
              </p>
              <p className="text-xs text-muted-foreground">{roleBadge(log.user_role)}</p>
            </div>
          </div>

          {/* Action */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Action</p>
            <div className="flex items-center gap-3 p-3 rounded-xl border border-border">
              <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", "bg-current/10", meta.color)}>
                <Icon className={cn("w-4 h-4", meta.color)} />
              </div>
              <div>
                <p className={cn("font-semibold text-sm", meta.color)}>{getActionLabel(log.action)}</p>
                <p className="text-xs text-muted-foreground font-mono">{log.action}</p>
              </div>
            </div>
          </div>

          {/* Entity */}
          {log.entity_label && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Entité</p>
              <div className="p-3 rounded-xl border border-border">
                <p className="font-medium text-foreground text-sm">{translateEntityLabel(log.entity_label)}</p>
                {log.entity_type && (
                  <p className="text-xs text-muted-foreground mt-0.5 font-mono">{log.entity_type}</p>
                )}
              </div>
            </div>
          )}

          {/* Date / Time */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date & Heure</p>
            <div className="p-3 rounded-xl border border-border space-y-1">
              <p className="font-semibold text-foreground text-sm">
                {format(
                  new Date(log.created_at),
                  lang === "de" ? "EEEE d MMMM yyyy" : "EEEE d MMMM yyyy",
                  { locale: dateLocale }
                )}
              </p>
              <p className="text-sm text-muted-foreground">
                {format(new Date(log.created_at), "HH:mm:ss")}
                {" · "}
                {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: dateLocale })}
              </p>
            </div>
          </div>

          {/* Details */}
          {details && (Object.keys(details).length > 0) && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Détails</p>
              <div className="p-3 rounded-xl border border-border space-y-3">

                {/* Navigation from → to */}
                {hasNavigation && (
                  <div className="flex items-center gap-2 text-sm flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <Navigation className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground">De:</span>
                      <span className="font-medium text-foreground">{String(details.from)}</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">Vers:</span>
                      <span className="font-medium text-foreground">{String(details.to)}</span>
                    </div>
                  </div>
                )}

                {/* Other detail keys */}
                {otherKeys.map(k => renderDetailRow(k, details[k]))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ActivityPage() {
  const { lang, t } = useLang();
  const dateLocale = lang === "de" ? de : fr;

  const [activeTab,       setActiveTab]       = useState<"actions" | "navigation">("actions");
  const [userFilter,      setUserFilter]      = useState("all");
  const [actionFilter,    setActionFilter]    = useState("all");
  const [dateRange,       setDateRange]       = useState("all");
  const [searchQuery,     setSearchQuery]     = useState("");
  const [selectedLog,     setSelectedLog]     = useState<ActivityLog | null>(null);
  const [showDeleteMenu,  setShowDeleteMenu]  = useState(false);
  const [deleting,        setDeleting]        = useState(false);
  const [customHours,     setCustomHours]     = useState("");

  const NAV_ACTIONS = new Set(["page_view", "navigate", "view_patient"]);

  const DELETE_OPTIONS = [
    { label: lang === "de" ? "Älter als 24 Stunden" : "Plus de 24h",    hours: 24 },
    { label: lang === "de" ? "Älter als 1 Woche"    : "Plus d'1 semaine", hours: 24 * 7 },
    { label: lang === "de" ? "Älter als 1 Monat"    : "Plus d'1 mois",   hours: 24 * 30 },
    { label: lang === "de" ? "Älter als 3 Monate"   : "Plus de 3 mois",  hours: 24 * 90 },
    { label: lang === "de" ? "Älter als 6 Monate"   : "Plus de 6 mois",  hours: 24 * 180 },
  ];

  async function handleDelete(hours: number) {
    setShowDeleteMenu(false);
    const label = DELETE_OPTIONS.find(o => o.hours === hours)?.label ?? `${hours}h`;

    const tabLabel = activeTab === "navigation"
      ? (lang === "de" ? "Navigation" : "Navigation")
      : (lang === "de" ? "Aktivitäten" : "Activités");

    const confirmMsg = lang === "de"
      ? `[${tabLabel}] Einträge löschen die älter als ${label} sind?\nNur der aktuelle Tab wird gelöscht. Diese Aktion ist irreversibel.`
      : `[${tabLabel}] Supprimer les entrées de plus de ${label.toLowerCase()} ?\nSeul l'onglet actif sera supprimé. Cette action est irréversible.`;

    if (!window.confirm(confirmMsg)) return;
    setDeleting(true);
    try {
      const olderThan = new Date(Date.now() - hours * 3600 * 1000).toISOString();
      const params = new URLSearchParams({ olderThan, category: activeTab });
      const res = await fetch(`/api/v1/activity?${params}`, { method: "DELETE" });
      const data = await res.json();
      const count = data?.data?.deleted ?? data?.deleted ?? 0;
      await refetch();
      alert(lang === "de" ? `${count} Einträge aus "${tabLabel}" gelöscht.` : `${count} entrée(s) supprimée(s) dans "${tabLabel}".`);
    } catch {
      alert(lang === "de" ? "Fehler beim Löschen." : "Erreur lors de la suppression.");
    } finally {
      setDeleting(false);
    }
  }

  // Build query params for API
  const dateFrom = useMemo(() => getDateFrom(dateRange), [dateRange]);

  const { data: logs = [], isLoading, dataUpdatedAt, refetch, isFetching } = useQuery<ActivityLog[]>({
    queryKey: ["activity-feed", dateFrom],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "200" });
      if (dateFrom) params.set("dateFrom", dateFrom);
      const r = await api.get(`/activity?${params.toString()}`);
      return r.data;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { data: members = [] } = useQuery<TeamMember[]>({
    queryKey: ["team"],
    queryFn: async () => { const r = await api.get("/users"); return r.data; },
    staleTime: 60_000,
  });

  const ACTION_TYPE_OPTIONS = [
    { value: "all",        label: t("activity.allActions") },
    { value: "login",      label: t("activity.filters.logins") },
    { value: "logout",     label: t("activity.filters.logouts") },
    { value: "create",     label: t("activity.filters.creates") },
    { value: "update",     label: t("activity.filters.updates") },
    { value: "delete",     label: t("activity.filters.deletes") },
    { value: "reset",      label: t("activity.filters.resets") },
    { value: "activate",   label: t("activity.filters.activations") },
    { value: "deactivate", label: t("activity.filters.deactivations") },
    { value: "download",   label: lang === "de" ? "Downloads" : "Téléchargements" },
  ];

  const ENTITY_LABEL_MAP: Record<string, string> = {
    "Connexion":   t("activity.entityLabels.login"),
    "Déconnexion": t("activity.entityLabels.logout"),
    "Session":     t("activity.entityLabels.session"),
  };

  function translateEntityLabel(label: string): string {
    return ENTITY_LABEL_MAP[label] ?? label;
  }

  function getActionLabel(action: string): string {
    const key = `activity.actions.${action}` as const;
    const label = t(key);
    if (label !== key) return label;
    if (action === "page_view")    return "Navigation";
    if (action === "navigate")     return "Navigation";
    if (action === "view_patient") return lang === "de" ? "Patientenprofil angesehen" : "Profil patient consulté";
    if (action === "export_excel") return "Export Excel";
    if (action === "export_pdf")   return "Export PDF";
    if (action === "export_image") return "Export Image";
    if (action === "click_whatsapp") return "WhatsApp";
    if (action === "whatsapp_sent")  return "WhatsApp envoyé";
    if (action.startsWith("create_")) return t("activity.filters.creates");
    if (action.startsWith("update_")) return t("activity.filters.updates");
    if (action.startsWith("delete_")) return t("activity.filters.deletes");
    return action.replace(/_/g, " ");
  }

  function getActionMeta(action: string): { color: string; icon: LucideIcon } {
    if (ACTION_ICON_MAP[action]) return ACTION_ICON_MAP[action];
    if (action.startsWith("page_view") || action === "navigate") return { color: "text-indigo-500", icon: Navigation };
    if (action.startsWith("export_"))   return { color: "text-green-500",  icon: Download };
    if (action.startsWith("create_"))   return { color: "text-blue-500",   icon: UserPlus };
    if (action.startsWith("update_"))   return { color: "text-amber-500",  icon: Edit };
    if (action.startsWith("delete_"))   return { color: "text-red-500",    icon: Trash2 };
    return { color: "text-muted-foreground", icon: Activity };
  }

  function roleBadge(role: string) {
    if (role === "doctor")    return t("activity.roleMedecin");
    if (role === "assistant") return t("activity.roleSecretaire");
    if (role === "admin")     return t("activity.roleAdmin");
    return role;
  }

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return logs.filter(log => {
      // Tab split: navigation vs actions
      const isNav = NAV_ACTIONS.has(log.action);
      if (activeTab === "navigation" && !isNav) return false;
      if (activeTab === "actions"    &&  isNav) return false;

      // User filter
      const matchUser = userFilter === "all" || log.user_id === userFilter;

      // Action type filter (only relevant in "actions" tab)
      const matchAction = activeTab === "navigation" || actionFilter === "all"
        || (actionFilter === "login"      && log.action === "login")
        || (actionFilter === "logout"     && log.action === "logout")
        || (actionFilter === "create"     && log.action.startsWith("create_"))
        || (actionFilter === "update"     && log.action.startsWith("update_"))
        || (actionFilter === "delete"     && log.action.startsWith("delete_"))
        || (actionFilter === "reset"      && log.action === "reset_password")
        || (actionFilter === "activate"   && log.action === "activate_user")
        || (actionFilter === "deactivate" && log.action === "deactivate_user")
        || (actionFilter === "download"   && log.action.startsWith("export_"));

      // Search filter
      const matchSearch = !q
        || (log.entity_label ?? "").toLowerCase().includes(q)
        || (log.user_name    ?? "").toLowerCase().includes(q)
        || log.action.toLowerCase().includes(q);

      return matchUser && matchAction && matchSearch;
    });
  }, [logs, userFilter, actionFilter, searchQuery, activeTab, NAV_ACTIONS]);

  return (
    <div className="flex flex-col h-full">
      <Header title={t("activity.journalTitle")} subtitle={t("activity.journalSubtitle")} />

      <div className="flex-1 overflow-auto custom-scroll p-6 space-y-5">

        {/* ── Tabs ── */}
        <div className="flex gap-1 bg-muted/50 rounded-xl p-1">
          <button
            onClick={() => setActiveTab("actions")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all",
              activeTab === "actions"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Activity className="w-4 h-4" />
            {lang === "de" ? "Aktivitäten" : "Activités"}
            <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
              {logs.filter(l => !NAV_ACTIONS.has(l.action)).length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("navigation")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all",
              activeTab === "navigation"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Navigation className="w-4 h-4" />
            {lang === "de" ? "Navigation" : "Navigation"}
            <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
              {logs.filter(l => NAV_ACTIONS.has(l.action)).length}
            </span>
          </button>
        </div>

        {/* ── Filters bar ── */}
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
          {/* Row 1: search + date range */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Rechercher..."
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-border bg-background/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            {/* Date range */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <div className="flex rounded-xl border border-border overflow-hidden">
                {DATE_RANGE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setDateRange(opt.value)}
                    className={cn(
                      "px-3 py-2 text-xs font-medium transition-colors",
                      dateRange === opt.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-background/50 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Row 2: user + action + refresh */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <select
                  value={userFilter}
                  onChange={e => setUserFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-border bg-background/50 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                >
                  <option value="all">{t("activity.allMembers")}</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.role === "doctor" ? `Dr. ${m.name}` : m.name}
                    </option>
                  ))}
                </select>
              </div>
              {activeTab === "actions" && (
                <select
                  value={actionFilter}
                  onChange={e => setActionFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-border bg-background/50 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                >
                  {ACTION_TYPE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground hidden sm:block">
                {dataUpdatedAt
                  ? `${t("activity.lastUpdate")} ${formatDistanceToNow(dataUpdatedAt, { addSuffix: true, locale: dateLocale })}`
                  : ""}
              </span>
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-all disabled:opacity-60"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />
                {t("activity.refresh")}
              </button>

              {/* Delete history */}
              <div className="relative">
                <button
                  onClick={() => setShowDeleteMenu(v => !v)}
                  disabled={deleting}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-100 dark:hover:bg-red-950/40 transition-all disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {lang === "de" ? "Löschen" : "Supprimer"}
                  <span className="text-[10px] opacity-60">
                    ({activeTab === "navigation" ? "Nav." : "Act."})
                  </span>
                  <ChevronDown className={cn("w-3 h-3 transition-transform", showDeleteMenu && "rotate-180")} />
                </button>
                {showDeleteMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowDeleteMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 z-20 bg-card border border-border rounded-xl shadow-lg overflow-hidden w-56">
                      <div className="px-3 pt-2.5 pb-1">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                          {lang === "de" ? "Einträge löschen älter als:" : "Supprimer les entrées de plus de :"}
                        </p>
                        <p className="text-[10px] text-red-500 font-semibold mt-0.5">
                          {activeTab === "navigation"
                            ? (lang === "de" ? "⚠ Nur Navigation-Einträge" : "⚠ Onglet Navigation uniquement")
                            : (lang === "de" ? "⚠ Nur Aktivitäts-Einträge" : "⚠ Onglet Activités uniquement")}
                        </p>
                      </div>
                      {DELETE_OPTIONS.map(opt => (
                        <button
                          key={opt.hours}
                          onClick={() => handleDelete(opt.hours)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5 flex-shrink-0" />
                          {opt.label}
                        </button>
                      ))}

                      {/* Custom hours input */}
                      <div className="border-t border-border/60 px-3 py-2.5">
                        <p className="text-[10px] text-muted-foreground mb-1.5 font-semibold uppercase tracking-wider">
                          {lang === "de" ? "Benutzerdefiniert (Stunden):" : "Personnalisé (heures) :"}
                        </p>
                        <div className="flex gap-1.5">
                          <input
                            type="number"
                            min="1"
                            max="8760"
                            value={customHours}
                            onChange={e => setCustomHours(e.target.value)}
                            onClick={e => e.stopPropagation()}
                            placeholder={lang === "de" ? "z.B. 3" : "ex: 3"}
                            className="flex-1 px-2 py-1.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-red-400/50 focus:border-red-400 transition-all"
                          />
                          <button
                            onClick={() => {
                              const h = parseInt(customHours, 10);
                              if (!h || h < 1) return;
                              handleDelete(h);
                              setCustomHours("");
                            }}
                            disabled={!customHours || parseInt(customHours) < 1}
                            className="px-2.5 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {lang === "de" ? "OK" : "OK"}
                          </button>
                        </div>
                        <p className="text-[9px] text-muted-foreground/60 mt-1">
                          {lang === "de" ? "1–8760 Stunden (1 Jahr max.)" : "1 à 8760 h (1 an max.)"}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Logs list ── */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="divide-y divide-border">
              {Array(8).fill(null).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-4 animate-pulse">
                  <div className="w-9 h-9 rounded-xl bg-muted flex-shrink-0" />
                  <div className="w-9 h-9 rounded-xl bg-muted flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-muted rounded w-2/3" />
                    <div className="h-2 bg-muted rounded w-1/3" />
                  </div>
                  <div className="h-2 bg-muted rounded w-20" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Activity className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-semibold text-foreground">{t("activity.noActivity")}</p>
              <p className="text-sm text-muted-foreground mt-1">{t("activity.noActivityDesc")}</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(log => {
                const meta = getActionMeta(log.action);
                const Icon = meta.icon;
                const avatarColor = getUserColor(log.user_id);

                return (
                  <button
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors text-left group"
                  >
                    {/* User avatar */}
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs text-white flex-shrink-0"
                      style={{ background: avatarColor }}
                    >
                      {initials(log.user_name || "?")}
                    </div>

                    {/* Action icon */}
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", "bg-current/10", meta.color)}>
                      <Icon className={cn("w-3.5 h-3.5", meta.color)} />
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">
                        <span className="font-semibold">
                          {log.user_role === "doctor" ? `Dr. ${log.user_name}` : log.user_name}
                        </span>
                        {" · "}
                        <span className={cn("font-medium", meta.color)}>{getActionLabel(log.action)}</span>
                        {log.entity_label && translateEntityLabel(log.entity_label) !== getActionLabel(log.action) && (
                          <span className="text-muted-foreground"> · {translateEntityLabel(log.entity_label)}</span>
                        )}
                      </p>
                      {activeTab === "navigation" && log.action === "view_patient" && log.entity_label && (
                        <p className="text-xs text-violet-600 mt-0.5 flex items-center gap-1 font-medium">
                          <UserPlus className="w-3 h-3 flex-shrink-0" />
                          {log.entity_label}
                          {(log.details as any)?.from && (
                            <span className="text-muted-foreground font-normal ml-1">
                              — {lang === "de" ? "von" : "depuis"} {String((log.details as any).from)}
                            </span>
                          )}
                        </p>
                      )}
                      {activeTab === "navigation" && log.action !== "view_patient" && log.details && (log.details as any).from && (
                        <p className="text-xs text-indigo-500 mt-0.5 flex items-center gap-1">
                          <span className="font-medium">{String((log.details as any).from)}</span>
                          <ArrowRight className="w-3 h-3 flex-shrink-0" />
                          <span className="font-semibold">{String((log.details as any).to ?? "")}</span>
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                        {roleBadge(log.user_role)}
                        {" · "}
                        {format(
                          new Date(log.created_at),
                          lang === "de" ? "d MMM yyyy 'um' HH:mm" : "d MMM yyyy 'à' HH:mm",
                          { locale: dateLocale }
                        )}
                        {(() => {
                          const deviceVal = (log.details as Record<string, unknown> | null)?.device;
                          if (!deviceVal) return null;
                          const deviceStr = String(deviceVal);
                          return (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-muted text-[10px] font-medium ml-1">
                              {deviceStr === "mobile" ? <Smartphone className="w-3 h-3" /> : <Monitor className="w-3 h-3" />}
                              {deviceStr}
                            </span>
                          );
                        })()}
                      </p>
                    </div>

                    {/* Right side */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[11px] text-muted-foreground hidden sm:block">
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: dateLocale })}
                      </span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {!isLoading && filtered.length > 0 && (
          <p className="text-xs text-center text-muted-foreground">
            {t("activity.entries", { count: filtered.length }).replace("{s}", filtered.length > 1 ? "s" : "")}
            {" · "}
            {t("activity.autoRefresh")}
          </p>
        )}
      </div>

      {/* ── Detail Drawer ── */}
      {selectedLog && (
        <DetailDrawer
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
          lang={lang}
          dateLocale={dateLocale}
          getActionLabel={getActionLabel}
          getActionMeta={getActionMeta}
          roleBadge={roleBadge}
          translateEntityLabel={translateEntityLabel}
        />
      )}
    </div>
  );
}
