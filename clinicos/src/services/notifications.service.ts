import api from "./api";
import type { Notification } from "@/types";

export const notificationsService = {
  async getAll(): Promise<Notification[]> {
    const res = await api.get<Notification[]>("/notifications");
    return res.data;
  },

  async getUnreadCount(): Promise<number> {
    const res = await api.get<number>("/notifications/unread-count");
    return res.data;
  },

  async markRead(id: string): Promise<void> {
    await api.patch(`/notifications/${id}/read`);
  },

  async markAllRead(): Promise<void> {
    await api.patch("/notifications/read-all");
  },
};
