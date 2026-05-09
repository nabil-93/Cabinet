"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Calendar, ClipboardList, CreditCard,
  FileText, BarChart2, Settings, Bot, Clock, ChevronLeft,
  Stethoscope, LogOut, Shield, UserCog, Activity, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/store";
import { useAuth } from "@/lib/auth-context";
import { useEffect } from "react";
import { usePathname as usePN } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard",    label: "Tableau de bord", icon: LayoutDashboard, roles: ["admin","doctor","assistant"] },
  { href: "/patients",     label: "Patients",         icon: Users,           roles: ["admin","doctor","assistant"] },
  { href: "/appointments", label: "Rendez-vous",      icon: Calendar,        roles: ["admin","doctor","assistant"] },
  { href: "/calendar",     label: "Calendrier",       icon: ClipboardList,   roles: ["admin","doctor","assistant"] },
  { href: "/waiting-room", label: "Salle d'attente",  icon: Clock,           roles: ["admin","doctor","assistant"] },
  { href: "/billing",      label: "Facturation",      icon: CreditCard,      roles: ["admin","doctor","assistant"] },
  { href: "/prescriptions",label: "Ordonnances",      icon: FileText,        roles: ["admin","doctor"] },
  { href: "/analytics",    label: "Analytique",       icon: BarChart2,       roles: ["admin","doctor"] },
  { href: "/ai-assistant", label: "Assistant IA",     icon: Bot,             roles: ["admin","doctor","assistant"] },
  { href: "/team",         label: "Équipe",           icon: UserCog,         roles: ["admin"] },
  { href: "/activity",     label: "Activité",         icon: Activity,        roles: ["admin"] },
];

const ROLE_LABELS: Record<string, string> = {
  admin:     "Administrateur",
  doctor:    "Médecin",
  assistant: "Secrétaire",
  patient:   "Patient",
};

export default function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, sidebarMobileOpen, toggleSidebar, closeMobileSidebar } = useStore();
  const { user, logout } = useAuth();

  // Close mobile sidebar on route change
  useEffect(() => {
    closeMobileSidebar();
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMobileSidebar();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closeMobileSidebar]);

  const role = user?.role || "doctor";
  const visibleItems = NAV_ITEMS.filter(item => item.roles.includes(role));
  const initials = user?.name
    ? user.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-border/40">
        {!sidebarCollapsed ? (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
              <Stethoscope className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-bold text-sm text-foreground leading-none">ClinicOS</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Gestion médicale</p>
            </div>
          </div>
        ) : (
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center mx-auto">
            <Stethoscope className="w-4 h-4 text-white" />
          </div>
        )}
        
        {/* Desktop collapse button */}
        {!sidebarCollapsed && (
          <button onClick={toggleSidebar} className="hidden md:flex w-7 h-7 rounded-lg items-center justify-center text-muted-foreground hover:bg-accent transition-all">
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}

        {/* Mobile close button */}
        <button onClick={closeMobileSidebar} className="md:hidden w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent transition-all">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto custom-scroll py-4 px-3 space-y-0.5">
        {visibleItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={cn("nav-item", active && "active")} title={sidebarCollapsed ? item.label : undefined}>
              <Icon className="w-[18px] h-[18px] flex-shrink-0" />
              {!sidebarCollapsed && (
                <span className="overflow-hidden whitespace-nowrap text-[13px]">
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-4 border-t border-border/40 pt-3 space-y-0.5">
        <Link href="/settings" className={cn("nav-item", pathname === "/settings" && "active")} title={sidebarCollapsed ? "Paramètres" : undefined}>
          <Settings className="w-[18px] h-[18px] flex-shrink-0" />
          {!sidebarCollapsed && <span className="text-[13px]">Paramètres</span>}
        </Link>

        {/* User profile */}
        <div className={cn("flex items-center gap-2.5 p-2.5 rounded-xl mt-1 hover:bg-accent transition-all", sidebarCollapsed && "justify-center")}>
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 text-white font-bold text-xs overflow-hidden">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </div>
          {!sidebarCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-foreground truncate">
                {(role === "doctor" || role === "admin") ? `Dr. ${user?.name || "—"}` : user?.name || "—"}
              </p>
              <p className="text-[10px] text-muted-foreground">{ROLE_LABELS[role]}</p>
            </div>
          )}
          {!sidebarCollapsed && (
            <button onClick={logout} className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0" title="Déconnexion">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Desktop collapsed toggle */}
      {sidebarCollapsed && (
        <button onClick={toggleSidebar} className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-primary text-white items-center justify-center shadow hover:scale-110 transition-transform">
          <ChevronLeft className="w-3 h-3 rotate-180" />
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* ── Desktop Sidebar ── */}
      <aside
        className="hidden md:flex fixed left-0 top-0 h-full z-40 flex-col overflow-hidden transition-all duration-300 ease-in-out bg-background border-r border-border"
        style={{ width: sidebarCollapsed ? 72 : 260 }}
      >
        <div className="relative flex flex-col h-full">
          {sidebarContent}
        </div>
      </aside>

      {/* ── Mobile Overlay ── */}
      {sidebarMobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={closeMobileSidebar}
        />
      )}

      {/* ── Mobile Drawer ── */}
      <aside
        className={cn(
          "md:hidden fixed left-0 top-0 h-full z-50 w-[280px] flex flex-col overflow-hidden transition-transform duration-300 ease-in-out bg-background border-r border-border",
          sidebarMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="relative flex flex-col h-full">
          {sidebarContent}
        </div>
      </aside>
    </>
  );
}
