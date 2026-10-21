from datetime import datetime
from sqlalchemy import Column, String, DateTime, Index
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String(50), primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(120), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(30), nullable=False, default="dispatcher")  # dispatcher, hospital, paramedic, admin
    status = Column(String(30), nullable=False, default="Active")     # Active, Inactive, Pending
    hospital_id = Column(String(50), nullable=True)                  # For hospital users
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("idx_users_role_status", "role", "status"),
    )
