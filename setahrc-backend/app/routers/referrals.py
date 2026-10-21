from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db, utc_now
from app.models.emergency import Emergency, EmergencyHistory
from app.models.hospital import Hospital
from app.models.reservation import ResourceReservation, ResourceHistory
from app.models.audit import AuditLog
from app.models.notification import Notification
from app.models.user import User
from app.schemas.reservation import ReferralDecisionRequest
from app.core.deps import get_current_user, require_role
from app.core.websocket import ws_manager

router = APIRouter(prefix="/referrals", tags=["Hospital Referrals & Inbound Decisions"])


@router.post("/{emergency_id}/decision")
async def record_referral_decision(
    emergency_id: str,
    payload: ReferralDecisionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["hospital", "dispatcher", "admin"]))
):
    if payload.decision not in ["Accepted", "Rejected"]:
        raise HTTPException(status_code=400, detail="Decision must be 'Accepted' or 'Rejected'.")

    if len(payload.reason.strip()) < 4:
        raise HTTPException(status_code=400, detail="Clinical or operational rationale must be at least 4 characters.")

    emergency = db.query(Emergency).filter(Emergency.id == emergency_id).first()
    if not emergency:
        raise HTTPException(status_code=404, detail="Emergency case not found.")

    hospital = db.query(Hospital).filter(Hospital.id == payload.hospital_id).first()
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found.")

    now = utc_now()
    time_str = now.strftime("%H:%M")

    if payload.decision == "Accepted":
        # Transactional verification: Ensure concurrent resource reservations cannot exceed availability
        # Lock or atomically verify hospital capacity
        if hospital.beds_available <= 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot accept case: {hospital.name} has 0 general beds available."
            )

        need_icu = payload.reserve_icu or emergency.priority == "Critical"
        if need_icu and hospital.icu_available <= 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot accept case requiring ICU: {hospital.name} has 0 ICU beds available."
            )

        # Decrement availability and increment reservations atomically
        old_beds = hospital.beds_available
        hospital.beds_available = Hospital.beds_available - 1
        hospital.beds_reserved = Hospital.beds_reserved + 1

        db.add(ResourceReservation(
            emergency_id=emergency.id,
            hospital_id=hospital.id,
            resource_type="bed",
            quantity=1,
            status="Reserved",
            created_at=now
        ))

        db.add(ResourceHistory(
            hospital_id=hospital.id,
            resource_type="beds_available",
            old_quantity=old_beds,
            new_quantity=old_beds - 1,
            reason=f"Reservation for emergency {emergency.id}",
            actor=current_user.name,
            created_at=now
        ))

        if need_icu:
            old_icu = hospital.icu_available
            hospital.icu_available = Hospital.icu_available - 1
            hospital.icu_reserved = Hospital.icu_reserved + 1
            db.add(ResourceReservation(
                emergency_id=emergency.id,
                hospital_id=hospital.id,
                resource_type="icu",
                quantity=1,
                status="Reserved",
                created_at=now
            ))
            db.add(ResourceHistory(
                hospital_id=hospital.id,
                resource_type="icu_available",
                old_quantity=old_icu,
                new_quantity=old_icu - 1,
                reason=f"ICU reservation for critical case {emergency.id}",
                actor=current_user.name,
                created_at=now
            ))

        emergency.status = "Accepted"
        emergency.recommended_hospital_id = hospital.id

        history_event = f"Hospital accepted inbound case: {hospital.name}"
        audit_action = "Incoming case accepted"

    else:
        # Rejected workflow
        emergency.status = "Rejected"
        history_event = f"Hospital rejected inbound referral: {hospital.name} ({payload.reason})"
        audit_action = "Incoming case rejected"

        # Notify dispatch that case was rejected and needs immediate re-routing
        db.add(Notification(
            id=f"N-{int(now.timestamp() * 1000) % 10000:04d}",
            target_role="dispatcher",
            title=f"Referral rejected by {hospital.name}",
            message=f"{emergency.id} rejected: {payload.reason}. Immediate re-routing required.",
            type="urgent",
            created_at=now
        ))

    # History entry
    db.add(EmergencyHistory(
        emergency_id=emergency.id,
        at_time=time_str,
        event=history_event,
        actor=f"{current_user.name} ({hospital.name}) · {payload.reason}",
        created_at=now
    ))

    # Audit log
    db.add(AuditLog(
        id=f"EV-{int(now.timestamp() * 1000)}",
        actor=current_user.name,
        action=audit_action,
        target=f"{emergency.id} · {hospital.name}",
        reason=payload.reason
    ))

    db.commit()
    db.refresh(hospital)
    db.refresh(emergency)

    broadcast_payload = {
        "emergency_id": emergency.id,
        "hospital_id": hospital.id,
        "decision": payload.decision,
        "status": emergency.status,
        "reason": payload.reason,
        "beds_available": hospital.beds_available,
        "icu_available": hospital.icu_available
    }
    await ws_manager.broadcast("REFERRAL_DECIDED", broadcast_payload)

    return {
        "success": True,
        "decision": payload.decision,
        "emergency_id": emergency.id,
        "hospital_id": hospital.id,
        "message": f"Inbound case {emergency.id} was {payload.decision.lower()} by {hospital.name}."
    }
