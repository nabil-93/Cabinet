import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export default function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center py-20 px-6 text-center", className)}
    >
      {/* Icon container */}
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-3xl bg-primary/5 absolute inset-0 scale-110 blur-xl" />
        <div className="relative w-20 h-20 rounded-3xl bg-muted/60 border border-border/50 flex items-center justify-center">
          <Icon className="w-9 h-9 text-muted-foreground/60" strokeWidth={1.5} />
        </div>
      </div>

      <h3 className="text-base font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">{description}</p>

      {action && (
        <button
          onClick={action.onClick}
          className="mt-6 px-5 py-2.5 rounded-xl gradient-primary text-white text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all shadow-sm"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
