from typing import List, Optional, Any
from pydantic import BaseModel, Field


class DepartmentAvailability(BaseModel):
    department: str
    available: bool


class HospitalBase(BaseModel):
    name: str
    location: str
    lat: float
    lng: float
    distance_km: float = 0.0
    capabilities: List[str] = Field(default_factory=list)
    departments: List[str] = Field(default_factory=list)
    department_availability: List[DepartmentAvailability] = Field(default_factory=list)
    beds_available: int = Field(ge=0, default=0)
    beds_reserved: int = Field(ge=0, default=0)
    beds_unavailable: int = Field(ge=0, default=0)
    icu_available: int = Field(ge=0, default=0)
    icu_reserved: int = Field(ge=0, default=0)
    icu_unavailable: int = Field(ge=0, default=0)
    oxygen_available: bool = True
    status: str = "Available"
    operational_load: float = Field(ge=0.0, le=1.0, default=0.5)


class HospitalCreate(HospitalBase):
    id: Optional[str] = None


class HospitalUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    status: Optional[str] = None
    operational_load: Optional[float] = None
    capabilities: Optional[List[str]] = None
    departments: Optional[List[str]] = None


class HospitalResourceUpdate(BaseModel):
    beds_available: Optional[int] = Field(default=None, ge=0)
    beds_reserved: Optional[int] = Field(default=None, ge=0)
    beds_unavailable: Optional[int] = Field(default=None, ge=0)
    icu_available: Optional[int] = Field(default=None, ge=0)
    icu_reserved: Optional[int] = Field(default=None, ge=0)
    icu_unavailable: Optional[int] = Field(default=None, ge=0)
    oxygen_available: Optional[bool] = None
    department_availability: Optional[List[DepartmentAvailability]] = None


class HospitalResponse(BaseModel):
    id: str
    name: str
    location: str
    lat: float
    lng: float
    distance_km: float
    capabilities: List[str]
    departments: List[str]
    department_availability: List[Any]
    beds_available: int
    beds_reserved: int
    beds_unavailable: int
    icu_available: int
    icu_reserved: int
    icu_unavailable: int
    oxygen_available: bool
    status: str
    operational_load: float

    class Config:
        from_attributes = True
