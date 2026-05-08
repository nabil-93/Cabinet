"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { OnlineDoctor } from "@/hooks/useDoctorPresence";
import { Stethoscope, ChevronDown, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

const COLORS = [
  "oklch(0.55 0.18 240)", "oklch(0.52 0.20 165)", "oklch(0.55 0.18 300)",
  "oklch(0.55 0.18 30)",  "oklch(0.52 0.18 200)", "oklch(0.55 0.20 120)",
];

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

interface DoctorCardsProps {
  doctors: OnlineDoctor[];
}

export function DoctorCards({ doctors }: DoctorCardsProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const available = doctors.filter(d => d.isAvailable);
  const busy      = doctors.filter(d => !d.isAvailable);

  return (
    <div className="relative">
      {/* ── Compact pill — always visible ── */}
      <button
        type="button"
        onClick={() => setDropdownOpen(v => !v)}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all text-left",
          doctors.length > 0
            ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-950/40"
            : "border-border bg-muted/30 hover:bg-muted/50"
        )}
      >
        <div className="flex -space-x-2">
          {doctors.slice(0, 3).map((doc, i) => (
            <div key={doc.userId}
              className="relative w-8 h-8 rounded-xl flex items-center justify-center text-white text-[10px] font-bold shadow-sm border-2 border-card"
              style={{ background: COLORS[i % COLORS.length] }}>
              {initials(doc.name)}
              <div className={cn(
                "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card",
                doc.isAvailable ? "bg-emerald-500" : "bg-red-400 animate-pulse"
              )} />
            </div>
          ))}
          {doctors.length === 0 && (
            <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center">
              <Stethoscope className="w-4 h-4 text-muted-foreground" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          {doctors.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun médecin connecté</p>
          ) : (
            <>
              <p className="text-sm font-bold text-foreground">
                {doctors.length} médecin{doctors.length > 1 ? "s" : ""} connecté{doctors.length > 1 ? "s" : ""}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {available.length > 0
                  ? <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{available.length} disponible{available.length > 1 ? "s" : ""}</span>
                  : <span className="text-red-500 font-semibold">Tous occupés</span>}
                {busy.length > 0 && available.length > 0 && ` · ${busy.length} en consultation`}
              </p>
            </>
          )}
        </div>

        {doctors.length > 0 && (
          <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform flex-shrink-0", dropdownOpen && "rotate-180")} />
        )}
      </button>

      {/* ── Dropdown detail ── */}
      {dropdownOpen && doctors.length > 0 && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setDropdownOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-2 z-40 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
            {doctors.map((doc, i) => (
              <div key={doc.userId}
                className="flex items-center gap-3 px-4 py-3 border-b border-border/40 last:border-0 hover:bg-accent/50 transition-colors">
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-sm"
                    style={{ background: COLORS[i % COLORS.length] }}>
                    {initials(doc.name)}
                  </div>
                  <div className={cn(
                    "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card",
                    doc.isAvailable ? "bg-emerald-500" : "bg-red-500 animate-pulse"
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-foreground truncate">Dr. {doc.name}</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium flex-shrink-0">
                      {doc.displayRole}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={cn(
                      "text-[11px] font-semibold",
                      doc.isAvailable ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"
                    )}>
                      {doc.isAvailable ? "Disponible" : "En consultation"}
                    </span>
                    {doc.lastSeenAt && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {formatDistanceToNow(new Date(doc.lastSeenAt), { addSuffix: true, locale: fr })}
                      </span>
                    )}
                  </div>
                </div>
                <div className={cn(
                  "w-2 h-2 rounded-full flex-shrink-0",
                  doc.isAvailable ? "bg-emerald-500" : "bg-red-500"
                )} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
