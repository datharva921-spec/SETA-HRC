from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.audit import AuditLog
from app.models.user import User
from app.schemas.audit import AuditLogResponse
from app.core.deps import get_current_user

router = APIRouter(prefix="/audit", tags=["Audit History"])


@router.get("", response_model=List[AuditLogResponse])
def get_audit_logs(
    limit: int = 50,
    action: Optional[str] = None,
    actor: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(AuditLog)
    if action:
        query = query.filter(AuditLog.action.ilike(f"%{action}%"))
    if actor:
        query = query.filter(AuditLog.actor.ilike(f"%{actor}%"))

    logs = query.order_by(AuditLog.created_at.desc()).limit(limit).all()
    return logs
