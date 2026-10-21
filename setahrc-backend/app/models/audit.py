from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Index
from app.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(50), primary_key=True, index=True)
    actor = Column(String(100), nullable=False)
    action = Column(String(150), nullable=False)
    target = Column(String(150), nullable=False)
    reason = Column(String(255), nullable=False, default="")
    details = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    __table_args__ = (
        Index("idx_audit_logs_action", "action"),
        Index("idx_audit_logs_actor", "actor"),
    )
