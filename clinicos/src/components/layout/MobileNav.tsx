"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Calendar, Clock, CreditCard, Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

const MOBILE_NAV = [
  { href: "/dashboard",    label: "Accueil",   icon: LayoutDashboard },
  { href: "/patients",     label: "Patients",  icon: Users },
  { href: "/appointments", label: "RDV",       icon: Calendar },
  { href: "/waiting-room", label: "Attente",   icon: Clock },
  { href: "/billing",      label: "Facturation", icon: CreditCard },
];

export default function MobileNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  
  // Show only items relevant to the user role
  const role = user?.role || "doctor";

  return (
    <nav className="mobile-nav">
      {MOBILE_NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-all min-w-[52px]",
              active
                ? "text-primary"
                : "text-muted-foreground"
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-xl flex items-center justify-center transition-all",
              active ? "bg-primary/10" : ""
            )}>
              <Icon className={cn("transition-all", active ? "w-5 h-5" : "w-[18px] h-[18px]")} />
            </div>
            <span className={cn("text-[10px] font-medium leading-none", active ? "font-semibold" : "")}>
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
