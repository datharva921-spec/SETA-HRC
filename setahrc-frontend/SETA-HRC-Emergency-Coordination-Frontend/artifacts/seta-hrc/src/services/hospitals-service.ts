import { apiClient } from "../lib/api-client";
import type { Hospital } from "../lib/types";

export const hospitalsService = {
  getAll: async (): Promise<Hospital[]> => {
    const res = await apiClient.get<Hospital[]>("/hospitals");
    return res.data;
  },

  getById: async (id: string): Promise<Hospital> => {
    const res = await apiClient.get<Hospital>(`/hospitals/${id}`);
    return res.data;
  },

  updateResources: async (
    id: string,
    data: {
      beds_available?: number;
      beds_reserved?: number;
      beds_unavailable?: number;
      icu_available?: number;
      icu_reserved?: number;
      icu_unavailable?: number;
      oxygen_available?: boolean;
    }
  ): Promise<Hospital> => {
    const res = await apiClient.patch<Hospital>(`/hospitals/${id}/resources`, data);
    return res.data;
  },

  create: async (data: Partial<Hospital>): Promise<Hospital> => {
    const res = await apiClient.post<Hospital>("/hospitals", data);
    return res.data;
  },

  update: async (id: string, data: Partial<Hospital>): Promise<Hospital> => {
    const res = await apiClient.put<Hospital>(`/hospitals/${id}`, data);
    return res.data;
  }
};
