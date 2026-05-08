"use client";
/**
 * Singleton Realtime Provider — production-grade.
 *
 * Connection indicator is anchored on TRUE network state (navigator.onLine),
 * not on Supabase channel SUBSCRIBED status (which flickers during normal
 * WebSocket reconnects and confuses users).
 *
 * The Supabase channel remains the broadcast bus, but its lifecycle is
 * decoupled from the UI indicator: even if the WebSocket has a hiccup,
 * the user sees "connected" because polling + heartbeat keep data fresh.
 *
 * Status semantics:
 *   connecting → first 1.5s after mount (loading state)
 *   connected  → app is online and functional
 *   error      → ONLY when navigator.onLine === false (user has no internet)
 */
import {
  createContext, useContext, useEffect, useRef,
  useState, useCallback, ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { playSound } from "@/lib/sounds";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConnectionStatus = "connecting" | "connected" | "error";

type SupabaseChannel = ReturnType<ReturnType<typeof createClient>["channel"]>;

interface RealtimeCtx {
  connectionStatus: ConnectionStatus;
  sendBroadcast: (event: string, payload: Record<string, unknown>) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const Ctx = createContext<RealtimeCtx>({
  connectionStatus: "connecting",
  sendBroadcast: () => {},
});

export const useRealtimeContext = () => useContext(Ctx);

// ─── Provider ─────────────────────────────────────────────────────────────────

const CHANNEL = "clinicos-broadcast";

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const qc  = useQueryClient();
  const ref = useRef<SupabaseChannel | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");

  // ── Network-based connection indicator (the source of truth for UI) ──────
  useEffect(() => {
    if (typeof window === "undefined") return;

    const update = () => {
      setStatus(navigator.onLine ? "connected" : "error");
    };

    // Show "connecting" briefly so users see a loading state, then resolve
    const initial = setTimeout(update, 1200);

    window.addEventListener("online",  update);
    window.addEventListener("offline", update);

    return () => {
      clearTimeout(initial);
      window.removeEventListener("online",  update);
      window.removeEventListener("offline", update);
    };
  }, []);

  // ── Supabase broadcast channel (independent of UI status) ────────────────
  useEffect(() => {
    const supabase = createClient();

    const ch = supabase
      .channel(CHANNEL, { config: { broadcast: { ack: false } } })

      .on("broadcast", { event: "wr:updated" }, ({ payload }) => {
        const p = (payload ?? {}) as Record<string, any>;
        if (p.removed) {
          qc.setQueryData<any[]>(["waiting-room"], old => old?.filter(e => e.id !== p.removed) ?? old);
        } else if (p.added) {
          qc.setQueryData<any[]>(["waiting-room"], old => {
            if (!old) return [p.added];
            if (old.some((e: any) => e.id === p.added.id)) return old;
            return [...old, p.added];
          });
          qc.invalidateQueries({ queryKey: ["appointments-today"] });
        } else if (p.id && p.status) {
          qc.setQueryData<any[]>(["waiting-room"], old =>
            old?.map((e: any) => e.id === p.id
              ? { ...e, status: p.status, assignedDoctorId: p.doctorId ?? e.assignedDoctorId, assignedDoctorName: p.doctorName ?? e.assignedDoctorName }
              : e) ?? old
          );
        } else {
          qc.refetchQueries({ queryKey: ["waiting-room"] });
          qc.refetchQueries({ queryKey: ["appointments-today"] });
        }
      })
      .on("broadcast", { event: "wr:patient-called" }, ({ payload }) => {
        const p = (payload ?? {}) as Record<string, any>;
        if (p.id) {
          qc.setQueryData<any[]>(["waiting-room"], old =>
            old?.map((e: any) => e.id === p.id
              ? { ...e, status: "in_progress", assignedDoctorId: p.doctorId ?? e.assignedDoctorId, assignedDoctorName: p.doctorName ?? e.assignedDoctorName }
              : e) ?? old
          );
        } else {
          qc.refetchQueries({ queryKey: ["waiting-room"] });
        }
        playSound("call");
      })
      .on("broadcast", { event: "wr:consultation-done" }, ({ payload }) => {
        const p = (payload ?? {}) as Record<string, any>;
        if (p.id) {
          qc.setQueryData<any[]>(["waiting-room"], old =>
            old?.map((e: any) => e.id === p.id ? { ...e, status: "done" } : e) ?? old
          );
        } else {
          qc.refetchQueries({ queryKey: ["waiting-room"] });
        }
        playSound("done");
      })
      .on("broadcast", { event: "doctor:available" }, ({ payload }) => {
        const { doctorId } = payload ?? {};
        if (doctorId) {
          qc.setQueryData<any[]>(["doctors-online"], (old) =>
            old?.map(d => d.userId === doctorId ? { ...d, isAvailable: true } : d) ?? old
          );
        }
        playSound("available");
      })
      .on("broadcast", { event: "doctor:busy" }, ({ payload }) => {
        const { doctorId } = payload ?? {};
        if (doctorId) {
          qc.setQueryData<any[]>(["doctors-online"], (old) =>
            old?.map(d => d.userId === doctorId ? { ...d, isAvailable: false } : d) ?? old
          );
        }
        playSound("busy");
      })
      .on("broadcast", { event: "doctor:online" }, () => {
        qc.invalidateQueries({ queryKey: ["doctors-online"] });
      })
      .on("broadcast", { event: "doctor:offline" }, ({ payload }) => {
        const { doctorId } = payload ?? {};
        if (doctorId) {
          qc.setQueryData<any[]>(["doctors-online"], (old) =>
            old?.filter(d => d.userId !== doctorId) ?? old
          );
        }
      })

      .subscribe();

    ref.current = ch;
    return () => {
      supabase.removeChannel(ch);
      ref.current = null;
    };
  }, [qc]);

  const sendBroadcast = useCallback(
    (event: string, payload: Record<string, unknown>) => {
      ref.current?.send({ type: "broadcast", event, payload });
    },
    []
  );

  return (
    <Ctx.Provider value={{ connectionStatus: status, sendBroadcast }}>
      {children}
    </Ctx.Provider>
  );
}
