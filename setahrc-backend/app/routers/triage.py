from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import case

from app.database import get_db
from app.models.emergency import Emergency
from app.models.user import User
from app.schemas.emergency import EmergencyResponse
from app.core.deps import get_current_user
from app.routers.emergencies import format_emergency_response

router = APIRouter(prefix="/triage", tags=["Triage & Priority Queue"])


@router.get("/queue", response_model=List[EmergencyResponse])
def get_priority_queue(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns the dynamic priority triage queue.
    Cases are ordered deterministically by Clinical Priority Acuity:
      1. Critical (Weight 4)
      2. High     (Weight 3)
      3. Moderate (Weight 2)
      4. Low      (Weight 1)
    With secondary ordering by intake timestamp (FIFO within the same acuity level).
    """
    priority_order = case(
        (Emergency.priority == "Critical", 4),
        (Emergency.priority == "High", 3),
        (Emergency.priority == "Moderate", 2),
        (Emergency.priority == "Low", 1),
        else_=0
    )

    open_cases = (
        db.query(Emergency)
        .filter(Emergency.status.in_(["New", "Triaged", "Dispatched", "At scene", "Transporting"]))
        .order_by(priority_order.desc(), Emergency.created_at.asc())
        .all()
    )

    return [format_emergency_response(e) for e in open_cases]
