from sqlalchemy import Column, String, Float, DateTime, Index
from app.database import Base, utc_now


class Ambulance(Base):
    __tablename__ = "ambulances"

    id = Column(String(50), primary_key=True, index=True)
    unit = Column(String(50), nullable=False, unique=True, index=True)
    status = Column(String(30), nullable=False, default="Available")
    paramedic_name = Column(String(100), nullable=False)
    location = Column(String(150), nullable=False)
    lat = Column(Float, nullable=True, default=12.9716)
    lng = Column(Float, nullable=True, default=77.5946)
    assigned_emergency_id = Column(String(50), nullable=True, index=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    __table_args__ = (
        Index("idx_ambulances_status", "status"),
    )
