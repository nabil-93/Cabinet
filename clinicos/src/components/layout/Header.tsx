"use client";
import { useState } from "react";

import { Search, Bell, Sun, Moon, Menu, Plus, X, Check } from "lucide-react";
import { useStore } from "@/store";
import { useNotifications } from "@/hooks/useNotifications";
import { useMarkNotificationRead, useMarkAllRead } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useRouter } from "next/navigation";

export default function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  const { toggleMobileSidebar, theme, setTheme } = useStore();
  const router = useRouter();
  const [showNotifs, setShowNotifs] = useState(false);
  const { data: notifications = [] } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllRead();
  const unread = notifications.filter((n) => !n.read).length;

  const notifIcons: Record<string, string> = {
    appointment: "🗓️", payment: "💳", system: "⚙️", message: "💬",
  };

  return (
    <header className="sticky top-0 z-30 h-16 flex items-center gap-4 px-6 flex-shrink-0 bg-background/95 border-b border-border">
      <button onClick={toggleMobileSidebar} className="md:hidden w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-accent transition-all">
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex-1">
        <h1 className="text-lg font-bold text-foreground leading-none">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>

      <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/60 border border-border/50 text-muted-foreground text-sm w-56 cursor-pointer hover:border-primary/40 transition-all">
        <Search className="w-4 h-4 flex-shrink-0" />
        <span className="text-xs">Rechercher...</span>
        <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-background border border-border font-mono">⌘K</kbd>
      </div>

      <button onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-all">
        {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
      </button>

      {/* Notifications */}
      <div className="relative">
        <button onClick={() => setShowNotifs(!showNotifs)}
          className="relative w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-all">
          <Bell className="w-4 h-4" />
          {unread > 0 && (
            <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>

        {showNotifs && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowNotifs(false)} />
            <div className="absolute right-0 top-11 w-80 bg-popover border border-border rounded-xl shadow-lg z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                <p className="text-sm font-semibold text-foreground">Notifications</p>
                <div className="flex items-center gap-1">
                  {unread > 0 && (
                    <button onClick={() => markAll.mutate()} className="text-xs text-primary hover:underline flex items-center gap-1">
                      <Check className="w-3 h-3" /> Tout lire
                    </button>
                  )}
                  <button onClick={() => setShowNotifs(false)} className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent ml-1">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto custom-scroll">
                {notifications.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">Aucune notification</div>
                ) : (
                  notifications.map((notif) => (
                    <button key={notif.id} onClick={() => markRead.mutate(notif.id)}
                      className={cn("w-full text-left px-4 py-3 border-b border-border/30 hover:bg-accent/50 transition-all", !notif.read && "bg-primary/5")}>
                      <div className="flex items-start gap-2.5">
                        <span className="text-base leading-none mt-0.5">{notifIcons[notif.type] || "🔔"}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className={cn("text-xs font-semibold", !notif.read ? "text-primary" : "text-foreground")}>{notif.title}</p>
                            {!notif.read && <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{notif.message}</p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <button onClick={() => router.push("/appointments?new=1")}
        className="hidden md:flex items-center gap-2 px-3.5 py-2 rounded-xl gradient-primary text-white text-xs font-semibold shadow-sm hover:opacity-90 active:scale-95 transition-all">
        <Plus className="w-3.5 h-3.5" /> Nouveau RDV
      </button>
    </header>
  );
}
