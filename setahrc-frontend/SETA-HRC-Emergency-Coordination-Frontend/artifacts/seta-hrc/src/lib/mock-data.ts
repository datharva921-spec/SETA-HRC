import type { Ambulance, Emergency, Hospital, Notification, User, AuditEvent } from "./types";

export const seedEmergencies: Emergency[] = [
 {id:"SE-24091",patientName:"R. Sharma",age:62,callerName:"Anita Sharma",phone:"•••• 4812",location:"MG Road & Residency Rd, Bengaluru",lat:12.9718,lng:77.6012,symptoms:"Chest pressure, sweating, shortness of breath",category:"Cardiac",priority:"Critical",priorityReason:"Chest pain with dyspnea; possible acute coronary event",status:"New",createdAt:"2025-03-14T10:42:00Z",assignedAmbulanceId:null,recommendedHospitalId:"H-01",history:[{at:"10:42",event:"Call received",actor:"Control room"}]},
 {id:"SE-24090",patientName:"K. Narayan",age:34,callerName:"S. Narayan",phone:"•••• 1930",location:"Indiranagar 12th Main, Bengaluru",lat:12.9784,lng:77.6408,symptoms:"Fall from height, possible leg fracture",category:"Trauma",priority:"High",priorityReason:"Fall with suspected long-bone fracture; stable airway",status:"Dispatched",createdAt:"2025-03-14T10:28:00Z",assignedAmbulanceId:"A-04",recommendedHospitalId:"H-02",history:[{at:"10:28",event:"Call received",actor:"Control room"},{at:"10:31",event:"Unit A-04 assigned",actor:"Dispatch"}]},
 {id:"SE-24089",patientName:"M. Thomas",age:71,callerName:"Building security",phone:"•••• 7721",location:"Richmond Town, Bengaluru",lat:12.9649,lng:77.6083,symptoms:"Sudden weakness on right side, slurred speech",category:"Stroke",priority:"Critical",priorityReason:"FAST-positive stroke symptoms; time-sensitive intervention",status:"At scene",createdAt:"2025-03-14T10:14:00Z",assignedAmbulanceId:"A-02",recommendedHospitalId:"H-01",history:[{at:"10:14",event:"Call received",actor:"Control room"},{at:"10:18",event:"Unit A-02 assigned",actor:"Dispatch"},{at:"10:37",event:"Crew on scene",actor:"Paramedic"}]},
 {id:"SE-24088",patientName:"L. Devi",age:27,callerName:"L. Devi",phone:"•••• 2308",location:"Jayanagar 4th Block, Bengaluru",lat:12.9251,lng:77.5838,symptoms:"High fever, dehydration, dizziness",category:"Medical",priority:"Moderate",priorityReason:"Dehydration with dizziness; no red-flag symptoms reported",status:"Triaged",createdAt:"2025-03-14T09:56:00Z",assignedAmbulanceId:null,recommendedHospitalId:"H-03",history:[{at:"09:56",event:"Call received",actor:"Control room"}]},
 {id:"SE-24087",patientName:"A. Rao",age:45,callerName:"R. Rao",phone:"•••• 5144",location:"Koramangala 5th Block, Bengaluru",lat:12.9345,lng:77.6152,symptoms:"Deep cut to forearm, bleeding controlled",category:"Injury",priority:"Moderate",priorityReason:"Bleeding controlled; stable and alert",status:"Transporting",createdAt:"2025-03-14T09:33:00Z",assignedAmbulanceId:"A-07",recommendedHospitalId:"H-03",history:[{at:"09:33",event:"Call received",actor:"Control room"},{at:"09:38",event:"Unit A-07 assigned",actor:"Dispatch"}]},
 {id:"SE-24086",patientName:"S. Iyer",age:8,callerName:"P. Iyer",phone:"•••• 0331",location:"Malleshwaram 8th Cross, Bengaluru",lat:13.0036,lng:77.5701,symptoms:"Asthma flare, wheezing, inhaler not helping",category:"Respiratory",priority:"High",priorityReason:"Acute breathing difficulty despite rescue inhaler",status:"New",createdAt:"2025-03-14T09:22:00Z",assignedAmbulanceId:null,recommendedHospitalId:"H-02",history:[{at:"09:22",event:"Call received",actor:"Control room"}]}
];
export const seedHospitals: Hospital[] = [
 {id:"H-01",name:"St. Martha's Medical Centre",location:"Vasanth Nagar",lat:12.9846,lng:77.5977,distanceKm:2.4,capabilities:["Cardiac","Stroke","Trauma","ICU"],departments:["Emergency","Cardiology","Neurology"],departmentAvailability:[{department:"Emergency",available:true},{department:"Cardiology",available:true},{department:"Neurology",available:true}],bedsAvailable:18,bedsReserved:5,bedsUnavailable:2,icuAvailable:4,icuReserved:1,icuUnavailable:1,oxygenAvailable:true,status:"Available"},
 {id:"H-02",name:"Bengaluru Central Hospital",location:"Indiranagar",lat:12.9788,lng:77.6406,distanceKm:4.1,capabilities:["Trauma","Pediatrics","Respiratory","ICU"],departments:["Emergency","Orthopedics","Pediatrics"],departmentAvailability:[{department:"Emergency",available:true},{department:"Orthopedics",available:true},{department:"Pediatrics",available:false}],bedsAvailable:11,bedsReserved:4,bedsUnavailable:1,icuAvailable:2,icuReserved:1,icuUnavailable:1,oxygenAvailable:true,status:"Available"},
 {id:"H-03",name:"Cauvery City Hospital",location:"Jayanagar",lat:12.9252,lng:77.5838,distanceKm:5.8,capabilities:["General","Injury","Medical","ICU"],departments:["Emergency","Internal Medicine","Surgery"],departmentAvailability:[{department:"Emergency",available:true},{department:"Internal Medicine",available:true},{department:"Surgery",available:true}],bedsAvailable:23,bedsReserved:7,bedsUnavailable:3,icuAvailable:3,icuReserved:1,icuUnavailable:1,oxygenAvailable:true,status:"Available"},
 {id:"H-04",name:"Eastside Community Hospital",location:"Domlur",lat:12.9609,lng:77.6387,distanceKm:6.2,capabilities:["General","Cardiac"],departments:["Emergency","General Medicine"],departmentAvailability:[{department:"Emergency",available:true},{department:"General Medicine",available:false}],bedsAvailable:6,bedsReserved:3,bedsUnavailable:2,icuAvailable:0,icuReserved:0,icuUnavailable:4,oxygenAvailable:false,status:"Busy"}
];
export const seedAmbulances: Ambulance[] = [
 {id:"A-02",unit:"KA-01-G-2202",status:"At scene",paramedicName:"Priya Menon",location:"Richmond Town",assignedEmergencyId:"SE-24089"},
 {id:"A-04",unit:"KA-01-G-4810",status:"En route",paramedicName:"Arjun Rao",location:"Indiranagar",assignedEmergencyId:"SE-24090"},
 {id:"A-07",unit:"KA-01-G-1097",status:"Transporting",paramedicName:"Meera Das",location:"Koramangala",assignedEmergencyId:"SE-24087"},
 {id:"A-09",unit:"KA-01-G-6821",status:"Available",paramedicName:"Dev Kulkarni",location:"Central Station",assignedEmergencyId:null},
 {id:"A-11",unit:"KA-01-G-9034",status:"Available",paramedicName:"Nisha Bhat",location:"Jayanagar Station",assignedEmergencyId:null}
];
export const seedUsers: User[] = [
 {id:"U-01",name:"Asha Nair",email:"asha.nair@seta-hrc.org",trustedRole:"dispatcher",status:"Active"},
 {id:"U-02",name:"Dr. Rohan Shetty",email:"rohan.shetty@seta-hrc.org",trustedRole:"hospital",status:"Active"},
 {id:"U-03",name:"Priya Menon",email:"priya.menon@seta-hrc.org",trustedRole:"paramedic",status:"Active"},
 {id:"U-04",name:"Operations Admin",email:"ops@seta-hrc.org",trustedRole:"admin",status:"Active"}
];
export const seedNotifications: Notification[] = [
 {id:"N-01",title:"Critical case awaiting triage",message:"SE-24091 · Cardiac emergency near MG Road",type:"urgent",createdAt:"10:42",read:false},
 {id:"N-02",title:"Ambulance unit A-04 en route",message:"SE-24090 · ETA 6 minutes to pickup",type:"info",createdAt:"10:35",read:false},
 {id:"N-03",title:"Hospital capacity updated",message:"Eastside Community Hospital · ICU capacity full",type:"notice",createdAt:"10:19",read:true}
];
export const seedAudit: AuditEvent[] = [
 {id:"EV-091",actor:"Asha Nair",action:"Ambulance assigned",target:"SE-24090 · A-04",reason:"Closest available unit",createdAt:"10:31"},
 {id:"EV-090",actor:"Dr. Rohan Shetty",action:"ICU capacity updated",target:"St. Martha's Medical Centre",reason:"Shift handover",createdAt:"10:19"},
 {id:"EV-089",actor:"Asha Nair",action:"Priority confirmed: Critical",target:"SE-24089",reason:"FAST-positive symptoms",createdAt:"10:18"}
];
