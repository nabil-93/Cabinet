"use client";
import { useState } from "react";
import { X, Stethoscope, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OnlineDoctor } from "@/hooks/useDoctorPresence";

const COLORS = [
  "oklch(0.55 0.18 240)", "oklch(0.52 0.20 165)", "oklch(0.55 0.18 300)",
  "oklch(0.55 0.18 30)",  "oklch(0.52 0.18 200)", "oklch(0.55 0.20 120)",
];

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

interface DoctorSelectModalProps {
  patientName: string;
  availableDoctors: OnlineDoctor[];
  allOnlineDoctors: OnlineDoctor[];
  onSelect: (doctor: OnlineDoctor) => void;
  onClose: () => void;
}

export function DoctorSelectModal({
  patientName,
  availableDoctors,
  allOnlineDoctors,
  onSelect,
  onClose,
}: DoctorSelectModalProps) {
  const [selected, setSelected] = useState<OnlineDoctor | null>(null);

  const busyDoctors = allOnlineDoctors.filter(d => !d.isAvailable);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg text-foreground">Assigner au médecin</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              <span className="font-semibold text-foreground">{patientName}</span> — choisissez un médecin disponible
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl hover:bg-muted flex items-center justify-center">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Available doctors */}
        <div className="space-y-2">
          {availableDoctors.length === 0 ? (
            <div className="py-8 text-center">
              <Stethoscope className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Aucun médecin disponible</p>
            </div>
          ) : (
            availableDoctors.map((doc, i) => (
              <button key={doc.userId} type="button"
                onClick={() => setSelected(doc)}
                className={cn(
                  "w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all",
                  selected?.userId === doc.userId
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                )}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-sm"
                  style={{ background: COLORS[i % COLORS.length] }}>
                  {initials(doc.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground">Dr. {doc.name}</p>
                  {doc.specialty && <p className="text-xs text-muted-foreground truncate">{doc.specialty}</p>}
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">Disponible</p>
                </div>
                {selected?.userId === doc.userId && (
                  <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                )}
              </button>
            ))
          )}
        </div>

        {/* Busy doctors (disabled) */}
        {busyDoctors.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              En consultation (indisponible)
            </p>
            {busyDoctors.map((doc, i) => (
              <div key={doc.userId}
                className="flex items-center gap-3 p-3.5 rounded-xl border border-border opacity-50 cursor-not-allowed">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                  style={{ background: COLORS[(i + availableDoctors.length) % COLORS.length] }}>
                  {initials(doc.name)}
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Dr. {doc.name}</p>
                  <p className="text-[11px] text-red-500 font-semibold">En consultation</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-all">
            Annuler
          </button>
          <button type="button"
            disabled={!selected}
            onClick={() => selected && onSelect(selected)}
            className="flex-1 py-2.5 rounded-xl gradient-primary text-white text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-all">
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
}
