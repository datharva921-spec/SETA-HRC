export type Role = "dispatcher" | "hospital" | "paramedic" | "admin";
export type Priority = "Critical" | "High" | "Moderate" | "Low";
export type EmergencyStatus = "New" | "Triaged" | "Dispatched" | "At scene" | "Transporting" | "Arrived" | "Accepted" | "Rejected" | "Closed";

export interface Emergency {
  id: string;
  patientName: string;
  patient_name?: string;
  age: number;
  callerName: string;
  caller_name?: string;
  phone: string;
  location: string;
  lat: number;
  lng: number;
  coordinatesProvided?: boolean;
  coordinates_provided?: boolean;
  symptoms: string;
  category: string;
  priority: Priority;
  priorityReason: string;
  priority_reason?: string;
  status: EmergencyStatus;
  createdAt: string;
  created_at?: string;
  assignedAmbulanceId: string | null;
  assigned_ambulance_id?: string | null;
  recommendedHospitalId: string | null;
  recommended_hospital_id?: string | null;
  approvalStatus?: string | null;
  approval_status?: string | null;
  approvalReason?: string | null;
  approval_reason?: string | null;
  handoverNotes?: string | null;
  handover_notes?: string | null;
  history: { at: string; event: string; actor: string }[];
}

export interface Hospital {
  id: string;
  name: string;
  location: string;
  lat: number;
  lng: number;
  distanceKm: number;
  distance_km?: number;
  capabilities: string[];
  departments: string[];
  departmentAvailability: { department: string; available: boolean }[];
  department_availability?: { department: string; available: boolean }[];
  bedsAvailable: number;
  beds_available?: number;
  bedsReserved: number;
  beds_reserved?: number;
  bedsUnavailable: number;
  beds_unavailable?: number;
  icuAvailable: number;
  icu_available?: number;
  icuReserved: number;
  icu_reserved?: number;
  icuUnavailable: number;
  icu_unavailable?: number;
  oxygenAvailable: boolean;
  oxygen_available?: boolean;
  status: "Available" | "Busy" | "Offline";
  operationalLoad?: number;
  operational_load?: number;
}

export interface Ambulance {
  id: string;
  unit: string;
  status: string;
  paramedicName: string;
  paramedic_name?: string;
  location: string;
  assignedEmergencyId: string | null;
  assigned_emergency_id?: string | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
  trustedRole: Role | null;
  trusted_role?: Role | null;
  role?: Role | null;
  status: string;
  hospital_id?: string | null;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  createdAt: string;
  created_at?: string;
  read: boolean;
}

export interface AuditEvent {
  id: string;
  actor: string;
  action: string;
  target: string;
  reason: string;
  createdAt: string;
  created_at?: string;
}

export function normalizeEmergency(raw: any): Emergency {
  return {
    id: raw.id,
    patientName: raw.patientName ?? raw.patient_name ?? "Unknown",
    age: Number(raw.age ?? 0),
    callerName: raw.callerName ?? raw.caller_name ?? "",
    phone: raw.phone ?? "",
    location: raw.location ?? "",
    lat: Number(raw.lat ?? 12.9716),
    lng: Number(raw.lng ?? 77.5946),
    coordinatesProvided: Boolean(raw.coordinatesProvided ?? raw.coordinates_provided),
    symptoms: raw.symptoms ?? "",
    category: raw.category ?? "Medical",
    priority: (raw.priority ?? "Moderate") as Priority,
    priorityReason: raw.priorityReason ?? raw.priority_reason ?? "Triage assessment",
    status: (raw.status ?? "New") as EmergencyStatus,
    createdAt: raw.createdAt ?? raw.created_at ?? new Date().toISOString(),
    assignedAmbulanceId: raw.assignedAmbulanceId ?? raw.assigned_ambulance_id ?? null,
    recommendedHospitalId: raw.recommendedHospitalId ?? raw.recommended_hospital_id ?? null,
    approvalStatus: raw.approvalStatus ?? raw.approval_status ?? null,
    approvalReason: raw.approvalReason ?? raw.approval_reason ?? null,
    handoverNotes: raw.handoverNotes ?? raw.handover_notes ?? null,
    history: Array.isArray(raw.history) ? raw.history : []
  };
}

export function normalizeHospital(raw: any): Hospital {
  const deptAvail = raw.departmentAvailability ?? raw.department_availability ?? [];
  return {
    id: raw.id,
    name: raw.name,
    location: raw.location,
    lat: Number(raw.lat ?? 0),
    lng: Number(raw.lng ?? 0),
    distanceKm: Number(raw.distanceKm ?? raw.distance_km ?? 0),
    capabilities: Array.isArray(raw.capabilities) ? raw.capabilities : [],
    departments: Array.isArray(raw.departments) ? raw.departments : [],
    departmentAvailability: Array.isArray(deptAvail) ? deptAvail : [],
    bedsAvailable: Number(raw.bedsAvailable ?? raw.beds_available ?? 0),
    bedsReserved: Number(raw.bedsReserved ?? raw.beds_reserved ?? 0),
    bedsUnavailable: Number(raw.bedsUnavailable ?? raw.beds_unavailable ?? 0),
    icuAvailable: Number(raw.icuAvailable ?? raw.icu_available ?? 0),
    icuReserved: Number(raw.icuReserved ?? raw.icu_reserved ?? 0),
    icuUnavailable: Number(raw.icuUnavailable ?? raw.icu_unavailable ?? 0),
    oxygenAvailable: Boolean(raw.oxygenAvailable ?? raw.oxygen_available),
    status: (raw.status ?? "Available") as any,
    operationalLoad: Number(raw.operationalLoad ?? raw.operational_load ?? 0.5)
  };
}

export function normalizeAmbulance(raw: any): Ambulance {
  return {
    id: raw.id,
    unit: raw.unit,
    status: raw.status ?? "Available",
    paramedicName: raw.paramedicName ?? raw.paramedic_name ?? "Paramedic",
    location: raw.location ?? "Central Station",
    assignedEmergencyId: raw.assignedEmergencyId ?? raw.assigned_emergency_id ?? null
  };
}

export function normalizeNotification(raw: any): Notification {
  const at = raw.createdAt ?? raw.created_at ?? "";
  const timeStr = typeof at === "string" && at.includes("T") ? new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : at;
  return {
    id: raw.id,
    title: raw.title,
    message: raw.message,
    type: raw.type ?? "notice",
    createdAt: timeStr || "Just now",
    read: Boolean(raw.read)
  };
}

export function normalizeAudit(raw: any): AuditEvent {
  const at = raw.createdAt ?? raw.created_at ?? "";
  const timeStr = typeof at === "string" && at.includes("T") ? new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : at;
  return {
    id: raw.id,
    actor: raw.actor ?? "System",
    action: raw.action,
    target: raw.target,
    reason: raw.reason ?? "",
    createdAt: timeStr || "Just now"
  };
}
