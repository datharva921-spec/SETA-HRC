import { apiClient } from "../lib/api-client";
import type { Notification } from "../lib/types";

export const notificationsService = {
  getAll: async (): Promise<Notification[]> => {
    const res = await apiClient.get<Notification[]>("/notifications");
    return res.data;
  },

  markRead: async (id: string): Promise<any> => {
    const res = await apiClient.patch(`/notifications/${id}/read`);
    return res.data;
  }
};
