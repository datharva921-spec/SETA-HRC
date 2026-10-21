import { apiClient } from "../lib/api-client";

export const referralsService = {
  decide: async (
    emergencyId: string,
    decision: "Accepted" | "Rejected",
    reason: string,
    hospitalId: string,
    reserveIcu: boolean = false
  ): Promise<any> => {
    const res = await apiClient.post(`/referrals/${emergencyId}/decision`, {
      decision,
      reason,
      hospital_id: hospitalId,
      reserve_icu: reserveIcu
    });
    return res.data;
  },

  reserve: async (
    emergencyId: string,
    hospitalId: string,
    resourceType: "bed" | "icu" | "oxygen",
    quantity: number = 1
  ): Promise<any> => {
    const res = await apiClient.post("/reservations", {
      emergency_id: emergencyId,
      hospital_id: hospitalId,
      resource_type: resourceType,
      quantity
    });
    return res.data;
  },

  releaseReservation: async (reservationId: number): Promise<any> => {
    const res = await apiClient.post(`/reservations/${reservationId}/release`);
    return res.data;
  },

  getReservations: async (params?: { emergency_id?: string; hospital_id?: string }): Promise<any[]> => {
    const res = await apiClient.get<any[]>("/reservations", { params });
    return res.data;
  }
};
