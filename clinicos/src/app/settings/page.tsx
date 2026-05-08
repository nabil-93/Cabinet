"use client";
import { useState } from "react";

import { Settings, User, Bell, Shield, Palette, Building2, Save } from "lucide-react";
import Header from "@/components/layout/Header";
import { useAuth } from "@/lib/auth-context";
import { useStore } from "@/store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const TABS = [
  { id: "profile", label: "Profil", icon: User },
  { id: "clinic", label: "Cabinet", icon: Building2 },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "appearance", label: "Apparence", icon: Palette },
  { id: "security", label: "Sécurité", icon: Shield },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme, setTheme } = useStore();
  const [activeTab, setActiveTab] = useState("profile");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await new Promise(r => setTimeout(r, 800));
    setSaving(false);
    toast.success("Paramètres enregistrés !");
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Paramètres" subtitle="Gérer votre compte et votre cabinet" />

      <div className="flex-1 overflow-auto custom-scroll p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 max-w-5xl">
          {/* Sidebar tabs */}
          <div className="bg-card border border-border rounded-xl p-3 space-y-1 h-fit">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                  activeTab === id ? "gradient-primary text-white shadow-sm" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="lg:col-span-3 bg-card border border-border rounded-xl p-6 space-y-5">
            {activeTab === "profile" && (
              <>
                <h2 className="font-bold text-foreground text-base">Profil médecin</h2>
                <div className="flex items-center gap-4 pb-5 border-b border-border/50">
                  <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center text-white font-bold text-xl">
                    {user?.name?.split(" ").map(w => w[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    <p className="font-bold text-foreground">{user?.name}</p>
                    <p className="text-sm text-muted-foreground capitalize">{user?.role === "admin" ? "Administrateur" : user?.role === "doctor" ? "Médecin" : "Secrétaire"}</p>
                    <button className="text-xs text-primary hover:underline mt-1">Changer la photo</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[
                  ].map(({ label, value, name }) => (
                    <div key={name}>
                      <label className="block text-xs font-semibold text-foreground mb-1.5">{label}</label>
                      <input
                        defaultValue={value}
                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                      />
                    </div>
                  ))}
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-foreground mb-1.5">Spécialité</label>
                    <select defaultValue="Cardiologie" className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
                      <option value="Cardiologie">Cardiologie</option>
                      <option>Neurologie</option>
                      <option>Médecine générale</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-foreground mb-1.5">Biographie</label>
                    <textarea rows={3} placeholder="Votre bio professionnelle..." className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none" />
                  </div>
                </div>
              </>
            )}

            {activeTab === "appearance" && (
              <>
                <h2 className="font-bold text-foreground text-base">Apparence</h2>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-3">Thème</label>
                  <div className="flex gap-3">
                    {[
                      { value: "light", label: "Clair", icon: "☀️" },
                      { value: "dark", label: "Sombre", icon: "🌙" },
                    ].map(({ value, label, icon }) => (
                      <button
                        key={value}
                        onClick={() => setTheme(value as "light" | "dark")}
                        className={cn(
                          "flex-1 py-4 rounded-xl border-2 text-sm font-medium transition-all flex flex-col items-center gap-2",
                          theme === value ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/50"
                        )}
                      >
                        <span className="text-2xl">{icon}</span>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-3">Langue</label>
                  <select className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all">
                    <option>Français</option>
                    <option>العربية</option>
                    <option>English</option>
                  </select>
                </div>
              </>
            )}

            {activeTab === "notifications" && (
              <>
                <h2 className="font-bold text-foreground text-base">Notifications</h2>
                {[
                  { label: "Rappel de rendez-vous", desc: "30 min avant chaque RDV", defaultChecked: true },
                  { label: "Nouveau patient", desc: "Quand un nouveau patient s'inscrit", defaultChecked: true },
                  { label: "Facture payée", desc: "Confirmation de paiement reçu", defaultChecked: true },
                  { label: "RDV annulé", desc: "Quand un RDV est annulé", defaultChecked: false },
                  { label: "Rapport quotidien", desc: "Résumé de fin de journée par email", defaultChecked: false },
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
                <h2 className="font-bold text-foreground text-base">Informations du cabinet</h2>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Nom du cabinet", value: "Cabinet Dr. Bensalem" },
                    { label: "Téléphone", value: "+212 522 123 456" },
                    { label: "Email", value: "contact@bensalem.ma" },
                    { label: "Ville", value: "Casablanca" },
                    { label: "Horaires d'ouverture", value: "08:00 - 19:00" },
                    { label: "Jours de consultation", value: "Lun-Ven + Sam matin" },
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
                <h2 className="font-bold text-foreground text-base">Sécurité</h2>
                <div className="space-y-4">
                  {[
                    { label: "Mot de passe actuel", placeholder: "••••••••" },
                    { label: "Nouveau mot de passe", placeholder: "Minimum 8 caractères" },
                    { label: "Confirmer le mot de passe", placeholder: "Répéter le mot de passe" },
                  ].map(({ label, placeholder }) => (
                    <div key={label}>
                      <label className="block text-xs font-semibold text-foreground mb-1.5">{label}</label>
                      <input type="password" placeholder={placeholder} className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Save button */}
            <div className="pt-4 border-t border-border/50">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-primary text-white text-sm font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-60"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saving ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
