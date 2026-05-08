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
import { fr } from "date-fns/locale";
import Header from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import api from "@/services/api";

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

const ACTION_MAP: Record<string, { label: string; color: string; icon: LucideIcon }> = {
  login:                     { label: "Connexion",                  color: "text-emerald-500", icon: LogIn },
  logout:                    { label: "Déconnexion",                color: "text-gray-400",    icon: LogOut },
  create_patient:            { label: "Patient ajouté",             color: "text-blue-500",    icon: UserPlus },
  update_patient:            { label: "Patient modifié",            color: "text-amber-500",   icon: Edit },
  delete_patient:            { label: "Patient supprimé",           color: "text-red-500",     icon: Trash2 },
  create_appointment:        { label: "RDV créé",                   color: "text-blue-500",    icon: CalendarPlus },
  update_appointment_status: { label: "Statut RDV modifié",         color: "text-amber-500",   icon: RefreshCw },
  reschedule_appointment:    { label: "RDV reporté",                color: "text-amber-500",   icon: RotateCcw },
  delete_appointment:        { label: "RDV supprimé",               color: "text-red-500",     icon: Trash2 },
  create_invoice:            { label: "Facture créée",              color: "text-blue-500",    icon: FileText },
  update_invoice:            { label: "Facture modifiée",           color: "text-amber-500",   icon: Edit },
  pay_invoice:               { label: "Paiement enregistré",        color: "text-emerald-500", icon: CreditCard },
  add_to_waiting_room:       { label: "Ajouté en salle d'attente",  color: "text-blue-500",    icon: UserPlus },
  call_patient:              { label: "Patient appelé",             color: "text-emerald-500", icon: ArrowRight },
  finish_consultation:       { label: "Consultation terminée",      color: "text-emerald-500", icon: CheckCircle },
  remove_from_waiting_room:  { label: "Retiré de la file",          color: "text-red-400",     icon: X },
  create_consultation:       { label: "Rapport créé",               color: "text-blue-500",    icon: ClipboardList },
  create_prescription:       { label: "Ordonnance créée",           color: "text-blue-500",    icon: Pill },
  update_prescription:       { label: "Ordonnance modifiée",        color: "text-amber-500",   icon: Edit },
  delete_prescription:       { label: "Ordonnance supprimée",       color: "text-red-500",     icon: Trash2 },
  create_user:               { label: "Compte créé",                color: "text-purple-500",  icon: UserCog },
  update_user:               { label: "Compte modifié",             color: "text-amber-500",   icon: Edit },
  delete_user:               { label: "Compte supprimé",            color: "text-red-500",     icon: Trash2 },
  activate_user:             { label: "Compte activé",              color: "text-emerald-500", icon: UserCog },
  deactivate_user:           { label: "Compte désactivé",           color: "text-gray-500",    icon: UserCog },
  reset_password:            { label: "Mot de passe réinitialisé",  color: "text-amber-600",   icon: UserCog },
  delete_invoice:            { label: "Facture supprimée",          color: "text-red-500",     icon: Trash2 },
};

function getActionMeta(action: string): { label: string; color: string; icon: LucideIcon } {
  if (ACTION_MAP[action]) return ACTION_MAP[action];
  if (action.startsWith("create_")) return { label: action.replace(/_/g, " "), color: "text-blue-500",    icon: UserPlus };
  if (action.startsWith("update_")) return { label: action.replace(/_/g, " "), color: "text-amber-500",   icon: Edit };
  if (action.startsWith("delete_")) return { label: action.replace(/_/g, " "), color: "text-red-500",     icon: Trash2 };
  return { label: action.replace(/_/g, " "), color: "text-muted-foreground", icon: Activity };
}

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

function getUserColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function roleBadge(role: string) {
  if (role === "doctor")    return "Médecin";
  if (role === "assistant") return "Secrétaire";
  if (role === "admin")     return "Admin";
  return role;
}

const ACTION_TYPE_OPTIONS = [
  { value: "all",        label: "Toutes les actions" },
  { value: "login",      label: "Connexions" },
  { value: "logout",     label: "Déconnexions" },
  { value: "create",     label: "Créations" },
  { value: "update",     label: "Modifications" },
  { value: "delete",     label: "Suppressions" },
  { value: "reset",      label: "Réinitialisations" },
  { value: "activate",   label: "Activations" },
  { value: "deactivate", label: "Désactivations" },
];

export default function ActivityPage() {
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
      <Header title="Journal d'activité" subtitle="Toutes les actions de l'équipe" />

      <div className="flex-1 overflow-auto custom-scroll p-6 space-y-5">

        <div className="bg-card border border-border rounded-xl p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <select
                value={userFilter}
                onChange={e => setUserFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-border bg-background/50 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              >
                <option value="all">Tous les membres</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.role === "doctor" ? `Dr. ${m.name}` : m.name}
                  </option>
                ))}
              </select>
            </div>
            <select
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-border bg-background/50 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            >
              {ACTION_TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {dataUpdatedAt ? `Mis à jour ${formatDistanceToNow(dataUpdatedAt, { addSuffix: true, locale: fr })}` : ""}
            </span>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-all disabled:opacity-60"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />
              Actualiser
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
              <p className="font-semibold text-foreground">Aucune activité</p>
              <p className="text-sm text-muted-foreground mt-1">Aucune action ne correspond aux filtres sélectionnés.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(log => {
                const meta = getActionMeta(log.action);
                const Icon = meta.icon;
                const avatarColor = getUserColor(log.user_id);

                return (
                  <div key={log.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs text-white flex-shrink-0"
                      style={{ background: avatarColor }}
                    >
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
                        <span className={cn("font-medium", meta.color)}>{meta.label}</span>
                        {log.entity_label && (
                          <span className="text-muted-foreground"> · {log.entity_label}</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {roleBadge(log.user_role)}
                        {" · "}
                        {format(new Date(log.created_at), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                      </p>
                    </div>

                    <span className="text-[11px] text-muted-foreground flex-shrink-0 hidden sm:block">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: fr })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {!isLoading && filtered.length > 0 && (
          <p className="text-xs text-center text-muted-foreground">
            {filtered.length} entrée{filtered.length > 1 ? "s" : ""} · Rafraîchissement auto toutes les 60s
          </p>
        )}
      </div>
    </div>
  );
}
