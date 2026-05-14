"use client";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity, LogIn, LogOut, Edit, Trash2, UserPlus, Filter, RefreshCw,
  CalendarPlus, RotateCcw, FileText, CreditCard, ArrowRight, CheckCircle,
  X, ClipboardList, Pill, UserCog,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { fr, de } from "date-fns/locale";
import Header from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import api from "@/services/api";
import { useLang } from "@/lib/i18n";

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

const AVATAR_COLORS = [
  "oklch(0.55 0.18 240)", "oklch(0.52 0.20 165)", "oklch(0.55 0.18 300)",
  "oklch(0.55 0.18 30)", "oklch(0.52 0.18 200)", "oklch(0.55 0.20 120)",
  "oklch(0.52 0.19 270)", "oklch(0.55 0.18 60)",
];

const ACTION_ICON_MAP: Record<string, { color: string; icon: LucideIcon }> = {
  login:                     { color: "text-emerald-500", icon: LogIn },
  logout:                    { color: "text-red-500",     icon: LogOut },
  create_patient:            { color: "text-blue-500",    icon: UserPlus },
  update_patient:            { color: "text-amber-500",   icon: Edit },
  delete_patient:            { color: "text-red-500",     icon: Trash2 },
  create_appointment:        { color: "text-blue-500",    icon: CalendarPlus },
  update_appointment_status: { color: "text-amber-500",   icon: RefreshCw },
  reschedule_appointment:    { color: "text-amber-500",   icon: RotateCcw },
  delete_appointment:        { color: "text-red-500",     icon: Trash2 },
  create_invoice:            { color: "text-blue-500",    icon: FileText },
  update_invoice:            { color: "text-amber-500",   icon: Edit },
  pay_invoice:               { color: "text-emerald-500", icon: CreditCard },
  add_to_waiting_room:       { color: "text-blue-500",    icon: UserPlus },
  call_patient:              { color: "text-emerald-500", icon: ArrowRight },
  finish_consultation:       { color: "text-emerald-500", icon: CheckCircle },
  remove_from_waiting_room:  { color: "text-red-400",     icon: X },
  create_consultation:       { color: "text-blue-500",    icon: ClipboardList },
  create_prescription:       { color: "text-blue-500",    icon: Pill },
  update_prescription:       { color: "text-amber-500",   icon: Edit },
  delete_prescription:       { color: "text-red-500",     icon: Trash2 },
  create_user:               { color: "text-purple-500",  icon: UserCog },
  update_user:               { color: "text-amber-500",   icon: Edit },
  delete_user:               { color: "text-red-500",     icon: Trash2 },
  activate_user:             { color: "text-emerald-500", icon: UserCog },
  deactivate_user:           { color: "text-gray-500",    icon: UserCog },
  reset_password:            { color: "text-amber-600",   icon: UserCog },
  delete_invoice:            { color: "text-red-500",     icon: Trash2 },
};

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

function getUserColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function ActivityPage() {
  const { lang, t } = useLang();
  const dateLocale = lang === "de" ? de : fr;
  const [userFilter,   setUserFilter]   = useState("all");
  const [actionFilter, setActionFilter] = useState("all");

  const { data: logs = [], isLoading, dataUpdatedAt, refetch, isFetching } = useQuery<ActivityLog[]>({
    queryKey: ["activity-feed"],
    queryFn: async () => { const r = await api.get("/activity"); return r.data; },
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
  ];

  // Translate entity_labels stored in DB (French strings)
  const ENTITY_LABEL_MAP: Record<string, string> = {
    "Connexion":     t("activity.entityLabels.login"),
    "Déconnexion":   t("activity.entityLabels.logout"),
    "Session":       t("activity.entityLabels.session"),
  };
  function translateEntityLabel(label: string): string {
    return ENTITY_LABEL_MAP[label] ?? label;
  }

  function getActionLabel(action: string): string {
    const key = `activity.actions.${action}` as const;
    const label = t(key);
    if (label !== key) return label;
    // Fallback for unknown actions
    if (action.startsWith("create_")) return t("activity.filters.creates");
    if (action.startsWith("update_")) return t("activity.filters.updates");
    if (action.startsWith("delete_")) return t("activity.filters.deletes");
    return action.replace(/_/g, " ");
  }

  function getActionMeta(action: string): { color: string; icon: LucideIcon } {
    if (ACTION_ICON_MAP[action]) return ACTION_ICON_MAP[action];
    if (action.startsWith("create_")) return { color: "text-blue-500",    icon: UserPlus };
    if (action.startsWith("update_")) return { color: "text-amber-500",   icon: Edit };
    if (action.startsWith("delete_")) return { color: "text-red-500",     icon: Trash2 };
    return { color: "text-muted-foreground", icon: Activity };
  }

  function roleBadge(role: string) {
    if (role === "doctor")    return t("activity.roleMedecin");
    if (role === "assistant") return t("activity.roleSecretaire");
    if (role === "admin")     return t("activity.roleAdmin");
    return role;
  }

  const filtered = useMemo(() => {
    return logs.filter(log => {
      const matchUser = userFilter === "all" || log.user_id === userFilter;
      const matchAction = actionFilter === "all"
        || (actionFilter === "login"      && log.action === "login")
        || (actionFilter === "logout"     && log.action === "logout")
        || (actionFilter === "create"     && log.action.startsWith("create_"))
        || (actionFilter === "update"     && log.action.startsWith("update_"))
        || (actionFilter === "delete"     && log.action.startsWith("delete_"))
        || (actionFilter === "reset"      && log.action === "reset_password")
        || (actionFilter === "activate"   && log.action === "activate_user")
        || (actionFilter === "deactivate" && log.action === "deactivate_user");
      return matchUser && matchAction;
    });
  }, [logs, userFilter, actionFilter]);

  return (
    <div className="flex flex-col h-full">
      <Header title={t("activity.journalTitle")} subtitle={t("activity.journalSubtitle")} />

      <div className="flex-1 overflow-auto custom-scroll p-6 space-y-5">

        <div className="bg-card border border-border rounded-xl p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <select value={userFilter} onChange={e => setUserFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-border bg-background/50 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
                <option value="all">{t("activity.allMembers")}</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.role === "doctor" ? `Dr. ${m.name}` : m.name}
                  </option>
                ))}
              </select>
            </div>
            <select value={actionFilter} onChange={e => setActionFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-border bg-background/50 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
              {ACTION_TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {dataUpdatedAt ? `${t("activity.lastUpdate")} ${formatDistanceToNow(dataUpdatedAt, { addSuffix: true, locale: dateLocale })}` : ""}
            </span>
            <button onClick={() => refetch()} disabled={isFetching}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-all disabled:opacity-60">
              <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />
              {t("activity.refresh")}
            </button>
          </div>
        </div>

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
                  <div key={log.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs text-white flex-shrink-0"
                      style={{ background: avatarColor }}>
                      {initials(log.user_name || "?")}
                    </div>

                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", meta.color, "bg-current/10")}>
                      <Icon className={cn("w-3.5 h-3.5", meta.color)} />
                    </div>

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
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {roleBadge(log.user_role)}
                        {" · "}
                        {format(new Date(log.created_at), lang === "de" ? "d MMM yyyy 'um' HH:mm" : "d MMM yyyy 'à' HH:mm", { locale: dateLocale })}
                      </p>
                    </div>

                    <span className="text-[11px] text-muted-foreground flex-shrink-0 hidden sm:block">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: dateLocale })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {!isLoading && filtered.length > 0 && (
          <p className="text-xs text-center text-muted-foreground">
            {t("activity.entries", { count: filtered.length }).replace("{s}", filtered.length > 1 ? "s" : "")} · {t("activity.autoRefresh")}
          </p>
        )}
      </div>
    </div>
  );
}
