from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Index
from app.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String(50), primary_key=True, index=True)
    user_id = Column(String(50), nullable=True, index=True)
    target_role = Column(String(30), nullable=True, index=True)
    title = Column(String(150), nullable=False)
    message = Column(String(300), nullable=False)
    type = Column(String(30), nullable=False, default="notice")  # urgent, info, notice
    read = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("idx_notifications_read_created", "read", "created_at"),
    )
