"use client";
import { useState, useCallback } from "react";
import { Search, Plus, Users, Phone, Mail, ChevronRight, UserCheck, UserX, Trash2, Edit, X } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import Header from "@/components/layout/Header";
import { PatientCardSkeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/ui/EmptyState";
import { usePatients, useCreatePatient, useDeletePatient, useUpdatePatient } from "@/hooks/usePatients";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Patient } from "@/types";

type GenderFilter = "all" | "male" | "female";
type StatusFilter = "all" | "active" | "inactive";

interface PatientForm {
  fullName: string; phone: string; email: string;
  dateOfBirth: string; gender: string; address: string;
  bloodType: string; status: string;
}

const EMPTY_FORM: PatientForm = {
  fullName: "", phone: "", email: "", dateOfBirth: "",
  gender: "male", address: "", bloodType: "", status: "active",
};

function patientToForm(p: Patient): PatientForm {
  return {
    fullName: p.fullName || "",
    phone: p.phone || "",
    email: p.email || "",
    dateOfBirth: p.dateOfBirth || "",
    gender: p.gender || "male",
    address: p.address || "",
    bloodType: p.bloodType || "",
    status: p.status || "active",
  };
}

export default function PatientsPage() {
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showModal, setShowModal] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [form, setForm] = useState<PatientForm>(EMPTY_FORM);

  const { data: patients = [], isLoading } = usePatients(search || undefined);
  const createMutation = useCreatePatient();
  const updateMutation = useUpdatePatient();
  const deleteMutation = useDeletePatient();

  const filtered = patients.filter((p) => {
    const matchSearch = search === "" || p.fullName.toLowerCase().includes(search.toLowerCase()) || p.phone?.includes(search);
    const matchGender = genderFilter === "all" || p.gender === genderFilter;
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchSearch && matchGender && matchStatus;
  });

  const openAdd = () => {
    setEditingPatient(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (patient: Patient) => {
    setEditingPatient(patient);
    setForm(patientToForm(patient));
    setShowModal(true);
  };

  const handleDelete = useCallback((id: string, name: string) => {
    if (!confirm(`Supprimer ${name} ?`)) return;
    deleteMutation.mutate(id);
  }, [deleteMutation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      fullName: form.fullName, phone: form.phone, email: form.email || undefined,
      dateOfBirth: form.dateOfBirth || undefined, gender: form.gender,
      address: form.address || undefined, bloodType: form.bloodType || undefined,
      ...(editingPatient ? { status: form.status } : {}),
    };
    if (editingPatient) {
      await updateMutation.mutateAsync({ id: editingPatient.id, data: payload });
    } else {
      await createMutation.mutateAsync({ ...payload, medicalHistory: [], allergies: [] });
    }
    setShowModal(false);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col h-full">
      <Header title="Patients" subtitle={`${patients.length} patients enregistrés`} />

      <div className="flex-1 overflow-auto custom-scroll p-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total", value: patients.length, icon: Users, color: "gradient-primary" },
            { label: "Actifs", value: patients.filter(p => p.status === "active").length, icon: UserCheck, color: "gradient-success" },
            { label: "Inactifs", value: patients.filter(p => p.status === "inactive").length, icon: UserX, color: "gradient-warning" },
          ].map(({ label, value, icon: Icon, color }, i) => (
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

        {/* Toolbar */}
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher par nom, téléphone..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
          </div>
          <div className="flex gap-2">
            <select value={genderFilter} onChange={(e) => setGenderFilter(e.target.value as GenderFilter)}
              className="px-3 py-2 rounded-xl border border-border bg-background/50 text-sm text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
              <option value="all">Tous genres</option>
              <option value="male">Homme</option>
              <option value="female">Femme</option>
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="px-3 py-2 rounded-xl border border-border bg-background/50 text-sm text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
              <option value="all">Tous statuts</option>
              <option value="active">Actif</option>
              <option value="inactive">Inactif</option>
            </select>
            <button onClick={openAdd}
              className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-primary text-white text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm">
              <Plus className="w-4 h-4" /> Ajouter
            </button>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {isLoading ? (
            Array(6).fill(null).map((_, i) => <PatientCardSkeleton key={i} />)
          ) : (
            filtered.map((patient, i) => (
              <div key={patient.id} className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-all group">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 font-bold text-sm text-white shadow-md"
                    style={{ background: `hsl(${(i * 47 + 220)}deg 65% 55%)` }}>
                    {patient.fullName?.split(" ").map(w => w[0]).join("").slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm text-foreground truncate">{patient.fullName}</h3>
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full",
                        patient.status === "active" ? "badge-confirmed" : "badge-cancelled")}>
                        {patient.status === "active" ? "Actif" : "Inactif"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {patient.gender === "male" ? "Homme" : "Femme"} · {patient.bloodType || "—"}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5 mb-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{patient.phone}</span>
                  </div>
                  {patient.email && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{patient.email}</span>
                    </div>
                  )}
                </div>

                {patient.allergies?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {patient.allergies.slice(0, 2).map((a) => (
                      <span key={a} className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 font-medium border border-red-200/50">⚠ {a}</span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-border/40">
                  <span className="text-[10px] text-muted-foreground">
                    {patient.lastVisit ? `Dernière visite: ${format(new Date(patient.lastVisit), "d MMM", { locale: fr })}` : "Aucune visite"}
                  </span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(patient)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all"
                      title="Modifier">
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(patient.id, patient.fullName)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-red-50 hover:text-red-500 transition-all"
                      title="Supprimer">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <Link href={`/patients/${patient.id}`}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all" title="Voir profil">
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </Link>
                  </div>
                </div>
              </div>
            ))
          )}

          {!isLoading && filtered.length === 0 && (
            <div className="col-span-full">
              <EmptyState icon={Users}
                title={search ? "Aucun résultat" : "Aucun patient enregistré"}
                description={search ? "Aucun patient ne correspond à votre recherche." : "Ajoutez votre premier patient pour commencer."}
                action={!search ? { label: "+ Ajouter un patient", onClick: openAdd } : undefined} />
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-xl p-6 max-h-[90vh] overflow-y-auto custom-scroll">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-foreground">
                {editingPatient ? "Modifier le patient" : "Nouveau patient"}
              </h2>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-foreground mb-1.5">Nom complet *</label>
                  <input required value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                    placeholder="Prénom Nom"
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">Téléphone *</label>
                  <input required value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+212 6XX..."
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">Genre</label>
                  <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
                    <option value="male">Homme</option>
                    <option value="female">Femme</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="email@example.com"
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">Date de naissance</label>
                  <input type="date" value={form.dateOfBirth} onChange={e => setForm(f => ({ ...f, dateOfBirth: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">Groupe sanguin</label>
                  <select value={form.bloodType} onChange={e => setForm(f => ({ ...f, bloodType: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
                    <option value="">Inconnu</option>
                    {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-foreground mb-1.5">Adresse</label>
                  <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                    placeholder="Adresse complète"
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                </div>
                {editingPatient && (
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">Statut</label>
                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
                      <option value="active">Actif</option>
                      <option value="inactive">Inactif</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-all">
                  Annuler
                </button>
                <button type="submit" disabled={isPending}
                  className="flex-1 py-2.5 rounded-xl gradient-primary text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                  {isPending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : editingPatient ? "Enregistrer" : "Ajouter"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
