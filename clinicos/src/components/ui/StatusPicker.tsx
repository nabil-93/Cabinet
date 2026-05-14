"use client";
import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppointmentStatus } from "@/types";
import { useLang } from "@/lib/i18n";

interface StatusPickerProps {
  current: AppointmentStatus;
  onChange: (status: AppointmentStatus) => void;
  disabled?: boolean;
}

export default function StatusPicker({ current, onChange, disabled }: StatusPickerProps) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const ALL_STATUSES: { value: AppointmentStatus; label: string; cls: string }[] = [
    { value: "pending",   label: t("appointments.statusLabels.pending"),   cls: "badge-pending" },
    { value: "confirmed", label: t("appointments.statusLabels.confirmed"), cls: "badge-confirmed" },
    { value: "completed", label: t("appointments.statusLabels.completed"), cls: "badge-completed" },
    { value: "cancelled", label: t("appointments.statusLabels.cancelled"), cls: "badge-cancelled" },
  ];

  const currentConfig = ALL_STATUSES.find(s => s.value === current) || ALL_STATUSES[0];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={cn(
          "inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full transition-all hover:opacity-80",
          currentConfig.cls,
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        {currentConfig.label}
        <ChevronDown className={cn("w-3 h-3 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-7 z-50 w-36 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
          {ALL_STATUSES.map(s => (
            <button
              key={s.value}
              type="button"
              onClick={() => { onChange(s.value); setOpen(false); }}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 text-xs font-medium hover:bg-accent transition-all text-left",
                s.value === current && "bg-accent"
              )}
            >
              <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold", s.cls)}>{s.label}</span>
              {s.value === current && <Check className="w-3 h-3 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
