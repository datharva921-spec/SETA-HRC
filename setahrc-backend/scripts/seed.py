import sys
import os
from datetime import datetime, timedelta, timezone

# Ensure parent directory is on python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import engine, Base, SessionLocal
import app.models  # Register models
from app.models.user import User
from app.models.hospital import Hospital
from app.models.ambulance import Ambulance
from app.models.emergency import Emergency, EmergencyHistory
from app.models.recommendation import HospitalRecommendation
from app.models.reservation import ResourceReservation, ResourceHistory
from app.models.notification import Notification
from app.models.audit import AuditLog
from app.core.security import get_password_hash


def seed_database():
    print("==================================================")
    print("SETA-HRC: Seeding Demonstration Sample Data")
    print("SIMULATION ENVIRONMENT - ALL DATA IS FICTIONAL")
    print("==================================================")

    # Ensure tables exist
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        now = datetime.now(timezone.utc).replace(tzinfo=None)

        # ----------------------------------------------------
        # 1. Users (Role demonstration accounts)
        # ----------------------------------------------------
        users_data = [
            {
                "id": "U-01",
                "name": "Asha Nair",
                "email": "asha.nair@seta-hrc.org",
                "password": get_password_hash("Dispatcher@123"),
                "role": "dispatcher",
                "status": "Active",
                "hospital_id": None
            },
            {
                "id": "U-02",
                "name": "Dr. Rohan Shetty",
                "email": "rohan.shetty@seta-hrc.org",
                "password": get_password_hash("Hospital@123"),
                "role": "hospital",
                "status": "Active",
                "hospital_id": "H-01"
            },
            {
                "id": "U-03",
                "name": "Priya Menon",
                "email": "priya.menon@seta-hrc.org",
                "password": get_password_hash("Paramedic@123"),
                "role": "paramedic",
                "status": "Active",
                "hospital_id": None
            },
            {
                "id": "U-04",
                "name": "Operations Admin",
                "email": "ops@seta-hrc.org",
                "password": get_password_hash("Admin@123"),
                "role": "admin",
                "status": "Active",
                "hospital_id": None
            }
        ]

        for u in users_data:
            existing = db.query(User).filter(User.id == u["id"]).first()
            if not existing:
                db.add(User(
                    id=u["id"],
                    name=u["name"],
                    email=u["email"],
                    hashed_password=u["password"],
                    role=u["role"],
                    status=u["status"],
                    hospital_id=u["hospital_id"],
                    created_at=now,
                    updated_at=now
                ))
            else:
                existing.name = u["name"]
                existing.email = u["email"]
                existing.hashed_password = u["password"]
                existing.role = u["role"]
                existing.status = u["status"]
                existing.hospital_id = u["hospital_id"]
        db.commit()
        print(f"[OK] Seeded {len(users_data)} demonstration user accounts.")

        # ----------------------------------------------------
        # 2. Simulated Hospitals (At least 5 diverse hospitals)
        # ----------------------------------------------------
        hospitals_data = [
            {
                "id": "H-01",
                "name": "St. Martha's Medical Centre",
                "location": "Vasanth Nagar, Bengaluru",
                "lat": 12.9846,
                "lng": 77.5977,
                "distance_km": 2.4,
                "capabilities": ["Cardiac", "Stroke", "Trauma", "ICU", "General"],
                "departments": ["Emergency", "Cardiology", "Neurology", "Intensive Care"],
                "department_availability": [
                    {"department": "Emergency", "available": True},
                    {"department": "Cardiology", "available": True},
                    {"department": "Neurology", "available": True},
                    {"department": "Intensive Care", "available": True}
                ],
                "beds_available": 18,
                "beds_reserved": 5,
                "beds_unavailable": 2,
                "icu_available": 4,
                "icu_reserved": 1,
                "icu_unavailable": 1,
                "oxygen_available": True,
                "status": "Available",
                "operational_load": 0.45
            },
            {
                "id": "H-02",
                "name": "Bengaluru Central Hospital",
                "location": "Indiranagar, Bengaluru",
                "lat": 12.9788,
                "lng": 77.6406,
                "distance_km": 4.1,
                "capabilities": ["Trauma", "Pediatrics", "Respiratory", "ICU", "General"],
                "departments": ["Emergency", "Orthopedics", "Pediatrics", "Pulmonology"],
                "department_availability": [
                    {"department": "Emergency", "available": True},
                    {"department": "Orthopedics", "available": True},
                    {"department": "Pediatrics", "available": False},
                    {"department": "Pulmonology", "available": True}
                ],
                "beds_available": 11,
                "beds_reserved": 4,
                "beds_unavailable": 1,
                "icu_available": 2,
                "icu_reserved": 1,
                "icu_unavailable": 1,
                "oxygen_available": True,
                "status": "Available",
                "operational_load": 0.60
            },
            {
                "id": "H-03",
                "name": "Cauvery City Hospital",
                "location": "Jayanagar, Bengaluru",
                "lat": 12.9252,
                "lng": 77.5838,
                "distance_km": 5.8,
                "capabilities": ["General", "Injury", "Medical", "Surgery", "ICU"],
                "departments": ["Emergency", "Internal Medicine", "General Surgery"],
                "department_availability": [
                    {"department": "Emergency", "available": True},
                    {"department": "Internal Medicine", "available": True},
                    {"department": "General Surgery", "available": True}
                ],
                "beds_available": 23,
                "beds_reserved": 7,
                "beds_unavailable": 3,
                "icu_available": 3,
                "icu_reserved": 1,
                "icu_unavailable": 1,
                "oxygen_available": True,
                "status": "Available",
                "operational_load": 0.50
            },
            {
                "id": "H-04",
                "name": "Eastside Community Hospital",
                "location": "Domlur, Bengaluru",
                "lat": 12.9609,
                "lng": 77.6387,
                "distance_km": 6.2,
                "capabilities": ["General", "Cardiac"],
                "departments": ["Emergency", "General Medicine"],
                "department_availability": [
                    {"department": "Emergency", "available": True},
                    {"department": "General Medicine", "available": False}
                ],
                "beds_available": 6,
                "beds_reserved": 3,
                "beds_unavailable": 2,
                "icu_available": 0,
                "icu_reserved": 0,
                "icu_unavailable": 4,
                "oxygen_available": False,
                "status": "Busy",
                "operational_load": 0.88
            },
            {
                "id": "H-05",
                "name": "Victoria Memorial Super Specialty",
                "location": "Fort Road, Kalasipalya, Bengaluru",
                "lat": 12.9628,
                "lng": 77.5755,
                "distance_km": 3.2,
                "capabilities": ["Trauma", "Cardiac", "Stroke", "Burns", "ICU", "General"],
                "departments": ["Emergency Trauma Centre", "Cardiology", "Burns Unit", "Critical Care"],
                "department_availability": [
                    {"department": "Emergency Trauma Centre", "available": True},
                    {"department": "Cardiology", "available": True},
                    {"department": "Burns Unit", "available": True},
                    {"department": "Critical Care", "available": True}
                ],
                "beds_available": 32,
                "beds_reserved": 12,
                "beds_unavailable": 4,
                "icu_available": 8,
                "icu_reserved": 3,
                "icu_unavailable": 2,
                "oxygen_available": True,
                "status": "Available",
                "operational_load": 0.40
            }
        ]

        for h in hospitals_data:
            existing = db.query(Hospital).filter(Hospital.id == h["id"]).first()
            if not existing:
                db.add(Hospital(
                    id=h["id"],
                    name=h["name"],
                    location=h["location"],
                    lat=h["lat"],
                    lng=h["lng"],
                    distance_km=h["distance_km"],
                    capabilities=h["capabilities"],
                    departments=h["departments"],
                    department_availability=h["department_availability"],
                    beds_available=h["beds_available"],
                    beds_reserved=h["beds_reserved"],
                    beds_unavailable=h["beds_unavailable"],
                    icu_available=h["icu_available"],
                    icu_reserved=h["icu_reserved"],
                    icu_unavailable=h["icu_unavailable"],
                    oxygen_available=h["oxygen_available"],
                    status=h["status"],
                    operational_load=h["operational_load"],
                    created_at=now,
                    updated_at=now
                ))
            else:
                for k, v in h.items():
                    setattr(existing, k, v)
        db.commit()
        print(f"[OK] Seeded {len(hospitals_data)} simulated hospitals with distinct capacities.")

        # ----------------------------------------------------
        # 3. Simulated Ambulances (At least 5 diverse units)
        # ----------------------------------------------------
        ambulances_data = [
            {
                "id": "A-02",
                "unit": "KA-01-G-2202",
                "status": "At scene",
                "paramedic_name": "Priya Menon",
                "location": "Richmond Town",
                "lat": 12.9649,
                "lng": 77.6083,
                "assigned_emergency_id": "SE-24089"
            },
            {
                "id": "A-04",
                "unit": "KA-01-G-4810",
                "status": "En route",
                "paramedic_name": "Arjun Rao",
                "location": "Indiranagar",
                "lat": 12.9784,
                "lng": 77.6408,
                "assigned_emergency_id": "SE-24090"
            },
            {
                "id": "A-07",
                "unit": "KA-01-G-1097",
                "status": "Transporting",
                "paramedic_name": "Meera Das",
                "location": "Koramangala",
                "lat": 12.9345,
                "lng": 77.6152,
                "assigned_emergency_id": "SE-24087"
            },
            {
                "id": "A-09",
                "unit": "KA-01-G-6821",
                "status": "Available",
                "paramedic_name": "Dev Kulkarni",
                "location": "Central Station",
                "lat": 12.9716,
                "lng": 77.5946,
                "assigned_emergency_id": None
            },
            {
                "id": "A-11",
                "unit": "KA-01-G-9034",
                "status": "Available",
                "paramedic_name": "Nisha Bhat",
                "location": "Jayanagar Station",
                "lat": 12.9251,
                "lng": 77.5838,
                "assigned_emergency_id": None
            },
            {
                "id": "A-14",
                "unit": "KA-01-G-3312",
                "status": "Available",
                "paramedic_name": "Karthik Suresh",
                "location": "Malleshwaram Station",
                "lat": 13.0036,
                "lng": 77.5701,
                "assigned_emergency_id": None
            }
        ]

        for a in ambulances_data:
            existing = db.query(Ambulance).filter(Ambulance.id == a["id"]).first()
            if not existing:
                db.add(Ambulance(
                    id=a["id"],
                    unit=a["unit"],
                    status=a["status"],
                    paramedic_name=a["paramedic_name"],
                    location=a["location"],
                    lat=a["lat"],
                    lng=a["lng"],
                    assigned_emergency_id=a["assigned_emergency_id"],
                    created_at=now,
                    updated_at=now
                ))
            else:
                for k, v in a.items():
                    setattr(existing, k, v)
        db.commit()
        print(f"[OK] Seeded {len(ambulances_data)} simulated ambulances.")

        # ----------------------------------------------------
        # 4. Fictional Emergency Cases (Across priorities)
        # ----------------------------------------------------
        emergencies_data = [
            {
                "id": "SE-24091",
                "patient_name": "R. Sharma",
                "age": 62,
                "caller_name": "Anita Sharma",
                "phone": "•••• 4812",
                "location": "MG Road & Residency Rd, Bengaluru",
                "lat": 12.9718,
                "lng": 77.6012,
                "coordinates_provided": True,
                "symptoms": "Chest pressure, sweating, shortness of breath",
                "category": "Cardiac",
                "priority": "Critical",
                "priority_reason": "Red-flag cue identified ('chest pressure'); possible acute coronary event",
                "status": "New",
                "assigned_ambulance_id": None,
                "recommended_hospital_id": "H-01",
                "approval_status": "Approved",
                "approval_reason": "Top capability fit for Cardiology with available ICU beds.",
                "created_at": now - timedelta(minutes=15)
            },
            {
                "id": "SE-24090",
                "patient_name": "K. Narayan",
                "age": 34,
                "caller_name": "S. Narayan",
                "phone": "•••• 1930",
                "location": "Indiranagar 12th Main, Bengaluru",
                "lat": 12.9784,
                "lng": 77.6408,
                "coordinates_provided": True,
                "symptoms": "Fall from height, possible leg fracture",
                "category": "Trauma",
                "priority": "High",
                "priority_reason": "High-acuity clinical indicator identified ('fall from height'); stable airway",
                "status": "Dispatched",
                "assigned_ambulance_id": "A-04",
                "recommended_hospital_id": "H-02",
                "approval_status": "Approved",
                "approval_reason": "Proximity and active orthopedic emergency coverage",
                "created_at": now - timedelta(minutes=30)
            },
            {
                "id": "SE-24089",
                "patient_name": "M. Thomas",
                "age": 71,
                "caller_name": "Building security",
                "phone": "•••• 7721",
                "location": "Richmond Town, Bengaluru",
                "lat": 12.9649,
                "lng": 77.6083,
                "coordinates_provided": True,
                "symptoms": "Sudden weakness on right side, slurred speech",
                "category": "Stroke",
                "priority": "Critical",
                "priority_reason": "FAST-positive stroke symptoms; time-sensitive neurovascular intervention",
                "status": "At scene",
                "assigned_ambulance_id": "A-02",
                "recommended_hospital_id": "H-01",
                "approval_status": "Approved",
                "approval_reason": "Comprehensive stroke centre nearest to Richmond Town",
                "created_at": now - timedelta(minutes=45)
            },
            {
                "id": "SE-24088",
                "patient_name": "L. Devi",
                "age": 27,
                "caller_name": "L. Devi",
                "phone": "•••• 2308",
                "location": "Jayanagar 4th Block, Bengaluru",
                "lat": 12.9251,
                "lng": 77.5838,
                "coordinates_provided": True,
                "symptoms": "High fever, dehydration, dizziness",
                "category": "Medical",
                "priority": "Moderate",
                "priority_reason": "Dehydration with dizziness; no red-flag symptoms reported",
                "status": "Triaged",
                "assigned_ambulance_id": None,
                "recommended_hospital_id": "H-03",
                "approval_status": None,
                "approval_reason": None,
                "created_at": now - timedelta(hours=1, minutes=10)
            },
            {
                "id": "SE-24087",
                "patient_name": "A. Rao",
                "age": 45,
                "caller_name": "R. Rao",
                "phone": "•••• 5144",
                "location": "Koramangala 5th Block, Bengaluru",
                "lat": 12.9345,
                "lng": 77.6152,
                "coordinates_provided": True,
                "symptoms": "Deep cut to forearm, bleeding controlled",
                "category": "Injury",
                "priority": "Moderate",
                "priority_reason": "Bleeding controlled; stable vitals",
                "status": "Transporting",
                "assigned_ambulance_id": "A-07",
                "recommended_hospital_id": "H-03",
                "approval_status": "Approved",
                "approval_reason": "General surgery / injury coverage",
                "created_at": now - timedelta(hours=1, minutes=45)
            },
            {
                "id": "SE-24086",
                "patient_name": "S. Iyer",
                "age": 8,
                "caller_name": "P. Iyer",
                "phone": "•••• 0331",
                "location": "Malleshwaram 8th Cross, Bengaluru",
                "lat": 13.0036,
                "lng": 77.5701,
                "coordinates_provided": True,
                "symptoms": "Asthma flare, wheezing, inhaler not helping",
                "category": "Respiratory",
                "priority": "High",
                "priority_reason": "Acute breathing difficulty despite rescue inhaler",
                "status": "New",
                "assigned_ambulance_id": None,
                "recommended_hospital_id": "H-02",
                "approval_status": None,
                "approval_reason": None,
                "created_at": now - timedelta(hours=2)
            }
        ]

        for e in emergencies_data:
            existing = db.query(Emergency).filter(Emergency.id == e["id"]).first()
            if not existing:
                em = Emergency(
                    id=e["id"],
                    patient_name=e["patient_name"],
                    age=e["age"],
                    caller_name=e["caller_name"],
                    phone=e["phone"],
                    location=e["location"],
                    lat=e["lat"],
                    lng=e["lng"],
                    coordinates_provided=e["coordinates_provided"],
                    symptoms=e["symptoms"],
                    category=e["category"],
                    priority=e["priority"],
                    priority_reason=e["priority_reason"],
                    status=e["status"],
                    assigned_ambulance_id=e["assigned_ambulance_id"],
                    recommended_hospital_id=e["recommended_hospital_id"],
                    approval_status=e["approval_status"],
                    approval_reason=e["approval_reason"],
                    created_at=e["created_at"],
                    updated_at=e["created_at"]
                )
                db.add(em)
                db.flush()

                # Add initial history event
                hist = EmergencyHistory(
                    emergency_id=e["id"],
                    at_time=e["created_at"].strftime("%H:%M"),
                    event="Call received & registered",
                    actor="Control room dispatcher",
                    created_at=e["created_at"]
                )
                db.add(hist)

                if e["assigned_ambulance_id"]:
                    db.add(EmergencyHistory(
                        emergency_id=e["id"],
                        at_time=(e["created_at"] + timedelta(minutes=3)).strftime("%H:%M"),
                        event=f"Unit {e['assigned_ambulance_id']} dispatched",
                        actor="Asha Nair (Dispatcher)",
                        created_at=e["created_at"] + timedelta(minutes=3)
                    ))

                if e["recommended_hospital_id"]:
                    db.add(EmergencyHistory(
                        emergency_id=e["id"],
                        at_time=(e["created_at"] + timedelta(minutes=5)).strftime("%H:%M"),
                        event=f"Hospital recommendation approved: {e['recommended_hospital_id']}",
                        actor="Asha Nair (Dispatcher)",
                        created_at=e["created_at"] + timedelta(minutes=5)
                    ))
            else:
                for k, v in e.items():
                    setattr(existing, k, v)
        db.commit()
        print(f"[OK] Seeded {len(emergencies_data)} fictional emergency cases.")

        # ----------------------------------------------------
        # 5. Sample Resource Reservations & History
        # ----------------------------------------------------
        res_data = [
            {"emergency_id": "SE-24090", "hospital_id": "H-02", "resource_type": "bed", "quantity": 1, "status": "Reserved"},
            {"emergency_id": "SE-24089", "hospital_id": "H-01", "resource_type": "icu", "quantity": 1, "status": "Reserved"},
            {"emergency_id": "SE-24087", "hospital_id": "H-03", "resource_type": "bed", "quantity": 1, "status": "Reserved"},
        ]
        for r in res_data:
            existing = db.query(ResourceReservation).filter(
                ResourceReservation.emergency_id == r["emergency_id"],
                ResourceReservation.resource_type == r["resource_type"]
            ).first()
            if not existing:
                db.add(ResourceReservation(
                    emergency_id=r["emergency_id"],
                    hospital_id=r["hospital_id"],
                    resource_type=r["resource_type"],
                    quantity=r["quantity"],
                    status=r["status"],
                    created_at=now - timedelta(minutes=20),
                    updated_at=now - timedelta(minutes=20)
                ))
        db.commit()
        print(f"[OK] Seeded {len(res_data)} resource reservations.")

        # ----------------------------------------------------
        # 6. Notifications
        # ----------------------------------------------------
        notifications_data = [
            {
                "id": "N-01",
                "target_role": "dispatcher",
                "title": "Critical case awaiting triage review",
                "message": "SE-24091 · Cardiac emergency near MG Road",
                "type": "urgent",
                "read": False,
                "created_at": now - timedelta(minutes=14)
            },
            {
                "id": "N-02",
                "target_role": "paramedic",
                "title": "Ambulance unit A-04 en route",
                "message": "SE-24090 · ETA 6 minutes to Indiranagar pickup",
                "type": "info",
                "read": False,
                "created_at": now - timedelta(minutes=27)
            },
            {
                "id": "N-03",
                "target_role": "hospital",
                "title": "Hospital capacity alert",
                "message": "Eastside Community Hospital · ICU capacity reached",
                "type": "notice",
                "read": True,
                "created_at": now - timedelta(minutes=40)
            }
        ]
        for n in notifications_data:
            existing = db.query(Notification).filter(Notification.id == n["id"]).first()
            if not existing:
                db.add(Notification(
                    id=n["id"],
                    target_role=n["target_role"],
                    title=n["title"],
                    message=n["message"],
                    type=n["type"],
                    read=n["read"],
                    created_at=n["created_at"]
                ))
        db.commit()
        print(f"[OK] Seeded {len(notifications_data)} notifications.")

        # ----------------------------------------------------
        # 7. Audit Log Records
        # ----------------------------------------------------
        audit_data = [
            {
                "id": "EV-091",
                "actor": "Asha Nair",
                "action": "Ambulance assigned",
                "target": "SE-24090 · KA-01-G-4810 (A-04)",
                "reason": "Closest available unit to Indiranagar",
                "created_at": now - timedelta(minutes=28)
            },
            {
                "id": "EV-090",
                "actor": "Dr. Rohan Shetty",
                "action": "Hospital resources updated",
                "target": "St. Martha's Medical Centre",
                "reason": "Shift handover: ICU availability confirmed at 4",
                "created_at": now - timedelta(minutes=42)
            },
            {
                "id": "EV-089",
                "actor": "Asha Nair",
                "action": "Triage priority confirmed",
                "target": "SE-24089 · Stroke",
                "reason": "FAST-positive symptoms reported by emergency caller",
                "created_at": now - timedelta(minutes=44)
            },
            {
                "id": "EV-088",
                "actor": "Operations Admin",
                "action": "System initialization",
                "target": "SETA-HRC Coordination Network",
                "reason": "Demonstration seed script initialized successfully",
                "created_at": now - timedelta(hours=3)
            }
        ]
        for a in audit_data:
            existing = db.query(AuditLog).filter(AuditLog.id == a["id"]).first()
            if not existing:
                db.add(AuditLog(
                    id=a["id"],
                    actor=a["actor"],
                    action=a["action"],
                    target=a["target"],
                    reason=a["reason"],
                    created_at=a["created_at"]
                ))
        db.commit()
        print(f"[OK] Seeded {len(audit_data)} audit records.")

        print("==================================================")
        print("Database seed complete! Demonstration environment ready.")
        print("Simulated credentials:")
        print("  Dispatcher: asha.nair@seta-hrc.org / Dispatcher@123")
        print("  Hospital:   rohan.shetty@seta-hrc.org / Hospital@123")
        print("  Paramedic:  priya.menon@seta-hrc.org / Paramedic@123")
        print("  Admin:      ops@seta-hrc.org / Admin@123")
        print("==================================================")

    except Exception as exc:
        db.rollback()
        print(f"Error during seeding: {exc}")
        raise exc
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
