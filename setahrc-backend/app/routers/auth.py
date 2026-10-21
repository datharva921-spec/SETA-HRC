from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.audit import AuditLog
from app.schemas.user import UserCreate, UserLogin, UserResponse, TokenResponse, UserStatusUpdate
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.deps import get_current_user, require_role

router = APIRouter(prefix="/auth", tags=["Authentication & Users"])


@router.post("/login", response_model=TokenResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    if user.status != "Active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account status is '{user.status}'. Please wait for administrator approval."
        )

    token = create_access_token(data={"sub": user.id, "role": user.role, "email": user.email})
    
    # Audit log
    audit = AuditLog(
        id=f"EV-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
        actor=user.name,
        action="User signed in",
        target=user.email,
        reason="Successful authentication"
    )
    db.add(audit)
    db.commit()

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "trusted_role": user.role,
            "status": user.status,
            "hospital_id": user.hospital_id
        }
    }


@router.post("/register", response_model=TokenResponse)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists."
        )

    valid_roles = ["dispatcher", "hospital", "paramedic", "admin"]
    role = payload.role if payload.role in valid_roles else "dispatcher"

    user_id = f"U-{int(datetime.now(timezone.utc).timestamp() * 1000) % 10000:04d}"
    new_user = User(
        id=user_id,
        name=payload.name,
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        role=role,
        status="Active",  # Active for easy evaluation/testing
        hospital_id=payload.hospital_id
    )
    db.add(new_user)

    audit = AuditLog(
        id=f"EV-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
        actor=payload.name,
        action="User registered",
        target=payload.email,
        reason=f"Account created with role '{role}'"
    )
    db.add(audit)
    db.commit()
    db.refresh(new_user)

    token = create_access_token(data={"sub": new_user.id, "role": new_user.role, "email": new_user.email})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": new_user.id,
            "name": new_user.name,
            "email": new_user.email,
            "trusted_role": new_user.role,
            "status": new_user.status,
            "hospital_id": new_user.hospital_id
        }
    }


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "trusted_role": current_user.role,
        "status": current_user.status,
        "hospital_id": current_user.hospital_id
    }


@router.get("/users", response_model=List[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin"]))
):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [
        {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "trusted_role": u.role,
            "status": u.status,
            "hospital_id": u.hospital_id
        }
        for u in users
    ]


@router.patch("/users/{user_id}/status", response_model=UserResponse)
def update_user_status(
    user_id: str,
    payload: UserStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin"]))
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.status = payload.status
    audit = AuditLog(
        id=f"EV-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
        actor=current_user.name,
        action="User status updated",
        target=user.email,
        reason=f"Status set to {payload.status}"
    )
    db.add(audit)
    db.commit()
    db.refresh(user)

    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "trusted_role": user.role,
        "status": user.status,
        "hospital_id": user.hospital_id
    }
