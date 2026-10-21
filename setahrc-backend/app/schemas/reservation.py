from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


class ReservationCreate(BaseModel):
    emergency_id: str
    hospital_id: str
    resource_type: str = Field(description="bed, icu, or oxygen")
    quantity: int = Field(default=1, ge=1)


class ReservationResponse(BaseModel):
    id: int
    emergency_id: str
    hospital_id: str
    resource_type: str
    quantity: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class ReferralDecisionRequest(BaseModel):
    decision: str  # "Accepted" or "Rejected"
    reason: str
    hospital_id: str
    reserve_icu: bool = False
