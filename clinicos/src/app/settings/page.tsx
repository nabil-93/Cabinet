"use client";
import { useState, useRef } from "react";
import { Settings, User, Bell, Shield, Palette, Building2, Save, Upload, Loader2 } from "lucide-react";
import Header from "@/components/layout/Header";
import { useAuth } from "@/lib/auth-context";
import { useStore } from "@/store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import api from "@/services/api";
import { useLang } from "@/lib/i18n";

export default function SettingsPage() {
  const { user, setUser } = useAuth();
  const { theme, setTheme } = useStore();
  const { t, lang, setLang } = useLang();
  const [activeTab, setActiveTab] = useState("profile");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const TABS = [
    { id: "profile",       label: t("settings.tabs.profile"),       icon: User },
    { id: "clinic",        label: t("settings.tabs.cabinet"),        icon: Building2 },
    { id: "notifications", label: t("settings.tabs.notifications"),  icon: Bell },
    { id: "appearance",    label: t("settings.tabs.appearance"),     icon: Palette },
    { id: "security",      label: t("settings.tabs.security"),       icon: Shield },
  ];

  const userRoleLabel = user?.role === "admin"
    ? t("common.admin_role")
    : user?.role === "doctor"
    ? t("common.medecin")
    : t("common.secretaire");

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error(t("settings.photoTooBig"));
      return;
    }

    try {
      setUploading(true);
      const supabase = createClient();
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(filePath);

      await api.patch(`/users/${user.id}`, { avatarUrl: publicUrl });
      setUser({ ...user, avatarUrl: publicUrl });
      toast.success(t("settings.photoUpdated"));
    } catch (error: any) {
      console.error(error);
      toast.error(t("settings.photoError"));
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    await new Promise(r => setTimeout(r, 800));
    setSaving(false);
    toast.success(t("settings.saved"));
  }

  return (
    <div className="flex flex-col h-full">
      <Header title={t("settings.title")} subtitle={t("settings.subtitle")} />

      <div className="flex-1 overflow-auto custom-scroll p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 max-w-5xl">
          {/* Sidebar tabs */}
          <div className="bg-card border border-border rounded-xl p-3 space-y-1 h-fit">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setActiveTab(id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                  activeTab === id ? "gradient-primary text-white shadow-sm" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}>
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="lg:col-span-3 bg-card border border-border rounded-xl p-6 space-y-5">
            {activeTab === "profile" && (
              <>
                <h2 className="font-bold text-foreground text-base">{t("settings.profile.title")}</h2>
                <div className="flex items-center gap-4 pb-5 border-b border-border/50">
                  <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center text-white font-bold text-xl overflow-hidden relative group">
                    {user?.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                      user?.name?.split(" ").map(w => w[0]).join("").slice(0, 2)
                    )}
                    {uploading && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-foreground">{user?.name}</p>
                    <p className="text-sm text-muted-foreground capitalize">{userRoleLabel}</p>
                    <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} accept="image/*" className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                      className="text-xs text-primary hover:underline mt-1 flex items-center gap-1 disabled:opacity-50">
                      {uploading ? t("settings.profile.uploading") : t("settings.profile.changePhoto")}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[].map(({ label, value, name }: any) => (
                    <div key={name}>
                      <label className="block text-xs font-semibold text-foreground mb-1.5">{label}</label>
                      <input defaultValue={value}
                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                    </div>
                  ))}
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-foreground mb-1.5">{t("settings.profile.specialty")}</label>
                    <select defaultValue="Cardiologie" className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
                      <option value="Cardiologie">Cardiologie</option>
                      <option>Neurologie</option>
                      <option>Médecine générale</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-foreground mb-1.5">{t("settings.profile.bio")}</label>
                    <textarea rows={3} placeholder={t("settings.profile.bioPlaceholder")}
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none" />
                  </div>
                </div>
              </>
            )}

            {activeTab === "appearance" && (
              <>
                <h2 className="font-bold text-foreground text-base">{t("settings.appearance.title")}</h2>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-3">{t("settings.appearance.theme")}</label>
                  <div className="flex gap-3">
                    {[
                      { value: "light", label: t("settings.appearance.lightMode"), icon: "☀️" },
                      { value: "dark",  label: t("settings.appearance.darkMode"),  icon: "🌙" },
                    ].map(({ value, label, icon }) => (
                      <button key={value} onClick={() => setTheme(value as "light" | "dark")}
                        className={cn(
                          "flex-1 py-4 rounded-xl border-2 text-sm font-medium transition-all flex flex-col items-center gap-2",
                          theme === value ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/50"
                        )}>
                        <span className="text-2xl">{icon}</span>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-3">{t("settings.appearance.language")}</label>
                  <select
                    value={lang}
                    onChange={e => setLang(e.target.value as "fr" | "de")}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all">
                    <option value="fr">Français</option>
                    <option value="de">Deutsch</option>
                  </select>
                </div>
              </>
            )}

            {activeTab === "notifications" && (
              <>
                <h2 className="font-bold text-foreground text-base">{t("settings.notifications.title")}</h2>
                {[
                  { label: t("settings.notifications.appointmentReminder"), desc: t("settings.notifications.appointmentReminderDesc"), defaultChecked: true },
                  { label: t("settings.notifications.newPatient"),          desc: t("settings.notifications.newPatientDesc"),          defaultChecked: true },
                  { label: t("settings.notifications.invoicePaid"),         desc: t("settings.notifications.invoicePaidDesc"),         defaultChecked: true },
                  { label: t("settings.notifications.appointmentCancelled"),desc: t("settings.notifications.appointmentCancelledDesc"),defaultChecked: false },
                  { label: t("settings.notifications.dailyReport"),         desc: t("settings.notifications.dailyReportDesc"),         defaultChecked: false },
                ].map(({ label, desc, defaultChecked }) => (
                  <div key={label} className="flex items-center justify-between py-3 border-b border-border/40 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-foreground">{label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked={defaultChecked} className="sr-only peer" />
                      <div className="w-10 h-5 bg-muted rounded-full peer peer-checked:bg-primary transition-colors peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-transform" />
                    </label>
                  </div>
                ))}
              </>
            )}

            {activeTab === "clinic" && (
              <>
                <h2 className="font-bold text-foreground text-base">{t("settings.clinic.title")}</h2>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: t("settings.clinic.name"),  value: "Cabinet Dr. Bensalem" },
                    { label: t("settings.clinic.phone"), value: "+212 522 123 456" },
                    { label: t("settings.clinic.email"), value: "contact@bensalem.ma" },
                    { label: t("settings.clinic.city"),  value: "Casablanca" },
                    { label: t("settings.clinic.hours"), value: "08:00 - 19:00" },
                    { label: t("settings.clinic.days"),  value: "Lun-Ven + Sam matin" },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <label className="block text-xs font-semibold text-foreground mb-1.5">{label}</label>
                      <input defaultValue={value} className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                    </div>
                  ))}
                </div>
              </>
            )}

            {activeTab === "security" && (
              <>
                <h2 className="font-bold text-foreground text-base">{t("settings.security.title")}</h2>
                <div className="space-y-4">
                  {[
                    { label: t("settings.security.currentPassword"), placeholder: t("settings.security.currentPasswordPlaceholder") },
                    { label: t("settings.security.newPassword"),     placeholder: t("settings.security.newPasswordPlaceholder") },
                    { label: t("settings.security.confirmPassword"), placeholder: t("settings.security.confirmPasswordPlaceholder") },
                  ].map(({ label, placeholder }) => (
                    <div key={label}>
                      <label className="block text-xs font-semibold text-foreground mb-1.5">{label}</label>
                      <input type="password" placeholder={placeholder}
                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Save button */}
            <div className="pt-4 border-t border-border/50">
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-primary text-white text-sm font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-60">
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saving ? t("settings.saving") : t("settings.saveBtn")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
