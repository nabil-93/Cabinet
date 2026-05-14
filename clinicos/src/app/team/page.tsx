"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserCog, Plus, Users, Stethoscope, X, Mail, Phone, Clock, Edit, ChevronRight, ToggleLeft, ToggleRight, Shield, Trash2, KeyRound } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { fr, de } from "date-fns/locale";
import Header from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
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
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  avatarUrl?: string | null;
}

interface MemberForm {
  name: string;
  email: string;
  password: string;
  role: string;
  phone: string;
  specialty: string;
}

const EMPTY_FORM: MemberForm = { name: "", email: "", password: "", role: "doctor", phone: "", specialty: "" };

const AVATAR_COLORS = [
  "oklch(0.55 0.18 240)", "oklch(0.52 0.20 165)", "oklch(0.55 0.18 300)",
  "oklch(0.55 0.18 30)", "oklch(0.52 0.18 200)", "oklch(0.55 0.20 120)",
  "oklch(0.52 0.19 270)", "oklch(0.55 0.18 60)",
];

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

function displayName(m: TeamMember) {
  return (m.role === "doctor" || m.role === "admin") ? `Dr. ${m.name}` : m.name;
}

export default function TeamPage() {
  const { t, lang } = useLang();
  const dateLocale = lang === "de" ? de : fr;
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [deletingMember, setDeletingMember] = useState<TeamMember | null>(null);
  const [resetMember, setResetMember] = useState<TeamMember | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [form, setForm] = useState<MemberForm>(EMPTY_FORM);

  const { data: members = [], isLoading } = useQuery<TeamMember[]>({
    queryKey: ["team"],
    queryFn: async () => { const r = await api.get("/users"); return r.data; },
    staleTime: 0,
    refetchInterval: 10_000,
  });

  function roleBadge(role: string) {
    if (role === "doctor")    return { label: t("team.roles.doctor"),    cls: "bg-primary/10 text-primary border border-primary/20" };
    if (role === "assistant") return { label: t("team.roles.assistant"), cls: "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800" };
    if (role === "admin")     return { label: t("team.roles.admin"),     cls: "bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800" };
    return { label: role, cls: "bg-muted text-muted-foreground border border-border" };
  }

  const createMutation = useMutation({
    mutationFn: (data: Omit<MemberForm, "password"> & { password: string }) =>
      api.post("/users", data).then(r => r.data),
    onSuccess: (newMember) => {
      qc.setQueryData<TeamMember[]>(["team"], old => [newMember, ...(old ?? [])]);
      toast.success(t("team.memberAdded"));
      setShowModal(false);
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || t("common.error")),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<MemberForm> }) =>
      api.patch(`/users/${id}`, data).then(r => r.data),
    onSuccess: (updated) => {
      qc.setQueryData<TeamMember[]>(["team"], old =>
        (old ?? []).map(m => m.id === updated.id ? { ...m, ...updated } : m)
      );
      toast.success(t("team.profileUpdated"));
      setShowModal(false);
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || t("common.error")),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/users/${id}`, { isActive }).then(r => r.data),
    onMutate: async ({ id, isActive }) => {
      await qc.cancelQueries({ queryKey: ["team"] });
      const prev = qc.getQueryData<TeamMember[]>(["team"]);
      qc.setQueryData<TeamMember[]>(["team"], old =>
        (old ?? []).map(m => m.id === id ? { ...m, isActive } : m)
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["team"], ctx.prev);
      toast.error(t("common.error"));
    },
    onSuccess: (_, { isActive }) => toast.success(isActive ? t("team.activated") : t("team.deactivated")),
  });

  const openAdd = () => {
    setEditingMember(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (m: TeamMember) => {
    setEditingMember(m);
    setForm({ name: m.name, email: m.email, password: "", role: m.role, phone: m.phone ?? "", specialty: m.specialty ?? "" });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingMember) {
      const data: Partial<MemberForm> = { name: form.name, role: form.role, phone: form.phone, specialty: form.specialty };
      await updateMutation.mutateAsync({ id: editingMember.id, data });
    } else {
      await createMutation.mutateAsync(form);
    }
  };

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      api.patch(`/users/${id}`, { newPassword: password }),
    onSuccess: () => {
      toast.success(t("team.resetSuccess"));
      setResetMember(null);
      setNewPassword("");
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || t("common.error")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: (_, id) => {
      qc.setQueryData<TeamMember[]>(["team"], old => (old ?? []).filter(m => m.id !== id));
      toast.success(t("team.memberDeleted"));
      setDeletingMember(null);
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || t("common.error")),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const doctors = members.filter(m => m.role === "doctor" || m.role === "admin");
  const assistants = members.filter(m => m.role === "assistant");

  return (
    <div className="flex flex-col h-full">
      <Header title={t("team.title")} subtitle={t("team.subtitle")} />

      <div className="flex-1 overflow-auto custom-scroll p-6 space-y-5">

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: t("team.stats.total"),       value: members.length,    icon: Users,     color: "gradient-primary" },
            { label: t("team.stats.doctors"),      value: doctors.length,    icon: Stethoscope, color: "gradient-success" },
            { label: t("team.stats.secretaries"),  value: assistants.length, icon: UserCog,   color: "gradient-warning" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", color)}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-xl font-bold text-foreground">{isLoading ? "—" : value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <button onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-primary text-white text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm">
            <Plus className="w-4 h-4" /> {t("team.addMemberBtn")}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {isLoading
            ? Array(6).fill(null).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-5 animate-pulse h-52" />
            ))
            : members.map((member, i) => {
              const badge = roleBadge(member.role);
              return (
                <div key={member.id} className={cn(
                  "bg-card border border-border rounded-xl p-5 hover:shadow-md transition-all group",
                  !member.isActive && "opacity-60"
                )}>
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-11 h-11 rounded-2xl overflow-hidden flex-shrink-0 shadow-md">
                      {member.avatarUrl ? (
                        <img src={member.avatarUrl} alt={member.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold text-sm text-white"
                          style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>
                          {initials(member.name)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-sm text-foreground truncate">{displayName(member)}</h3>
                        <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0", badge.cls)}>
                          {badge.label}
                        </span>
                      </div>
                      {member.specialty && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{member.specialty}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5 mb-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{member.email}</span>
                    </div>
                    {member.phone && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{member.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>
                        {member.lastLoginAt
                          ? `${t("team.seenAt", { date: format(new Date(member.lastLoginAt), "d MMM yyyy 'à' HH:mm", { locale: dateLocale }) })}`
                          : t("team.neverConnected")}
                      </span>
                    </div>
                  </div>

                  {member.mustChangePassword && (
                    <div className="flex items-center gap-1.5 mb-3 px-2 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60">
                      <Shield className="w-3 h-3 text-amber-600 flex-shrink-0" />
                      <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">{t("team.mustChangePassword")}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-border/40">
                    <button
                      onClick={() => toggleActiveMutation.mutate({ id: member.id, isActive: !member.isActive })}
                      className={cn("flex items-center gap-1.5 text-xs font-medium transition-colors",
                        member.isActive ? "text-emerald-600 hover:text-emerald-700" : "text-muted-foreground hover:text-foreground"
                      )}
                      title={member.isActive ? t("team.deactivate") : t("team.activate")}
                    >
                      {member.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      {member.isActive ? t("team.active") : t("team.inactive")}
                    </button>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(member)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all"
                        title={t("common.edit")}>
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => { setResetMember(member); setNewPassword(""); }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950 transition-all"
                        title={t("team.resetPassword")}>
                        <KeyRound className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeletingMember(member)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950 transition-all"
                        title={t("common.delete")}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <Link href={`/team/${member.id}`}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all" title={t("team.viewActivity")}>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </div>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })
          }

          {!isLoading && members.length === 0 && (
            <div className="col-span-full py-16 text-center bg-card border border-border rounded-xl">
              <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-semibold text-foreground">{t("team.noMembers")}</p>
              <p className="text-sm text-muted-foreground mt-1 mb-4">{t("team.addFirst")}</p>
              <button onClick={openAdd} className="px-4 py-2 rounded-xl gradient-primary text-white text-sm font-semibold hover:opacity-90 transition-all">
                + {t("team.addMemberBtn")}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Reset password modal */}
      {resetMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setResetMember(null)} />
          <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950 flex items-center justify-center flex-shrink-0">
                <KeyRound className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">{t("team.resetPassword")}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {resetMember.role === "doctor" || resetMember.role === "admin" ? `Dr. ${resetMember.name}` : resetMember.name}
                </p>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">{t("team.newPassword")}</label>
              <input autoFocus type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                placeholder={t("team.passwordHint")} minLength={8}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
              <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
                <Shield className="w-3 h-3" /> {t("team.passwordChangeNote")}
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setResetMember(null)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-accent transition-all">
                {t("common.cancel")}
              </button>
              <button
                onClick={() => newPassword.length >= 8 && resetPasswordMutation.mutate({ id: resetMember.id, password: newPassword })}
                disabled={newPassword.length < 8 || resetPasswordMutation.isPending}
                className="flex-1 py-2.5 rounded-xl gradient-primary text-white text-sm font-semibold transition-all disabled:opacity-50">
                {resetPasswordMutation.isPending ? t("team.saving") : t("team.confirmReset")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {deletingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDeletingMember(null)} />
          <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">{t("team.deleteConfirm")}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {deletingMember.role === "doctor" || deletingMember.role === "admin" ? `Dr. ${deletingMember.name}` : deletingMember.name} {t("team.willBeDeleted")}
                </p>
              </div>
            </div>
            <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2">
              {t("team.deleteWarning")}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingMember(null)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-accent transition-all">
                {t("common.cancel")}
              </button>
              <button onClick={() => deleteMutation.mutate(deletingMember.id)} disabled={deleteMutation.isPending}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-all disabled:opacity-50">
                {deleteMutation.isPending ? t("common.deleting") : t("common.delete")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-xl p-6 max-h-[90vh] overflow-y-auto custom-scroll">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-foreground">
                {editingMember ? t("team.editMember") : t("team.newMember")}
              </h2>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-foreground mb-1.5">{t("team.fields.fullName")}</label>
                  <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Prénom Nom"
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                </div>

                {!editingMember && (
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-foreground mb-1.5">{t("team.fields.email")}</label>
                    <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="email@clinique.ma"
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                  </div>
                )}

                {!editingMember && (
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-foreground mb-1.5">{t("team.fields.password")}</label>
                    <input required type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      placeholder={t("team.passwordHint")} minLength={8}
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">{t("team.fields.role")}</label>
                  <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
                    <option value="doctor">{t("team.roles.doctor")}</option>
                    <option value="admin">{t("team.roles.doctorAdmin")}</option>
                    <option value="assistant">{t("team.roles.assistant")}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">{t("team.fields.phone")}</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+212 6XX..."
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                </div>

                {(form.role === "doctor" || form.role === "admin") && (
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-foreground mb-1.5">{t("team.fields.specialty")}</label>
                    <input value={form.specialty} onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))}
                      placeholder={t("team.fields.specialtyPlaceholder")}
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                  </div>
                )}
              </div>

              {!editingMember && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20">
                  <Shield className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">{t("team.passwordNote")}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-all">
                  {t("common.cancel")}
                </button>
                <button type="submit" disabled={isPending}
                  className="flex-1 py-2.5 rounded-xl gradient-primary text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                  {isPending
                    ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : editingMember ? t("common.save") : t("common.add")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
