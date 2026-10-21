from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.emergency import Emergency, EmergencyHistory
from app.models.audit import AuditLog
from app.models.notification import Notification
from app.models.user import User
from app.schemas.emergency import EmergencyCreate, EmergencyResponse, EmergencyStatusUpdate, TriageUpdate
from app.core.deps import get_current_user, require_role
from app.core.triage import assess_triage
from app.core.websocket import ws_manager

router = APIRouter(prefix="/emergencies", tags=["Emergencies & Intake"])


def format_emergency_response(e: Emergency) -> dict:
    history_events = [
        {"at": h.at_time, "event": h.event, "actor": h.actor}
        for h in (e.history or [])
    ]
    return {
        "id": e.id,
        "patient_name": e.patient_name,
        "age": e.age,
        "caller_name": e.caller_name,
        "phone": e.phone,
        "location": e.location,
        "lat": e.lat,
        "lng": e.lng,
        "coordinates_provided": e.coordinates_provided,
        "symptoms": e.symptoms,
        "category": e.category,
        "priority": e.priority,
        "priority_reason": e.priority_reason,
        "status": e.status,
        "assigned_ambulance_id": e.assigned_ambulance_id,
        "recommended_hospital_id": e.recommended_hospital_id,
        "approval_status": e.approval_status,
        "approval_reason": e.approval_reason,
        "handover_notes": e.handover_notes,
        "created_at": e.created_at,
        "history": history_events,
    }


@router.post("", response_model=EmergencyResponse, status_code=status.HTTP_201_CREATED)
async def create_emergency(
    payload: EmergencyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["dispatcher", "admin"]))
):
    now = datetime.utcnow()
    time_str = now.strftime("%H:%M")
    
    # Generate sequential unique Case ID
    count = db.query(Emergency).count()
    case_id = f"SE-{24100 + count + 1}"

    # Deterministic Triage Assessment
    priority, priority_reason = assess_triage(payload.symptoms, payload.category)

    coords_provided = bool(payload.lat is not None and payload.lng is not None)
    lat = payload.lat if coords_provided else 12.9716
    lng = payload.lng if coords_provided else 77.5946

    emergency = Emergency(
        id=case_id,
        patient_name=payload.patient_name,
        age=payload.age,
        caller_name=payload.caller_name,
        phone=payload.phone,
        location=payload.location,
        lat=lat,
        lng=lng,
        coordinates_provided=coords_provided,
        category=payload.category,
        symptoms=payload.symptoms,
        priority=priority,
        priority_reason=priority_reason,
        status="New",
        created_at=now,
        updated_at=now
    )
    db.add(emergency)

    # Initial history log
    history = EmergencyHistory(
        emergency_id=case_id,
        at_time=time_str,
        event="Call received & registered",
        actor=current_user.name,
        created_at=now
    )
    db.add(history)

    # Audit log
    audit = AuditLog(
        id=f"EV-{int(now.timestamp() * 1000)}",
        actor=current_user.name,
        action="Emergency registered",
        target=case_id,
        reason=f"Incident intake: {payload.category} ({priority})"
    )
    db.add(audit)

    # Notification for high/critical priority
    if priority in ["Critical", "High"]:
        notif = Notification(
            id=f"N-{int(now.timestamp() * 1000) % 10000:04d}",
            target_role="dispatcher",
            title=f"{priority} priority emergency registered",
            message=f"{case_id} · {payload.category} near {payload.location}",
            type="urgent" if priority == "Critical" else "notice",
            created_at=now
        )
        db.add(notif)

    db.commit()
    db.refresh(emergency)

    result = format_emergency_response(emergency)
    await ws_manager.broadcast("EMERGENCY_CREATED", result)
    return result


