"use client";
import { useQuery } from "@tanstack/react-query";
import { dashboardService } from "@/services/dashboard.service";

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: dashboardService.getStats,
    staleTime: 0,
    refetchInterval: 15_000,
  });
}

export function useRevenueData() {
  return useQuery({
    queryKey: ["dashboard", "revenue"],
    queryFn: dashboardService.getRevenueData,
    staleTime: 300_000,
  });
}
