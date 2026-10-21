from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, Boolean, JSON, DateTime, Index
from app.database import Base


class Hospital(Base):
    __tablename__ = "hospitals"

    id = Column(String(50), primary_key=True, index=True)
    name = Column(String(150), nullable=False, unique=True)
    location = Column(String(150), nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    distance_km = Column(Float, nullable=False, default=0.0)
    capabilities = Column(JSON, nullable=False, default=list)
    departments = Column(JSON, nullable=False, default=list)
    department_availability = Column(JSON, nullable=False, default=list)
    beds_available = Column(Integer, nullable=False, default=0)
    beds_reserved = Column(Integer, nullable=False, default=0)
    beds_unavailable = Column(Integer, nullable=False, default=0)
    icu_available = Column(Integer, nullable=False, default=0)
    icu_reserved = Column(Integer, nullable=False, default=0)
    icu_unavailable = Column(Integer, nullable=False, default=0)
    oxygen_available = Column(Boolean, nullable=False, default=True)
    status = Column(String(30), nullable=False, default="Available")  # Available, Busy, Offline
    operational_load = Column(Float, nullable=False, default=0.5)     # 0.0 to 1.0
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("idx_hospitals_status", "status"),
        Index("idx_hospitals_location", "location"),
    )
