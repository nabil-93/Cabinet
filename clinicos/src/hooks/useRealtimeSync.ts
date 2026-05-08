"use client";
/**
 * Thin wrapper — delegates to RealtimeProvider context.
 * No channel creation here; the singleton lives in AppLayout → RealtimeProvider.
 */
export { useRealtimeContext as useRealtimeSync } from "@/providers/RealtimeProvider";
export type { ConnectionStatus } from "@/providers/RealtimeProvider";
