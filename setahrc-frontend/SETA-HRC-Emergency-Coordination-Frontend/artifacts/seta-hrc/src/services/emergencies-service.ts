import { apiClient } from "../lib/api-client";
import type { Emergency, EmergencyStatus, Priority } from "../lib/types";

export interface RecommendationFactorBreakdown {
  capability_fit: number;
  available_resources: number;
  route_distance_km: number;
  distance_score: number;
  operational_load: number;
  load_penalty: number;
}

export interface HospitalRecommendation {
  hospital_id: string;
  hospital_name: string;
  location: string;
  distance_km: number;
  rank: number;
  total_score: number;
  capability_score: number;
  resource_score: number;
  distance_score: number;
  load_score: number;
  factors: RecommendationFactorBreakdown;
  explanation: string;
  missing_data_flags: string[];
  beds_available: number;
  icu_available: number;
  oxygen_available: boolean;
  status: string;
}

export const emergenciesService = {
  getAll: async (params?: { search?: string; priority?: string; status?: string }): Promise<Emergency[]> => {
    const res = await apiClient.get<Emergency[]>("/emergencies", { params });
    return res.data;
  },

  getById: async (id: string): Promise<Emergency> => {
    const res = await apiClient.get<Emergency>(`/emergencies/${id}`);
    return res.data;
  },

  create: async (payload: {
    patient_name: string;
    age: number;
    caller_name: string;
    phone: string;
    location: string;
    lat?: number;
    lng?: number;
    symptoms: string;
    category: string;
  }): Promise<Emergency> => {
    const res = await apiClient.post<Emergency>("/emergencies", payload);
    return res.data;
  },

  updateStatus: async (id: string, status: EmergencyStatus, notes?: string): Promise<Emergency> => {
    const res = await apiClient.patch<Emergency>(`/emergencies/${id}/status`, { status, notes });
    return res.data;
  },

  updateTriage: async (id: string, priority: Priority, priority_reason: string): Promise<Emergency> => {
    const res = await apiClient.post<Emergency>(`/emergencies/${id}/triage`, { priority, priority_reason });
    return res.data;
  },

  getPriorityQueue: async (): Promise<Emergency[]> => {
    const res = await apiClient.get<Emergency[]>("/triage/queue");
    return res.data;
  },

  getRecommendations: async (emergencyId: string): Promise<HospitalRecommendation[]> => {
    const res = await apiClient.post<HospitalRecommendation[]>(`/emergencies/${emergencyId}/recommendations`);
    return res.data;
  },

  approveRecommendation: async (
    emergencyId: string,
    hospitalId: string,
    reason: string,
    override: boolean = false
  ): Promise<{ success: boolean; emergency_id: string; hospital_id: string; approval_status: string }> => {
    const res = await apiClient.post(`/emergencies/${emergencyId}/recommendations/approve`, {
      hospital_id: hospitalId,
      reason,
      override
    });
    return res.data;
  }
};
