from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Index, CheckConstraint
from sqlalchemy.orm import relationship
from app.database import Base, utc_now


class ResourceReservation(Base):
    __tablename__ = "resource_reservations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    emergency_id = Column(String(50), ForeignKey("emergencies.id", ondelete="CASCADE"), nullable=False, index=True)
    hospital_id = Column(String(50), ForeignKey("hospitals.id", ondelete="CASCADE"), nullable=False, index=True)
    resource_type = Column(String(30), nullable=False)  # bed, icu, oxygen
    quantity = Column(Integer, nullable=False, default=1)
    status = Column(String(30), nullable=False, default="Reserved")  # Reserved, Claimed, Released
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    emergency = relationship("Emergency", back_populates="reservations")
    hospital = relationship("Hospital")

    __table_args__ = (
        CheckConstraint("quantity > 0", name="chk_reservation_quantity_positive"),
        Index("idx_reservations_status", "status"),
    )


class ResourceHistory(Base):
    __tablename__ = "resource_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    hospital_id = Column(String(50), ForeignKey("hospitals.id", ondelete="CASCADE"), nullable=False, index=True)
    resource_type = Column(String(50), nullable=False)
    old_quantity = Column(Integer, nullable=False, default=0)
    new_quantity = Column(Integer, nullable=False, default=0)
    reason = Column(String(200), nullable=False)
    actor = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    hospital = relationship("Hospital")

    __table_args__ = (
        Index("idx_res_history_hospital_created", "hospital_id", "created_at"),
    )
