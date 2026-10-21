from typing import Optional
from pydantic import BaseModel, ConfigDict


class AmbulanceBase(BaseModel):
    unit: str
    status: str = "Available"
    paramedic_name: str
    location: str
    lat: Optional[float] = 12.9716
    lng: Optional[float] = 77.5946
    assigned_emergency_id: Optional[str] = None


class AmbulanceCreate(AmbulanceBase):
    id: Optional[str] = None


class AmbulanceUpdate(BaseModel):
    unit: Optional[str] = None
    status: Optional[str] = None
    paramedic_name: Optional[str] = None
    location: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    assigned_emergency_id: Optional[str] = None


class AmbulanceAssignRequest(BaseModel):
    emergency_id: str
    ambulance_id: str


class AmbulanceResponse(BaseModel):
    id: str
    unit: str
    status: str
    paramedic_name: str
    location: str
    assigned_emergency_id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
