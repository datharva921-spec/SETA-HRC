import { apiClient } from "../lib/api-client";
import type { Ambulance } from "../lib/types";

export const ambulancesService = {
  getAll: async (): Promise<Ambulance[]> => {
    const res = await apiClient.get<Ambulance[]>("/ambulances");
    return res.data;
  },

  assign: async (emergencyId: string, ambulanceId: string): Promise<any> => {
    const res = await apiClient.post("/dispatch/assign", {
      emergency_id: emergencyId,
      ambulance_id: ambulanceId,
    });
    return res.data;
  },

  updateStatus: async (ambulanceId: string, status: string, location?: string): Promise<Ambulance> => {
    const res = await apiClient.patch<Ambulance>(`/ambulances/${ambulanceId}/status`, {
      status,
      location,
    });
    return res.data;
  },

  create: async (data: Partial<Ambulance>): Promise<Ambulance> => {
    const res = await apiClient.post<Ambulance>("/ambulances", data);
    return res.data;
  }
};
