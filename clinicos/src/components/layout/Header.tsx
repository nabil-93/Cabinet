"use client";
import { useState } from "react";
import { Bell, Sun, Moon, Menu, Plus, X, Check, Users, Circle } from "lucide-react";
import { useStore } from "@/store";
import { useNotifications } from "@/hooks/useNotifications";
import { useMarkNotificationRead, useMarkAllRead } from "@/hooks/useNotifications";
import { useDoctorPresence } from "@/hooks/useDoctorPresence";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/i18n";

// ─── Language Switcher ────────────────────────────────────────────────────────
function LangSwitcher() {
  const { lang, setLang } = useLang();
  return (
    <div className="flex items-center gap-0.5 bg-muted/60 border border-border/50 rounded-xl p-1">
      {(["fr", "de"] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={cn(
            "px-2.5 py-1 rounded-lg text-xs font-bold uppercase transition-all",
            lang === l
              ? "bg-primary text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

// ─── Online Users Widget ──────────────────────────────────────────────────────
function OnlineUsers() {
  const { onlineDoctors } = useDoctorPresence();
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const count = onlineDoctors.length;

  function initials(name: string) {
    return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  }

  const COLORS = [
    "oklch(0.55 0.18 240)", "oklch(0.52 0.20 165)", "oklch(0.55 0.18 300)",
    "oklch(0.55 0.18 30)", "oklch(0.52 0.18 200)", "oklch(0.55 0.20 120)",
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted/60 border border-border/50 hover:border-primary/40 hover:bg-muted transition-all"
        title="Utilisateurs connectés"
      >
        {/* Stacked avatars */}
        <div className="flex items-center">
          {count === 0 ? (
            <Users className="w-4 h-4 text-muted-foreground" />
          ) : (
            onlineDoctors.slice(0, 3).map((d, i) => (
              <div
                key={d.userId}
                className="w-6 h-6 rounded-full border-2 border-background flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                style={{
                  background: COLORS[i % COLORS.length],
                  marginLeft: i > 0 ? "-6px" : "0",
                  zIndex: 10 - i,
                }}
              >
                {initials(d.name)}
              </div>
            ))
          )}
          {count > 3 && (
            <div
              className="w-6 h-6 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[9px] font-bold text-muted-foreground -ml-1.5"
              style={{ zIndex: 7 }}
            >
              +{count - 3}
            </div>
          )}
        </div>

        {/* Count label */}
        <span className="text-xs font-semibold text-foreground hidden sm:inline">
          {count === 0
            ? t("header.offline")
            : count > 1
              ? t("header.connectedPlural", { count })
              : t("header.connected", { count })}
        </span>

        {/* Status dot */}
        <div className={cn("w-2 h-2 rounded-full flex-shrink-0",
          count > 0 ? "bg-emerald-500" : "bg-muted-foreground"
        )} />
      </button>

      {/* Dropdown */}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 w-64 bg-popover border border-border rounded-xl shadow-lg z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-primary" />
                {t("header.connectedNow")}
              </p>
              <button
                onClick={() => setOpen(false)}
                className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="max-h-60 overflow-y-auto custom-scroll">
              {count === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  <Users className="w-6 h-6 mx-auto mb-2 opacity-40" />
                  {t("header.noOne")}
                </div>
              ) : (
                onlineDoctors.map((d, i) => (
                  <div
                    key={d.userId}
                    className="flex items-center gap-3 px-4 py-2.5 border-b border-border/30 last:border-0 hover:bg-accent/50 transition-colors"
                  >
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ background: COLORS[i % COLORS.length] }}
                    >
                      {initials(d.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{d.name}</p>
                      <p className="text-xs text-muted-foreground">{d.displayRole}</p>
                    </div>
                    <Circle
                      className={cn(
                        "w-2.5 h-2.5 flex-shrink-0 fill-current",
                        d.isAvailable ? "text-emerald-500" : "text-amber-500"
                      )}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Header ──────────────────────────────────────────────────────────────
export default function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  const { toggleMobileSidebar, theme, setTheme } = useStore();
  const { t } = useLang();
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
      <button
        onClick={toggleMobileSidebar}
        className="md:hidden w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-accent transition-all"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex-1">
        <h1 className="text-lg font-bold text-foreground leading-none">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>

      {/* Online users widget — replaces search bar */}
      <OnlineUsers />

      {/* Language switcher */}
      <LangSwitcher />

      {/* Theme toggle */}
      <button
        onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-all"
      >
        {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
      </button>

      {/* Notifications */}
      <div className="relative">
        <button
          onClick={() => setShowNotifs(!showNotifs)}
          className="relative w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-all"
        >
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
                <p className="text-sm font-semibold text-foreground">{t("header.notifications")}</p>
                <div className="flex items-center gap-1">
                  {unread > 0 && (
                    <button
                      onClick={() => markAll.mutate()}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" /> {t("header.markAllRead")}
                    </button>
                  )}
                  <button
                    onClick={() => setShowNotifs(false)}
                    className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent ml-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto custom-scroll">
                {notifications.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">{t("header.noNotifications")}</div>
                ) : (
                  notifications.map((notif) => (
                    <button
                      key={notif.id}
                      onClick={() => markRead.mutate(notif.id)}
                      className={cn(
                        "w-full text-left px-4 py-3 border-b border-border/30 hover:bg-accent/50 transition-all",
                        !notif.read && "bg-primary/5"
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="text-base leading-none mt-0.5">{notifIcons[notif.type] || "🔔"}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className={cn("text-xs font-semibold", !notif.read ? "text-primary" : "text-foreground")}>
                              {notif.title}
                            </p>
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

      <button
        onClick={() => router.push("/appointments?new=1")}
        className="hidden md:flex items-center gap-2 px-3.5 py-2 rounded-xl gradient-primary text-white text-xs font-semibold shadow-sm hover:opacity-90 active:scale-95 transition-all"
      >
        <Plus className="w-3.5 h-3.5" /> {t("header.newAppointment")}
      </button>
    </header>
  );
}
