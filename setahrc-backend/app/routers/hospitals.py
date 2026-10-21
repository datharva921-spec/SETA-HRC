from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.hospital import Hospital
from app.models.reservation import ResourceHistory
from app.models.audit import AuditLog
from app.models.user import User
from app.schemas.hospital import HospitalCreate, HospitalUpdate, HospitalResourceUpdate, HospitalResponse
from app.core.deps import get_current_user, require_role
from app.core.websocket import ws_manager

router = APIRouter(prefix="/hospitals", tags=["Hospitals & Resources"])


@router.get("", response_model=List[HospitalResponse])
def get_hospitals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    hospitals = db.query(Hospital).order_by(Hospital.distance_km.asc(), Hospital.name.asc()).all()
    return hospitals


@router.get("/{hospital_id}", response_model=HospitalResponse)
def get_hospital(
    hospital_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    hospital = db.query(Hospital).filter(Hospital.id == hospital_id).first()
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found.")
    return hospital


@router.patch("/{hospital_id}/resources", response_model=HospitalResponse)
async def update_hospital_resources(
    hospital_id: str,
    payload: HospitalResourceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["hospital", "admin"]))
):
    hospital = db.query(Hospital).filter(Hospital.id == hospital_id).first()
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found.")

    now = datetime.utcnow()
    changes_desc = []

    if payload.beds_available is not None:
        if payload.beds_available < 0:
            raise HTTPException(status_code=400, detail="Beds available cannot be negative.")
        old_val = hospital.beds_available
        hospital.beds_available = payload.beds_available
        changes_desc.append(f"Beds: {old_val} -> {payload.beds_available}")
        db.add(ResourceHistory(
            hospital_id=hospital.id,
            resource_type="beds_available",
            old_quantity=old_val,
            new_quantity=payload.beds_available,
            reason="Capacity update",
            actor=current_user.name,
            created_at=now
        ))

    if payload.beds_reserved is not None:
        hospital.beds_reserved = max(0, payload.beds_reserved)

    if payload.beds_unavailable is not None:
        hospital.beds_unavailable = max(0, payload.beds_unavailable)

    if payload.icu_available is not None:
        if payload.icu_available < 0:
            raise HTTPException(status_code=400, detail="ICU beds available cannot be negative.")
        old_val = hospital.icu_available
        hospital.icu_available = payload.icu_available
        changes_desc.append(f"ICU: {old_val} -> {payload.icu_available}")
        db.add(ResourceHistory(
            hospital_id=hospital.id,
            resource_type="icu_available",
            old_quantity=old_val,
            new_quantity=payload.icu_available,
            reason="Capacity update",
            actor=current_user.name,
            created_at=now
        ))

    if payload.icu_reserved is not None:
        hospital.icu_reserved = max(0, payload.icu_reserved)

    if payload.icu_unavailable is not None:
        hospital.icu_unavailable = max(0, payload.icu_unavailable)

    if payload.oxygen_available is not None:
        hospital.oxygen_available = payload.oxygen_available
        changes_desc.append(f"Oxygen: {'Available' if payload.oxygen_available else 'Unavailable'}")

    if payload.department_availability is not None:
        hospital.department_availability = [d.dict() for d in payload.department_availability]

    # Recalculate operational status
    if hospital.beds_available == 0 and hospital.icu_available == 0:
        hospital.status = "Busy"
    elif hospital.status == "Busy" and (hospital.beds_available > 0 or hospital.icu_available > 0):
        hospital.status = "Available"

    audit = AuditLog(
        id=f"EV-{int(now.timestamp() * 1000)}",
        actor=current_user.name,
        action="Hospital resources updated",
        target=f"{hospital.id} · {hospital.name}",
        reason="; ".join(changes_desc) or "Shift resource adjustment"
    )
    db.add(audit)

    db.commit()
    db.refresh(hospital)

    await ws_manager.broadcast("HOSPITAL_RESOURCES_UPDATED", {
        "id": hospital.id,
        "name": hospital.name,
        "beds_available": hospital.beds_available,
        "icu_available": hospital.icu_available,
        "oxygen_available": hospital.oxygen_available,
        "status": hospital.status
    })

    return hospital


@router.post("", response_model=HospitalResponse, status_code=status.HTTP_201_CREATED)
def create_hospital(
    payload: HospitalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin"]))
):
    h_id = payload.id or f"H-{db.query(Hospital).count() + 1:02d}"
    
    dept_avail = [d.dict() for d in payload.department_availability]

    hospital = Hospital(
        id=h_id,
        name=payload.name,
        location=payload.location,
        lat=payload.lat,
        lng=payload.lng,
        distance_km=payload.distance_km,
        capabilities=payload.capabilities,
        departments=payload.departments,
        department_availability=dept_avail,
        beds_available=payload.beds_available,
        beds_reserved=payload.beds_reserved,
        beds_unavailable=payload.beds_unavailable,
        icu_available=payload.icu_available,
        icu_reserved=payload.icu_reserved,
        icu_unavailable=payload.icu_unavailable,
        oxygen_available=payload.oxygen_available,
        status=payload.status,
        operational_load=payload.operational_load
    )
    db.add(hospital)

    audit = AuditLog(
        id=f"EV-{int(datetime.utcnow().timestamp() * 1000)}",
        actor=current_user.name,
        action="Hospital added",
        target=f"{h_id} · {payload.name}",
        reason="Directory provision"
    )
    db.add(audit)

    db.commit()
    db.refresh(hospital)
    return hospital


@router.put("/{hospital_id}", response_model=HospitalResponse)
def update_hospital(
    hospital_id: str,
    payload: HospitalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin"]))
):
    hospital = db.query(Hospital).filter(Hospital.id == hospital_id).first()
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found.")

    for field, val in payload.dict(exclude_unset=True).items():
        setattr(hospital, field, val)

    audit = AuditLog(
        id=f"EV-{int(datetime.utcnow().timestamp() * 1000)}",
        actor=current_user.name,
        action="Hospital details updated",
        target=f"{hospital.id} · {hospital.name}",
        reason="Admin configuration update"
    )
    db.add(audit)

    db.commit()
    db.refresh(hospital)
    return hospital
