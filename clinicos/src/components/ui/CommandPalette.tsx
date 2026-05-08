"use client";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Search, LayoutDashboard, Users, Calendar, CreditCard,
  FileText, BarChart2, Settings, Clock, Bot, Plus, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CommandItem {
  id: string;
  label: string;
  icon: React.ElementType;
  href?: string;
  action?: () => void;
  category: string;
  keywords?: string[];
}

const BASE_COMMANDS: CommandItem[] = [
  { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard, href: "/dashboard", category: "Navigation", keywords: ["home", "accueil"] },
  { id: "patients", label: "Patients", icon: Users, href: "/patients", category: "Navigation" },
  { id: "appointments", label: "Rendez-vous", icon: Calendar, href: "/appointments", category: "Navigation", keywords: ["rdv"] },
  { id: "calendar", label: "Calendrier", icon: Calendar, href: "/calendar", category: "Navigation" },
  { id: "billing", label: "Facturation", icon: CreditCard, href: "/billing", category: "Navigation", keywords: ["facture", "paiement"] },
  { id: "prescriptions", label: "Ordonnances", icon: FileText, href: "/prescriptions", category: "Navigation" },
  { id: "analytics", label: "Analytique", icon: BarChart2, href: "/analytics", category: "Navigation", keywords: ["stats", "statistiques"] },
  { id: "waiting", label: "Salle d'attente", icon: Clock, href: "/waiting-room", category: "Navigation" },
  { id: "ai", label: "Assistant IA", icon: Bot, href: "/ai-assistant", category: "Navigation" },
  { id: "settings", label: "Paramètres", icon: Settings, href: "/settings", category: "Navigation" },
  { id: "new-patient", label: "Nouveau patient", icon: Plus, href: "/patients?new=1", category: "Actions", keywords: ["ajouter patient"] },
  { id: "new-apt", label: "Nouveau rendez-vous", icon: Plus, href: "/appointments?new=1", category: "Actions", keywords: ["ajouter rdv"] },
];

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filtered = query
    ? BASE_COMMANDS.filter(cmd => {
        const q = query.toLowerCase();
        return cmd.label.toLowerCase().includes(q) ||
          cmd.category.toLowerCase().includes(q) ||
          cmd.keywords?.some(k => k.includes(q));
      })
    : BASE_COMMANDS;

  const execute = useCallback((cmd: CommandItem) => {
    if (cmd.action) cmd.action();
    if (cmd.href) router.push(cmd.href);
    onClose();
  }, [router, onClose]);

  useEffect(() => {
    setSelectedIndex(0);
    setQuery("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, filtered.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
      if (e.key === "Enter" && filtered[selectedIndex]) execute(filtered[selectedIndex]);
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, filtered, selectedIndex, execute, onClose]);

  const grouped = filtered.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, CommandItem[]>);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="relative w-full max-w-lg bg-popover border border-border shadow-lg rounded-xl overflow-hidden"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border/50">
              <Search className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <input
                autoFocus
                value={query}
                onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
                placeholder="Rechercher une page ou action..."
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <kbd className="text-[10px] px-1.5 py-0.5 rounded border border-border bg-muted text-muted-foreground font-mono">ESC</kbd>
            </div>

            {/* Results */}
            <div className="max-h-80 overflow-y-auto custom-scroll py-2">
              {Object.entries(grouped).map(([category, cmds]) => (
                <div key={category}>
                  <p className="px-4 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{category}</p>
                  {cmds.map((cmd) => {
                    const globalIndex = filtered.indexOf(cmd);
                    const Icon = cmd.icon;
                    return (
                      <button
                        key={cmd.id}
                        onClick={() => execute(cmd)}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors",
                          selectedIndex === globalIndex ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent"
                        )}
                      >
                        <div className={cn(
                          "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0",
                          selectedIndex === globalIndex ? "gradient-primary" : "bg-muted"
                        )}>
                          <Icon className={cn("w-3.5 h-3.5", selectedIndex === globalIndex ? "text-white" : "text-muted-foreground")} />
                        </div>
                        <span className="flex-1">{cmd.label}</span>
                        {selectedIndex === globalIndex && <ArrowRight className="w-3.5 h-3.5 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground">Aucun résultat pour &quot;{query}&quot;</div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-border/50 flex items-center gap-4 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded border border-border bg-muted font-mono">↑↓</kbd> Naviguer</span>
              <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded border border-border bg-muted font-mono">↵</kbd> Ouvrir</span>
              <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded border border-border bg-muted font-mono">ESC</kbd> Fermer</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
