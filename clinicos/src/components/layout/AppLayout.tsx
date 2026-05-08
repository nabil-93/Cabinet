"use client";
import { useStore } from "@/store";
import { useEffect, useState } from "react";

import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import CommandPalette from "@/components/ui/CommandPalette";
import { RealtimeProvider } from "@/providers/RealtimeProvider";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { sidebarCollapsed, theme } = useStore();
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  // Sync sidebar width as CSS variable for responsive usage
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--sidebar-width",
      sidebarCollapsed ? "72px" : "260px"
    );
  }, [sidebarCollapsed]);

  // Global keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandOpen(prev => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <RealtimeProvider>
      <div className="min-h-screen mesh-bg">
        <Sidebar />
        {/* 
          Mobile (< md): No left margin — sidebar is a slide-over overlay.
          Desktop (≥ md): Left margin = sidebar width via CSS var + .main-with-sidebar.
        */}
        <main className="main-with-sidebar min-h-screen flex flex-col transition-all duration-300">
          {/* Add bottom padding on mobile to avoid content hiding under MobileNav */}
          <div className="flex flex-col flex-1 pb-[64px] md:pb-0">
            {children}
          </div>
        </main>
        {/* Mobile bottom navigation (hidden on desktop) */}
        <MobileNav />
        <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
      </div>
    </RealtimeProvider>
  );
}
