"use client";
import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { LogIn, LogOut, Plus, Edit, Trash2, UserPlus, Activity, ArrowLeft, Clock } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import Header from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import api from "@/services/api";
import { useLang } from "@/lib/i18n";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string | null;
  specialty: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
}

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

const AVATAR_COLORS = [
  "oklch(0.55 0.18 240)", "oklch(0.52 0.20 165)", "oklch(0.55 0.18 300)",
  "oklch(0.55 0.18 30)", "oklch(0.52 0.18 200)", "oklch(0.55 0.20 120)",
];

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

function displayName(m: TeamMember) {
  return m.role === "doctor" ? `Dr. ${m.name}` : m.name;
}

function roleBadge(role: string, tFn: (key: string) => string) {
  if (role === "doctor") return { label: tFn("team.roles.doctor"), cls: "bg-primary/10 text-primary border border-primary/20" };
  if (role === "assistant") return { label: tFn("team.roles.assistant"), cls: "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800" };
  if (role === "admin") return { label: tFn("team.roles.admin"), cls: "bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800" };
  return { label: role, cls: "bg-muted text-muted-foreground border border-border" };
}

function getActionMeta(action: string): { icon: React.ElementType; color: string; label: string } {
  if (action === "login")           return { icon: LogIn,    color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40",  label: "Connexion" };
  if (action === "logout")          return { icon: LogOut,   color: "text-slate-500 bg-muted",                               label: "Déconnexion" };
  if (action === "create_user")     return { icon: UserPlus, color: "text-purple-500 bg-purple-50 dark:bg-purple-950/40",    label: "Création utilisateur" };
  if (action.startsWith("create_")) return { icon: Plus,     color: "text-blue-500 bg-blue-50 dark:bg-blue-950/40",          label: "Création" };
  if (action.startsWith("update_")) return { icon: Edit,     color: "text-amber-500 bg-amber-50 dark:bg-amber-950/40",       label: "Modification" };
  if (action.startsWith("delete_") || action.startsWith("deactivate_")) return { icon: Trash2, color: "text-red-500 bg-red-50 dark:bg-red-950/40", label: "Suppression" };
  return { icon: Activity, color: "text-muted-foreground bg-muted", label: action };
}

function actionLabel(log: ActivityLog): string {
  const labels: Record<string, string> = {
    login: "s'est connecté",
    logout: "s'est déconnecté",
    create_user: "a créé un utilisateur",
    create_patient: "a créé un patient",
    update_patient: "a modifié un patient",
    delete_patient: "a supprimé un patient",
    create_appointment: "a créé un rendez-vous",
    update_appointment: "a modifié un rendez-vous",
    delete_appointment: "a annulé un rendez-vous",
    update_user: "a modifié un profil",
    deactivate_user: "a désactivé un utilisateur",
  };
  return labels[log.action] ?? log.action.replace(/_/g, " ");
}

export default function UserActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { t } = useLang();
  const { id } = use(params);

  const { data: member, isLoading: memberLoading } = useQuery<TeamMember>({
    queryKey: ["team-member", id],
    queryFn: async () => { const r = await api.get(`/users/${id}`); return r.data; },
    staleTime: 60_000,
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery<ActivityLog[]>({
    queryKey: ["user-activity", id],
    queryFn: async () => { const r = await api.get(`/users/${id}/activity`); return r.data; },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const loginCount = logs.filter(l => l.action === "login").length;
  const totalActions = logs.length;
  const lastSeen = logs[0]?.created_at ?? member?.lastLoginAt;

  const badge = member ? roleBadge(member.role, t) : null;

  return (
    <div className="flex flex-col h-full">
      <Header
        title={member ? displayName(member) : "Profil"}
        subtitle={t("teamMember.subtitle")}
      />

      <div className="flex-1 overflow-auto custom-scroll p-6 space-y-5 max-w-3xl mx-auto w-full">

        <Link href="/team" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> {t("teamMember.backToTeam")}
        </Link>

        {memberLoading ? (
          <div className="bg-card border border-border rounded-xl p-5 animate-pulse h-24" />
        ) : member ? (
          <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl text-white shadow-md flex-shrink-0"
              style={{ background: AVATAR_COLORS[0] }}>
              {initials(member.name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-foreground">{displayName(member)}</h2>
                {badge && (
                  <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", badge.cls)}>
                    {badge.label}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{member.email}</p>
              {member.specialty && <p className="text-xs text-muted-foreground">{member.specialty}</p>}
            </div>
            <div className={cn("w-2 h-2 rounded-full flex-shrink-0", member.isActive ? "bg-emerald-500" : "bg-muted-foreground")} />
          </div>
        ) : null}

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: t("teamMember.stats.totalActions"), value: totalActions, icon: Activity, color: "gradient-primary" },
            { label: t("teamMember.stats.connections"), value: loginCount, icon: LogIn, color: "gradient-success" },
            { label: t("teamMember.stats.lastActivity"), value: lastSeen ? formatDistanceToNow(new Date(lastSeen), { addSuffix: true, locale: fr }) : "—", icon: Clock, color: "gradient-warning", small: true },
          ].map(({ label, value, icon: Icon, color, small }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", color)}>
                <Icon className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={cn("font-bold text-foreground", small ? "text-xs mt-0.5" : "text-xl")}>{logsLoading ? "—" : value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">{t("teamMember.actionHistory")}</h3>

          {logsLoading ? (
            <div className="space-y-3">
              {Array(5).fill(null).map((_, i) => (
                <div key={i} className="flex items-start gap-3 animate-pulse">
                  <div className="w-8 h-8 rounded-xl bg-muted flex-shrink-0" />
                  <div className="flex-1 space-y-1.5 pt-1">
                    <div className="h-3 bg-muted rounded w-3/4" />
                    <div className="h-2 bg-muted rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="py-10 text-center">
              <Activity className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{t("teamMember.noActivity")}</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
              <div className="space-y-0">
                {logs.map((log, i) => {
                  const meta = getActionMeta(log.action);
                  const Icon = meta.icon;
                  const isLast = i === logs.length - 1;
                  return (
                    <div key={log.id} className={cn("flex items-start gap-3 relative pl-1", !isLast && "pb-4")}>
                      <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 z-10", meta.color)}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0 pt-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-sm font-medium text-foreground">{actionLabel(log)}</p>
                          <span className="text-[11px] text-muted-foreground flex-shrink-0">
                            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: fr })}
                          </span>
                        </div>
                        {log.entity_label && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {log.entity_label}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
