from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    id: str
    actor: str
    action: str
    target: str
    reason: str
    details: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
