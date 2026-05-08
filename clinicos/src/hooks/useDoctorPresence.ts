"use client";
/**
 * Doctor presence — heartbeat + polling + broadcast via shared singleton channel.
 * Does NOT create any Supabase channel (that lives in RealtimeProvider).
 */
import { useEffect, useState, useCallback, useMemo } from "react";
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

  // ── Presence broadcast (ALL staff) ─────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const displayRole =
      user.role === "assistant" ? "Secrétaire"
      : user.role === "admin"   ? "Médecin Admin"
      : user.role === "doctor"  ? "Médecin"
      : user.role || "Staff";

    const myInfo = {
      userId: user.id,
      name: user.name || "Utilisateur",
      role: user.role || "",
      displayRole,
    };

    // Broadcast own presence to all other tabs / users
    const announceOnline = () => {
      sendBroadcast("staff:online", myInfo);
    };

    const announceOffline = () => {
      sendBroadcast("staff:offline", { userId: user.id });
    };

    // Also do the doctor heartbeat API call (best-effort, doctors only)
    const beat = async () => {
      try {
        await api.post("/doctor/heartbeat");
        qc.invalidateQueries({ queryKey: DOCTORS_KEY });
      } catch {}
      announceOnline();
    };

    beat(); // immediate on mount
    const hb = setInterval(beat, HEARTBEAT_MS);

    const handleVisibility = () => {
      if (!document.hidden) announceOnline();
    };

    window.addEventListener("beforeunload", announceOffline);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(hb);
      window.removeEventListener("beforeunload", announceOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
      announceOffline();
      api.delete("/doctor/heartbeat").catch(() => {});
    };
  }, [user, qc, sendBroadcast]);

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

  // Merge current user into the list in case API hasn't registered them yet
  const allOnline = useMemo(() => {
    if (!user) return onlineDoctors;
    const alreadyIn = onlineDoctors.some(d => d.userId === user.id);
    if (alreadyIn) return onlineDoctors;
    const meEntry: OnlineDoctor = {
      userId: user.id,
      name: user.name || "Moi",
      role: user.role || "",
      displayRole: user.role === "assistant" ? "Secrétaire"
        : user.role === "admin" ? "Médecin Admin"
        : user.role === "doctor" ? "Médecin"
        : user.role || "Staff",
      specialty: null,
      isAvailable: true,
      lastSeenAt: new Date().toISOString(),
    };
    return [meEntry, ...onlineDoctors];
  }, [onlineDoctors, user]);

  return {
    onlineDoctors: allOnline,
    availableDoctors: allOnline.filter(d => d.isAvailable),
    myAvailability,
    broadcastAvailability,
    isDoctor,
    isSecretary: user?.role === "assistant",
  };
}
