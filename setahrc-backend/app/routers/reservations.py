from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db, utc_now
from app.models.reservation import ResourceReservation, ResourceHistory
from app.models.hospital import Hospital
from app.models.emergency import Emergency, EmergencyHistory
from app.models.audit import AuditLog
from app.models.user import User
from app.schemas.reservation import ReservationCreate, ReservationResponse
from app.core.deps import get_current_user, require_role
from app.core.websocket import ws_manager

router = APIRouter(prefix="/reservations", tags=["Resource Reservations"])


@router.post("", response_model=ReservationResponse, status_code=status.HTTP_201_CREATED)
async def create_resource_reservation(
    payload: ReservationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["hospital", "dispatcher", "admin"]))
):
    """
    Transactional Resource Reservation:
    Prevents race conditions by using database checks so concurrent reservations
    cannot exceed the hospital's available capacity.
    """
    emergency = db.query(Emergency).filter(Emergency.id == payload.emergency_id).first()
    if not emergency:
        raise HTTPException(status_code=404, detail="Emergency not found.")

    hospital = db.query(Hospital).filter(Hospital.id == payload.hospital_id).first()
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found.")

    now = utc_now()

    if payload.resource_type == "bed":
        if (hospital.beds_available or 0) < payload.quantity:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot reserve {payload.quantity} bed(s): only {hospital.beds_available} available."
            )
        old_val = hospital.beds_available
        hospital.beds_available = Hospital.beds_available - payload.quantity
        hospital.beds_reserved = Hospital.beds_reserved + payload.quantity

    elif payload.resource_type == "icu":
        if (hospital.icu_available or 0) < payload.quantity:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot reserve {payload.quantity} ICU bed(s): only {hospital.icu_available} available."
            )
        old_val = hospital.icu_available
        hospital.icu_available = Hospital.icu_available - payload.quantity
        hospital.icu_reserved = Hospital.icu_reserved + payload.quantity

    elif payload.resource_type == "oxygen":
        if not hospital.oxygen_available:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Oxygen resources are currently unavailable at this facility."
            )
        old_val = 1
    else:
        raise HTTPException(status_code=400, detail="Invalid resource_type. Must be 'bed', 'icu', or 'oxygen'.")

    res = ResourceReservation(
        emergency_id=payload.emergency_id,
        hospital_id=payload.hospital_id,
        resource_type=payload.resource_type,
        quantity=payload.quantity,
        status="Reserved",
        created_at=now
    )
    db.add(res)

    db.add(ResourceHistory(
        hospital_id=hospital.id,
        resource_type=f"{payload.resource_type}_available",
        old_quantity=old_val,
        new_quantity=max(0, old_val - payload.quantity),
        reason=f"Direct reservation for {emergency.id}",
        actor=current_user.name,
        created_at=now
    ))

    audit = AuditLog(
        id=f"EV-{int(now.timestamp() * 1000)}",
        actor=current_user.name,
        action="Resource reserved",
        target=f"{emergency.id} -> {hospital.name} ({payload.quantity} {payload.resource_type})",
        reason="Coordination reservation"
    )
    db.add(audit)

    db.commit()
    db.refresh(res)
    db.refresh(hospital)

    await ws_manager.broadcast("RESERVATION_CREATED", {
        "id": res.id,
        "emergency_id": res.emergency_id,
        "hospital_id": res.hospital_id,
        "resource_type": res.resource_type,
        "quantity": res.quantity,
        "beds_available": hospital.beds_available,
        "icu_available": hospital.icu_available
    })

    return res


@router.post("/{reservation_id}/release")
async def release_resource_reservation(
    reservation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["hospital", "dispatcher", "admin"]))
):
    res = db.query(ResourceReservation).filter(ResourceReservation.id == reservation_id).first()
    if not res:
        raise HTTPException(status_code=404, detail="Reservation not found.")

    if res.status == "Released":
        return {"success": True, "message": "Reservation was already released."}

    hospital = db.query(Hospital).filter(Hospital.id == res.hospital_id).first()
    now = utc_now()

    if hospital:
        if res.resource_type == "bed":
            hospital.beds_available = Hospital.beds_available + res.quantity
            hospital.beds_reserved = Hospital.beds_reserved - res.quantity
        elif res.resource_type == "icu":
            hospital.icu_available = Hospital.icu_available + res.quantity
            hospital.icu_reserved = Hospital.icu_reserved - res.quantity

    res.status = "Released"

    audit = AuditLog(
        id=f"EV-{int(now.timestamp() * 1000)}",
        actor=current_user.name,
        action="Resource reservation released",
        target=f"Reservation #{res.id} ({res.resource_type})",
        reason="Case completed or referral cancelled"
    )
    db.add(audit)

    db.commit()

    await ws_manager.broadcast("RESERVATION_RELEASED", {
        "id": res.id,
        "emergency_id": res.emergency_id,
        "hospital_id": res.hospital_id,
        "status": "Released"
    })

    return {"success": True, "message": f"Reservation #{reservation_id} released successfully."}


@router.get("", response_model=List[ReservationResponse])
def get_reservations(
    emergency_id: Optional[str] = None,
    hospital_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(ResourceReservation)
    if emergency_id:
        query = query.filter(ResourceReservation.emergency_id == emergency_id)
    if hospital_id:
        query = query.filter(ResourceReservation.hospital_id == hospital_id)
    return query.order_by(ResourceReservation.created_at.desc()).all()
