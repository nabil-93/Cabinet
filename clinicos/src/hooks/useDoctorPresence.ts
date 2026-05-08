"use client";
/**
 * Doctor presence — heartbeat + polling + broadcast via shared singleton channel.
 * Does NOT create any Supabase channel (that lives in RealtimeProvider).
 */
import { useEffect, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { isMedicalStaff } from "@/lib/roles";
import { useRealtimeContext } from "@/providers/RealtimeProvider";
import api from "@/services/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OnlineDoctor {
  userId:      string;
  name:        string;
  role:        string;
  displayRole: string;
  specialty:   string | null;
  isAvailable: boolean;
  lastSeenAt:  string | null;
}

const DOCTORS_KEY  = ["doctors-online"] as const;
const HEARTBEAT_MS = 28_000;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDoctorPresence() {
  const { user }         = useAuth();
  const qc               = useQueryClient();
  const { sendBroadcast } = useRealtimeContext();

  const isDoctor = isMedicalStaff(user?.role);

  // ── Online doctors list (invalidated by RealtimeProvider on DB changes) ──
  const { data: onlineDoctors = [] } = useQuery<OnlineDoctor[]>({
    queryKey: DOCTORS_KEY,
    queryFn:  () => api.get("/doctors/online").then(r => r.data),
    staleTime: 0,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  // Derive own availability from the live list
  const [myAvailability, setMyAvailability] = useState(true);
  useEffect(() => {
    if (!user) return;
    const me = onlineDoctors.find(d => d.userId === user.id);
    if (me !== undefined) setMyAvailability(me.isAvailable);
  }, [onlineDoctors, user]);

  // ── Heartbeat (doctors only) ──────────────────────────────────────────────
  useEffect(() => {
    if (!user || !isDoctor) return;

    const beat = async () => {
      try {
        await api.post("/doctor/heartbeat");
        qc.invalidateQueries({ queryKey: DOCTORS_KEY });
        sendBroadcast("doctor:online", { doctorId: user.id });
      } catch {}
    };

    beat(); // immediate
    const hb = setInterval(beat, HEARTBEAT_MS);

    const markOffline = () => {
      api.delete("/doctor/heartbeat").catch(() => {});
      sendBroadcast("doctor:offline", { doctorId: user.id });
    };

    const handleVisibility = () => {
      if (!document.hidden) beat();
    };

    window.addEventListener("beforeunload", markOffline);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(hb);
      window.removeEventListener("beforeunload", markOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
      markOffline();
    };
  }, [user, isDoctor, qc, sendBroadcast]);

  // ── Toggle own availability ───────────────────────────────────────────────
  const broadcastAvailability = useCallback((isAvail: boolean) => {
    if (!user) return;
    // 1. Local state (instant)
    setMyAvailability(isAvail);
    // 2. Patch local cache (instant for this tab)
    qc.setQueryData<OnlineDoctor[]>(DOCTORS_KEY, (old) =>
      old?.map(d => d.userId === user.id ? { ...d, isAvailable: isAvail } : d) ?? old
    );
    // 3. Broadcast via shared channel (instant for other tabs / other users)
    sendBroadcast(isAvail ? "doctor:available" : "doctor:busy", { doctorId: user.id });
    // 4. Persist to DB
    api.patch("/doctor/status", { isAvailable: isAvail }).catch(() => {});
  }, [user, qc, sendBroadcast]);

  return {
    onlineDoctors,
    availableDoctors: onlineDoctors.filter(d => d.isAvailable),
    myAvailability,
    broadcastAvailability,
    isDoctor,
    isSecretary: user?.role === "assistant",
  };
}
