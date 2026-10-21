import { useState, useEffect, useCallback } from "react";
import { emergenciesService } from "../services/emergencies-service";
import { hospitalsService } from "../services/hospitals-service";
import { ambulancesService } from "../services/ambulances-service";
import { referralsService } from "../services/referrals-service";
import { analyticsService, type DashboardMetrics } from "../services/analytics-service";
import { notificationsService } from "../services/notifications-service";
import { authService } from "../services/auth-service";
import { useWebSocketUpdates } from "../lib/use-websocket";
import {
  type Emergency,
  type Hospital,
  type Ambulance,
  type Notification,
  type AuditEvent,
  type User,
  normalizeEmergency,
  normalizeHospital,
  normalizeAmbulance,
  normalizeNotification,
  normalizeAudit,
  type EmergencyStatus,
  type Priority
} from "../lib/types";

export function useLiveOperations() {
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [ambulances, setAmbulances] = useState<Ambulance[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshAll = useCallback(async () => {
    try {
      setError(null);
      const [emRes, hospRes, ambRes, notifRes, audRes, metRes] = await Promise.allSettled([
        emergenciesService.getAll(),
        hospitalsService.getAll(),
        ambulancesService.getAll(),
        notificationsService.getAll(),
        analyticsService.getAuditLogs({ limit: 50 }),
        analyticsService.getMetrics()
      ]);

      if (emRes.status === "fulfilled") setEmergencies(emRes.value.map(normalizeEmergency));
      if (hospRes.status === "fulfilled") setHospitals(hospRes.value.map(normalizeHospital));
      if (ambRes.status === "fulfilled") setAmbulances(ambRes.value.map(normalizeAmbulance));
      if (notifRes.status === "fulfilled") setNotifications(notifRes.value.map(normalizeNotification));
      if (audRes.status === "fulfilled") setAudit(audRes.value.map(normalizeAudit));
      if (metRes.status === "fulfilled") setMetrics(metRes.value);

      // Attempt users if admin
      try {
        const uList = await authService.getUsers();
        setUsers(uList.map((u: any) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          trustedRole: u.trusted_role || u.role,
          status: u.status,
          hospital_id: u.hospital_id
        })));
      } catch {
        // Ignored if user lacks admin role
      }
    } catch (err: any) {
      setError(err?.message || "Failed to synchronize operational state.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Live WebSocket broadcast listener
  useWebSocketUpdates(useCallback(() => {
    // Automatically re-sync when another dispatcher/user acts
    refreshAll();
  }, [refreshAll]));

  const createEmergency = async (payload: {
    patientName: string;
    age: number;
    callerName: string;
    phone: string;
    location: string;
    lat?: number;
    lng?: number;
    symptoms: string;
    category: string;
  }) => {
    const res = await emergenciesService.create({
      patient_name: payload.patientName,
      age: payload.age,
      caller_name: payload.callerName,
      phone: payload.phone,
      location: payload.location,
      lat: payload.lat,
      lng: payload.lng,
      symptoms: payload.symptoms,
      category: payload.category
    });
    const normalized = normalizeEmergency(res);
    setEmergencies((prev) => [normalized, ...prev]);
    refreshAll();
    return normalized;
  };

  const setEmergencyStatus = async (id: string, status: EmergencyStatus, notes?: string) => {
    const res = await emergenciesService.updateStatus(id, status, notes);
    const normalized = normalizeEmergency(res);
    setEmergencies((prev) => prev.map((e) => (e.id === id ? normalized : e)));
    refreshAll();
    return normalized;
  };

  const updateTriage = async (id: string, priority: Priority, reason: string) => {
    const res = await emergenciesService.updateTriage(id, priority, reason);
    const normalized = normalizeEmergency(res);
    setEmergencies((prev) => prev.map((e) => (e.id === id ? normalized : e)));
    refreshAll();
    return normalized;
  };

  const assignAmbulance = async (emergencyId: string, ambulanceId: string) => {
    const res = await ambulancesService.assign(emergencyId, ambulanceId);
    await refreshAll();
    return res;
  };

  const approveHospital = async (emergencyId: string, hospitalId: string, reason: string, override: boolean = false) => {
    const res = await emergenciesService.approveRecommendation(emergencyId, hospitalId, reason, override);
    await refreshAll();
    return res;
  };

  const decideIncomingCase = async (emergencyId: string, decision: "Accepted" | "Rejected", reason: string, hospitalId: string, reserveIcu: boolean = false) => {
    const res = await referralsService.decide(emergencyId, decision, reason, hospitalId, reserveIcu);
    await refreshAll();
    return res;
  };

  const updateResources = async (id: string, data: {
    beds_available?: number;
    icu_available?: number;
    oxygen_available?: boolean;
  }) => {
    const res = await hospitalsService.updateResources(id, data);
    const normalized = normalizeHospital(res);
    setHospitals((prev) => prev.map((h) => (h.id === id ? normalized : h)));
    refreshAll();
    return normalized;
  };

  const markNotificationRead = async (id: string) => {
    await notificationsService.markRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  return {
    emergencies,
    hospitals,
    ambulances,
    notifications,
    audit,
    users,
    metrics,
    loading,
    error,
    refreshAll,
    createEmergency,
    setEmergencyStatus,
    updateTriage,
    assignAmbulance,
    approveHospital,
    decideIncomingCase,
    updateResources,
    markNotificationRead
  };
}
