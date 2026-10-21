from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db, utc_now
from app.models.emergency import Emergency, EmergencyHistory
from app.models.hospital import Hospital
from app.models.recommendation import HospitalRecommendation
from app.models.audit import AuditLog
from app.models.user import User
from app.schemas.recommendation import RecommendationResponse, RecommendationApprovalRequest
from app.core.deps import get_current_user, require_role
from app.core.scoring import rank_hospitals
from app.core.websocket import ws_manager

router = APIRouter(prefix="/emergencies", tags=["Hospital Recommendations & Oversight"])


@router.post("/{emergency_id}/recommendations", response_model=List[RecommendationResponse])
def generate_hospital_recommendations(
    emergency_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    emergency = db.query(Emergency).filter(Emergency.id == emergency_id).first()
    if not emergency:
        raise HTTPException(status_code=404, detail="Emergency case not found.")

    hospitals = db.query(Hospital).all()
    if not hospitals:
        raise HTTPException(status_code=400, detail="No registered receiving facilities found in the system.")

    # Compute deterministic multi-factor ranking
    ranked = rank_hospitals(hospitals, emergency)

    # Persist recommendations for clinical auditability
    now = utc_now()
    # Delete old proposed recommendations for this case to avoid clutter
    db.query(HospitalRecommendation).filter(
        HospitalRecommendation.emergency_id == emergency_id,
        HospitalRecommendation.status == "Proposed"
    ).delete()

    for item in ranked:
        rec = HospitalRecommendation(
            emergency_id=emergency_id,
            hospital_id=item["hospital_id"],
            rank=item["rank"],
            total_score=item["total_score"],
            capability_score=item["capability_score"],
            resource_score=item["resource_score"],
            distance_score=item["distance_score"],
            load_score=item["load_score"],
            distance_km=item["distance_km"],
            explanation=item["explanation"],
            missing_data_flags=item["missing_data_flags"],
            status="Proposed",
            created_at=now
        )
        db.add(rec)

    db.commit()

    return [
        {
            "hospital_id": r["hospital_id"],
            "hospital_name": r["hospital_name"],
            "location": r["location"],
            "distance_km": r["distance_km"],
            "rank": r["rank"],
            "total_score": r["total_score"],
            "capability_score": r["capability_score"],
            "resource_score": r["resource_score"],
            "distance_score": r["distance_score"],
            "load_score": r["load_score"],
            "factors": r["factors"],
            "explanation": r["explanation"],
            "missing_data_flags": r["missing_data_flags"],
            "beds_available": r["beds_available"],
            "icu_available": r["icu_available"],
            "oxygen_available": r["oxygen_available"],
            "status": r["status"]
        }
        for r in ranked
    ]


@router.post("/{emergency_id}/recommendations/approve")
async def approve_hospital_recommendation(
    emergency_id: str,
    payload: RecommendationApprovalRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["dispatcher", "admin"]))
):
    """
    Human oversight checkpoint: An authorized dispatcher reviews, approves or overrides
    the recommendation, recording a documented rationale.
    """
    if len(payload.reason.strip()) < 5:
        raise HTTPException(
            status_code=400,
            detail="Documented approval or override rationale must be at least 5 characters."
        )

    emergency = db.query(Emergency).filter(Emergency.id == emergency_id).first()
    if not emergency:
        raise HTTPException(status_code=404, detail="Emergency case not found.")

    hospital = db.query(Hospital).filter(Hospital.id == payload.hospital_id).first()
    if not hospital:
        raise HTTPException(status_code=404, detail="Selected hospital does not exist.")

    now = utc_now()
    time_str = now.strftime("%H:%M")

    # Update emergency record
    emergency.recommended_hospital_id = hospital.id
    emergency.approval_status = "Overridden" if payload.override else "Approved"
    emergency.approval_reason = payload.reason.strip()

    # Update recommendation status in DB
    recs = db.query(HospitalRecommendation).filter(
        HospitalRecommendation.emergency_id == emergency_id
    ).all()
    for r in recs:
        if r.hospital_id == payload.hospital_id:
            r.status = "Overridden" if payload.override else "Approved"
            r.override_reason = payload.reason.strip()
        else:
            r.status = "Rejected"

    # History event
    action_type = "Hospital recommendation overridden" if payload.override else "Hospital recommendation approved"
    history = EmergencyHistory(
        emergency_id=emergency.id,
        at_time=time_str,
        event=f"{action_type}: {hospital.name}",
        actor=f"{current_user.name} ({current_user.role}): {payload.reason.strip()}",
        created_at=now
    )
    db.add(history)

    # Audit event
    audit = AuditLog(
        id=f"EV-{int(now.timestamp() * 1000)}",
        actor=current_user.name,
        action=action_type,
        target=f"{emergency.id} -> {hospital.name}",
        reason=payload.reason.strip()
    )
    db.add(audit)

    db.commit()

    await ws_manager.broadcast("HOSPITAL_RECOMMENDATION_DECIDED", {
        "emergency_id": emergency.id,
        "hospital_id": hospital.id,
        "hospital_name": hospital.name,
        "decision": emergency.approval_status,
        "reason": payload.reason.strip()
    })

    return {
        "success": True,
        "emergency_id": emergency.id,
        "hospital_id": hospital.id,
        "hospital_name": hospital.name,
        "approval_status": emergency.approval_status,
        "approval_reason": emergency.approval_reason
    }
