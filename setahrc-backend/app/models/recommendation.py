from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Text, JSON, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.database import Base


class HospitalRecommendation(Base):
    __tablename__ = "hospital_recommendations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    emergency_id = Column(String(50), ForeignKey("emergencies.id", ondelete="CASCADE"), nullable=False, index=True)
    hospital_id = Column(String(50), ForeignKey("hospitals.id", ondelete="CASCADE"), nullable=False, index=True)
    rank = Column(Integer, nullable=False, default=1)
    total_score = Column(Float, nullable=False)
    capability_score = Column(Float, nullable=False)
    resource_score = Column(Float, nullable=False)
    distance_score = Column(Float, nullable=False)
    load_score = Column(Float, nullable=False)
    distance_km = Column(Float, nullable=False, default=0.0)
    explanation = Column(Text, nullable=False)
    missing_data_flags = Column(JSON, nullable=False, default=list)
    status = Column(String(30), nullable=False, default="Proposed")  # Proposed, Approved, Rejected, Overridden
    override_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    emergency = relationship("Emergency", back_populates="recommendations")
    hospital = relationship("Hospital")

    __table_args__ = (
        Index("idx_recommendations_emergency_rank", "emergency_id", "rank"),
    )
