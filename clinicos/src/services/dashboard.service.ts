import api from "./api";
import type { DashboardStats, RevenueData } from "@/types";

export const dashboardService = {
  async getStats(): Promise<DashboardStats> {
    const res = await api.get<DashboardStats>("/dashboard/stats");
    return res.data;
  },

  async getRevenueData(): Promise<RevenueData[]> {
    const res = await api.get<RevenueData[]>("/dashboard/revenue");
    return res.data;
  },
};
