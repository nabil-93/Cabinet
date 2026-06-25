"use client";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: LucideIcon;
  gradient: string;
  delay?: number;
  suffix?: string;
}

export default function StatCard({ title, value, change, icon: Icon, gradient, delay = 0, suffix }: StatCardProps) {
  const positive = change !== undefined && change >= 0;

  return (
    <div className="bg-card border border-border rounded-xl p-5 relative overflow-hidden group cursor-default transition-all duration-200 hover:shadow-md">
      {/* Background gradient orb */}
      <div className={cn("absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-15 blur-xl transition-opacity duration-300 group-hover:opacity-25", gradient)} />

      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-2xl font-bold text-foreground">{typeof value === "number" ? value.toLocaleString("fr-FR") : value}</span>
            {suffix && <span className="text-sm text-muted-foreground font-medium">{suffix}</span>}
          </div>
          {change !== undefined && (
            <div className={cn("flex items-center gap-1 mt-2 text-xs font-semibold", positive ? "text-emerald-600" : "text-red-500")}>
              {positive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              <span>{positive ? "+" : ""}{change}% ce mois</span>
            </div>
          )}
        </div>

        <div className={cn("w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md", gradient)}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </div>
  );
}
