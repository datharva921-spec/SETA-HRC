from sqlalchemy import Column, String, Integer, Float, Boolean, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.database import Base, utc_now


class Emergency(Base):
    __tablename__ = "emergencies"

    id = Column(String(50), primary_key=True, index=True)
    patient_name = Column(String(100), nullable=False)
    age = Column(Integer, nullable=False)
    caller_name = Column(String(100), nullable=False)
    phone = Column(String(50), nullable=False)
    location = Column(String(200), nullable=False)
    lat = Column(Float, nullable=False, default=12.9716)
    lng = Column(Float, nullable=False, default=77.5946)
    coordinates_provided = Column(Boolean, nullable=False, default=False)
    category = Column(String(50), nullable=False)
    symptoms = Column(Text, nullable=False)
    priority = Column(String(20), nullable=False, default="Moderate")  # Critical, High, Moderate, Low
    priority_reason = Column(Text, nullable=False)
    status = Column(String(30), nullable=False, default="New")        # New, Triaged, Dispatched, At scene, Transporting, Arrived, Accepted, Rejected, Closed
    assigned_ambulance_id = Column(String(50), ForeignKey("ambulances.id", ondelete="SET NULL"), nullable=True)
    recommended_hospital_id = Column(String(50), ForeignKey("hospitals.id", ondelete="SET NULL"), nullable=True)
    approval_status = Column(String(30), nullable=True)
    approval_reason = Column(Text, nullable=True)
    handover_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False, index=True)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    history = relationship("EmergencyHistory", back_populates="emergency", cascade="all, delete-orphan", order_by="EmergencyHistory.created_at")
    recommendations = relationship("HospitalRecommendation", back_populates="emergency", cascade="all, delete-orphan")
    reservations = relationship("ResourceReservation", back_populates="emergency", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_emergencies_priority_status", "priority", "status"),
        Index("idx_emergencies_status", "status"),
        Index("idx_emergencies_created_at", "created_at"),
    )


class EmergencyHistory(Base):
    __tablename__ = "emergency_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    emergency_id = Column(String(50), ForeignKey("emergencies.id", ondelete="CASCADE"), nullable=False, index=True)
    at_time = Column(String(20), nullable=False)
    event = Column(String(150), nullable=False)
    actor = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    emergency = relationship("Emergency", back_populates="history")
