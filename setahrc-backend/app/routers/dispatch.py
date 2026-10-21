from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db, utc_now
from app.models.ambulance import Ambulance
from app.models.emergency import Emergency, EmergencyHistory
from app.models.audit import AuditLog
from app.models.notification import Notification
from app.models.user import User
from app.schemas.ambulance import AmbulanceCreate, AmbulanceUpdate, AmbulanceAssignRequest, AmbulanceResponse
from app.core.deps import get_current_user, require_role
from app.core.websocket import ws_manager

router = APIRouter(prefix="", tags=["Ambulances & Dispatch"])


@router.get("/ambulances", response_model=List[AmbulanceResponse])
def get_ambulances(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ambulances = db.query(Ambulance).order_by(Ambulance.unit.asc()).all()
    return ambulances


@router.post("/ambulances", response_model=AmbulanceResponse, status_code=status.HTTP_201_CREATED)
def create_ambulance(
    payload: AmbulanceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin"]))
):
    a_id = payload.id or f"A-{db.query(Ambulance).count() + 1:02d}"
    amb = Ambulance(
        id=a_id,
        unit=payload.unit,
        status=payload.status,
        paramedic_name=payload.paramedic_name,
        location=payload.location,
        lat=payload.lat or 12.9716,
        lng=payload.lng or 77.5946
    )
    db.add(amb)

    audit = AuditLog(
        id=f"EV-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
        actor=current_user.name,
        action="Ambulance added",
        target=f"{a_id} · {payload.unit}",
        reason="Fleet directory update"
    )
    db.add(audit)

    db.commit()
    db.refresh(amb)
    return amb


@router.post("/dispatch/assign")
async def assign_ambulance(
    payload: AmbulanceAssignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["dispatcher", "admin"]))
):
    emergency = db.query(Emergency).filter(Emergency.id == payload.emergency_id).first()
    if not emergency:
        raise HTTPException(status_code=404, detail="Emergency case not found.")

    ambulance = db.query(Ambulance).filter(Ambulance.id == payload.ambulance_id).first()
    if not ambulance:
        raise HTTPException(status_code=404, detail="Ambulance unit not found.")

    if ambulance.status != "Available":
        raise HTTPException(
            status_code=400,
            detail=f"Unit {ambulance.unit} is not available (current status: '{ambulance.status}')."
        )

    now = utc_now()
    time_str = now.strftime("%H:%M")

    # Update emergency
    emergency.assigned_ambulance_id = ambulance.id
    emergency.status = "Dispatched"

    # Update ambulance
    ambulance.status = "En route"
    ambulance.assigned_emergency_id = emergency.id

    # Emergency history
    hist = EmergencyHistory(
        emergency_id=emergency.id,
        at_time=time_str,
        event=f"Unit {ambulance.unit} ({ambulance.paramedic_name}) assigned",
        actor=f"{current_user.name} (Dispatcher)",
        created_at=now
    )
    db.add(hist)

    # Audit log
    audit = AuditLog(
        id=f"EV-{int(now.timestamp() * 1000)}",
        actor=current_user.name,
        action="Ambulance assigned",
        target=f"{emergency.id} -> {ambulance.unit}",
        reason="Closest available crew dispatch"
    )
    db.add(audit)

    # Notification
    notif = Notification(
        id=f"N-{int(now.timestamp() * 1000) % 10000:04d}",
        target_role="paramedic",
        title=f"New dispatch assignment: {ambulance.unit}",
        message=f"{emergency.id} at {emergency.location} · {emergency.category} ({emergency.priority})",
        type="urgent" if emergency.priority == "Critical" else "info",
        created_at=now
    )
    db.add(notif)

    db.commit()

    payload_data = {
        "emergency_id": emergency.id,
        "ambulance_id": ambulance.id,
        "ambulance_unit": ambulance.unit,
        "paramedic_name": ambulance.paramedic_name,
        "status": "Dispatched"
    }
    await ws_manager.broadcast("AMBULANCE_ASSIGNED", payload_data)

    return {
        "success": True,
        "message": f"Unit {ambulance.unit} assigned to {emergency.id}.",
        **payload_data
    }


@router.patch("/ambulances/{ambulance_id}/status", response_model=AmbulanceResponse)
async def update_ambulance_status(
    ambulance_id: str,
    payload: AmbulanceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ambulance = db.query(Ambulance).filter(Ambulance.id == ambulance_id).first()
    if not ambulance:
        raise HTTPException(status_code=404, detail="Ambulance not found.")

    old_status = ambulance.status
    if payload.status:
        ambulance.status = payload.status
    if payload.location:
        ambulance.location = payload.location

    now = utc_now()
    time_str = now.strftime("%H:%M")

    # If linked to an active emergency, update case status accordingly
    if ambulance.assigned_emergency_id and payload.status in ["At scene", "Transporting", "Arrived"]:
        em = db.query(Emergency).filter(Emergency.id == ambulance.assigned_emergency_id).first()
        if em:
            em.status = payload.status
            db.add(EmergencyHistory(
                emergency_id=em.id,
                at_time=time_str,
                event=f"Crew status: {payload.status}",
                actor=f"{current_user.name} ({ambulance.unit})",
                created_at=now
            ))

    if payload.status == "Available":
        ambulance.assigned_emergency_id = None

    audit = AuditLog(
        id=f"EV-{int(now.timestamp() * 1000)}",
        actor=current_user.name,
        action="Ambulance status updated",
        target=f"{ambulance.unit} ({ambulance.id})",
        reason=f"Status: {old_status} -> {ambulance.status}"
    )
    db.add(audit)

    db.commit()
    db.refresh(ambulance)

    await ws_manager.broadcast("AMBULANCE_STATUS_UPDATED", {
        "id": ambulance.id,
        "unit": ambulance.unit,
        "status": ambulance.status,
        "location": ambulance.location,
        "assigned_emergency_id": ambulance.assigned_emergency_id
    })

    return ambulance
