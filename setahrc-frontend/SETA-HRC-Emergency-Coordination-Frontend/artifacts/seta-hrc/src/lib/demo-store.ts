import * as React from "react";
import { seedAmbulances, seedAudit, seedEmergencies, seedHospitals, seedNotifications, seedUsers } from "./mock-data";
import type { Ambulance, AuditEvent, Emergency, Hospital, Notification, Priority, EmergencyStatus } from "./types";

let emergencies = structuredClone(seedEmergencies);
let hospitals = structuredClone(seedHospitals);
let ambulances = structuredClone(seedAmbulances);
let notifications = structuredClone(seedNotifications);
let audit = structuredClone(seedAudit);
let users = structuredClone(seedUsers);
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());
export const subscribeDemo = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const demoSnapshot = () => ({ emergencies, hospitals, ambulances, notifications, audit, users });
export function useDemoData() {
 const [, rerender] = React.useState(0);
 React.useEffect(() => subscribeDemo(() => rerender(n => n + 1)), []);
 return demoSnapshot();
}
export function createEmergency(input: Pick<Emergency,"patientName"|"age"|"callerName"|"phone"|"location"|"symptoms"|"category"> & {lat?:number;lng?:number}) {
 const now = new Date();
 const criticalWords = /chest pain|unconscious|not breathing|stroke|severe bleeding/i.test(input.symptoms);
 const priority: Priority = criticalWords ? "Critical" : input.category === "Trauma" || input.category === "Respiratory" ? "High" : "Moderate";
 const id = `SE-${String(24100 + emergencies.length).padStart(5,"0")}`;
 const coordinatesProvided=Number.isFinite(input.lat)&&Number.isFinite(input.lng);
 const record: Emergency = { ...input, id, lat:coordinatesProvided?input.lat!:12.9716, lng:coordinatesProvided?input.lng!:77.5946, coordinatesProvided, priority, priorityReason:criticalWords ? "Red-flag symptoms reported during intake" : "Initial symptom-based triage; clinical review required", status:"New", createdAt:now.toISOString(), assignedAmbulanceId:null, recommendedHospitalId:null, history:[{at:now.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),event:"Call received",actor:"Demo dispatcher"}] };
 emergencies = [record,...emergencies]; notify(); return record;
}
export function setEmergencyStatus(id:string,status:EmergencyStatus) { emergencies = emergencies.map(e => e.id===id ? {...e,status,history:[...e.history,{at:new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),event:`Status updated to ${status}`,actor:"Demo operator"}]} : e); notify(); }
export function assignAmbulance(emergencyId:string, ambulanceId:string) {
 emergencies = emergencies.map(e => e.id===emergencyId ? {...e,assignedAmbulanceId:ambulanceId,status:"Dispatched"} : e);
 ambulances = ambulances.map(a => a.id===ambulanceId ? {...a,status:"En route",assignedEmergencyId:emergencyId} : a); notify();
}
export function decideHospital(emergencyId:string,hospitalId:string,reason:string) {
 emergencies = emergencies.map(e => e.id===emergencyId ? {...e,recommendedHospitalId:hospitalId,history:[...e.history,{at:new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),event:"Hospital recommendation approved",actor:`Demo operator: ${reason}`}]} : e);
 notify();
}
export function decideIncomingCase(emergencyId:string,decision:"Accepted"|"Rejected",reason:string,hospitalId:string) {
 const time=new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
 emergencies=emergencies.map(e=>e.id===emergencyId?{...e,status:decision,history:[...e.history,{at:time,event:`Hospital ${decision.toLowerCase()} case`,actor:`Hospital team · ${reason}`}]}:e);
 addAudit(`Incoming case ${decision.toLowerCase()}`,`${emergencyId} · ${hospitalId}`,reason);
 notify();
}
export function updateResources(id:string, changes:Partial<Pick<Hospital,"bedsAvailable"|"bedsReserved"|"bedsUnavailable"|"icuAvailable"|"icuReserved"|"icuUnavailable"|"oxygenAvailable"|"departmentAvailability">>) { hospitals = hospitals.map(h=>h.id===id?{...h,...changes}:h); notify(); }
export function addHospital(input:Omit<Hospital,"id">) { const id=`H-${String(Date.now()).slice(-4)}`;hospitals=[...hospitals,{...input,id}];addAudit("Hospital added",`${id} · ${input.name}`,"Demo directory update");notify();return id; }
export function updateHospital(id:string,changes:Partial<Omit<Hospital,"id">>,reason:string) { hospitals=hospitals.map(h=>h.id===id?{...h,...changes}:h);const name=hospitals.find(h=>h.id===id)?.name||id;addAudit("Hospital details updated",`${id} · ${name}`,reason);notify(); }
export function addAmbulance(input:Omit<Ambulance,"id">) { const id=`A-${String(Date.now()).slice(-3)}`;ambulances=[...ambulances,{...input,id}];addAudit("Ambulance added",`${id} · ${input.unit}`,"Demo fleet update");notify();return id; }
export function updateAmbulance(id:string,changes:Partial<Omit<Ambulance,"id">>,reason:string) { ambulances=ambulances.map(a=>a.id===id?{...a,...changes}:a);const unit=ambulances.find(a=>a.id===id)?.unit||id;addAudit("Ambulance updated",`${id} · ${unit}`,reason);notify(); }
export function updateDemoUserStatus(id:string,status:string) { users=users.map(u=>u.id===id?{...u,status}:u);const user=users.find(u=>u.id===id);addAudit("Demo user status updated",user?.name||id,status);notify(); }
export function markNotificationRead(id:string) { notifications=notifications.map(n=>n.id===id?{...n,read:true}:n); notify(); }
export function addAudit(action:string,target:string,reason:string) { audit=[{id:`EV-${Date.now()}`,actor:"Demo operator",action,target,reason,createdAt:new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})},...audit]; notify(); }
export type { Ambulance, AuditEvent, Emergency, Hospital, Notification };
