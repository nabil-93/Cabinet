"use client";
import { useState } from "react";

import { ChevronLeft, ChevronRight, Calendar, Clock } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, getDay, addMonths, subMonths } from "date-fns";
import { fr, de } from "date-fns/locale";
import Header from "@/components/layout/Header";
import { useAppointmentsByMonth } from "@/hooks/useAppointments";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";

const STATUS_COLORS = {
  confirmed: "bg-emerald-500",
  pending: "bg-amber-500",
  cancelled: "bg-red-500",
  completed: "bg-blue-500",
};

export default function CalendarPage() {
  const { lang, t } = useLang();
  const dateLocale = lang === "de" ? de : fr;
  const [currentDate, setCurrentDate] = useState(new Date());
  const monthStr = format(currentDate, "yyyy-MM");
  const { data: appointments = [] } = useAppointmentsByMonth(monthStr);

  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [view, setView] = useState<"month" | "week">("month");

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad start
  const startDay = getDay(monthStart) === 0 ? 6 : getDay(monthStart) - 1;
  const paddedDays = Array(startDay).fill(null).concat(days);

  const selectedDateApts = selectedDate
    ? appointments.filter((a) => isSameDay(new Date(a.date), selectedDate))
    : [];

  return (
    <div className="flex flex-col h-full">
      <Header title={t("calendar.title")} subtitle={t("calendar.subtitle")} />

      <div className="flex-1 overflow-auto custom-scroll p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 h-full">
          {/* Calendar */}
          <div className="bg-card border border-border rounded-xl p-5 lg:col-span-2">
            {/* Calendar header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                  className="w-8 h-8 rounded-xl border border-border flex items-center justify-center hover:bg-accent transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <h2 className="text-base font-bold text-foreground capitalize">
                  {format(currentDate, "MMMM yyyy", { locale: dateLocale })}
                </h2>
                <button
                  onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                  className="w-8 h-8 rounded-xl border border-border flex items-center justify-center hover:bg-accent transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentDate(new Date())}
                  className="px-3 py-1.5 text-xs font-medium rounded-xl border border-border hover:bg-accent transition-all"
                >
                  {t("calendar.today")}
                </button>
              </div>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 mb-2">
              {(lang === "de"
                ? ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]
                : ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]
              ).map((day) => (
                <div key={day} className="text-center text-[11px] font-semibold text-muted-foreground py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-1">
              {paddedDays.map((day, i) => {
                if (!day) return <div key={`empty-${i}`} />;
                const dayApts = appointments.filter((a) => isSameDay(new Date(a.date), day));
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const today = isToday(day);

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      "relative flex flex-col items-center py-2 px-1 rounded-xl transition-all min-h-[60px]",
                      isSelected && "gradient-primary shadow-md",
                      !isSelected && today && "ring-2 ring-primary/40 bg-primary/5",
                      !isSelected && !today && "hover:bg-accent"
                    )}
                  >
                    <span className={cn(
                      "text-sm font-semibold",
                      isSelected ? "text-white" : today ? "text-primary" : "text-foreground"
                    )}>
                      {format(day, "d")}
                    </span>

                    {/* Appointment dots */}
                    {dayApts.length > 0 && (
                      <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                        {dayApts.slice(0, 3).map((apt) => (
                          <div
                            key={apt.id}
                            className={cn("w-1.5 h-1.5 rounded-full", STATUS_COLORS[apt.status], isSelected && "opacity-80")}
                          />
                        ))}
                        {dayApts.length > 3 && (
                          <span className={cn("text-[9px] font-bold", isSelected ? "text-white/80" : "text-muted-foreground")}>
                            +{dayApts.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border/40">
              {Object.entries(STATUS_COLORS).map(([status, color]) => (
                <div key={status} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <div className={cn("w-2 h-2 rounded-full", color)} />
                  <span className="capitalize">
                    {status === "confirmed" ? t("calendar.legend.confirmed") :
                     status === "pending" ? t("calendar.legend.pending") :
                     status === "cancelled" ? t("calendar.legend.cancelled") :
                     t("calendar.legend.completed")}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Day Detail */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="mb-4">
              <h3 className="font-semibold text-sm text-foreground">
                {selectedDate ? format(selectedDate, "EEEE d MMMM", { locale: dateLocale }) : "Sélectionnez une date"}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selectedDateApts.length === 1
                  ? t("calendar.appointmentCount")
                  : t("calendar.appointmentsCount").replace("{count}", String(selectedDateApts.length))}
              </p>
            </div>

            {selectedDateApts.length === 0 ? (
              <div className="py-12 text-center">
                <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                  <Calendar className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">{t("calendar.noAppointments")}</p>
                <p className="text-xs text-muted-foreground/70 mt-1">{t("calendar.thisDay")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDateApts.map((apt, i) => (
                  <div
                    key={apt.id}
                    className="p-3 rounded-xl border border-border/50 hover:bg-accent/40 transition-all"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={cn("w-2 h-full min-h-[40px] rounded-full flex-shrink-0", STATUS_COLORS[apt.status])} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground">{apt.patientName}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{apt.type}</p>
                        <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span>{apt.time} · {apt.duration}min</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