@router.get("", response_model=List[EmergencyResponse])
def get_emergencies(
    search: Optional[str] = None,
    priority: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Emergency)

    if priority and priority != "All priorities":
        query = query.filter(Emergency.priority == priority)

    if status and status != "All statuses":
        query = query.filter(Emergency.status == status)

    if search:
        search_fmt = f"%{search.strip().lower()}%"
        query = query.filter(
            (Emergency.id.ilike(search_fmt)) |
            (Emergency.patient_name.ilike(search_fmt)) |
            (Emergency.location.ilike(search_fmt)) |
            (Emergency.symptoms.ilike(search_fmt)) |
            (Emergency.category.ilike(search_fmt))
        )

    emergencies = query.order_by(Emergency.created_at.desc()).all()
    return [format_emergency_response(e) for e in emergencies]


@router.get("/{emergency_id}", response_model=EmergencyResponse)
def get_emergency(
    emergency_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    emergency = db.query(Emergency).filter(Emergency.id == emergency_id).first()
    if not emergency:
        raise HTTPException(status_code=404, detail="Emergency case not found.")
    return format_emergency_response(emergency)


@router.patch("/{emergency_id}/status", response_model=EmergencyResponse)
async def update_emergency_status(
    emergency_id: str,
    payload: EmergencyStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    emergency = db.query(Emergency).filter(Emergency.id == emergency_id).first()
    if not emergency:
        raise HTTPException(status_code=404, detail="Emergency case not found.")

    valid_statuses = [
        "New", "Triaged", "Dispatched", "At scene", 
        "Transporting", "Arrived", "Accepted", "Rejected", "Closed"
    ]
    if payload.status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status '{payload.status}'. Allowed: {valid_statuses}"
        )

    old_status = emergency.status
    emergency.status = payload.status
    now = datetime.utcnow()
    time_str = now.strftime("%H:%M")

    # Record history
    history = EmergencyHistory(
        emergency_id=emergency.id,
        at_time=time_str,
        event=f"Status changed from {old_status} to {payload.status}",
        actor=current_user.name,
        created_at=now
    )
    db.add(history)

    # Record audit
    audit = AuditLog(
        id=f"EV-{int(now.timestamp() * 1000)}",
        actor=current_user.name,
        action="Emergency status updated",
        target=f"{emergency.id} ({payload.status})",
        reason=payload.notes or f"Transitioned from {old_status}"
    )
    db.add(audit)

    db.commit()
    db.refresh(emergency)

    result = format_emergency_response(emergency)
    await ws_manager.broadcast("EMERGENCY_STATUS_UPDATED", result)
    return result


@router.post("/{emergency_id}/triage", response_model=EmergencyResponse)
async def update_triage_assessment(
    emergency_id: str,
    payload: TriageUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["dispatcher", "admin"]))
):
    emergency = db.query(Emergency).filter(Emergency.id == emergency_id).first()
    if not emergency:
        raise HTTPException(status_code=404, detail="Emergency case not found.")

    if payload.priority not in ["Critical", "High", "Moderate", "Low"]:
        raise HTTPException(status_code=400, detail="Invalid priority level.")

    old_priority = emergency.priority
    emergency.priority = payload.priority
    emergency.priority_reason = payload.priority_reason
    emergency.status = "Triaged"

    now = datetime.utcnow()
    time_str = now.strftime("%H:%M")

    history = EmergencyHistory(
        emergency_id=emergency.id,
        at_time=time_str,
        event=f"Triage updated: {payload.priority} (was {old_priority})",
        actor=current_user.name,
        created_at=now
    )
    db.add(history)

    audit = AuditLog(
        id=f"EV-{int(now.timestamp() * 1000)}",
        actor=current_user.name,
        action="Triage priority confirmed",
        target=f"{emergency.id} · {payload.priority}",
        reason=payload.priority_reason
    )
    db.add(audit)

    db.commit()
    db.refresh(emergency)

    result = format_emergency_response(emergency)
    await ws_manager.broadcast("EMERGENCY_TRIAGED", result)
    return result
