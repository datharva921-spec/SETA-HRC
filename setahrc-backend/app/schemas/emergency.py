from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field


class HistoryEvent(BaseModel):
    at: str
    event: str
    actor: str


class EmergencyCreate(BaseModel):
    patient_name: str
    age: int = Field(ge=0, le=125)
    caller_name: str
    phone: str
    location: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    symptoms: str
    category: str


class EmergencyStatusUpdate(BaseModel):
    status: str
    notes: Optional[str] = None


class TriageUpdate(BaseModel):
    priority: str
    priority_reason: str


class EmergencyResponse(BaseModel):
    id: str
    patient_name: str
    age: int
    caller_name: str
    phone: str
    location: str
    lat: float
    lng: float
    coordinates_provided: bool
    symptoms: str
    category: str
    priority: str
    priority_reason: str
    status: str
    assigned_ambulance_id: Optional[str] = None
    recommended_hospital_id: Optional[str] = None
    approval_status: Optional[str] = None
    approval_reason: Optional[str] = None
    handover_notes: Optional[str] = None
    created_at: datetime
    history: List[HistoryEvent] = Field(default_factory=list)

    class Config:
        from_attributes = True
