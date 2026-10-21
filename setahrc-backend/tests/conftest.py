import os
import sys
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import Base, get_db
from app.main import app
from app.core.security import create_access_token
from scripts.seed import seed_database

TEST_DB_URL = "sqlite:///./test_seta_hrc.db"
test_engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    # Seed data into test database
    db = TestingSessionLocal()
    try:
        from scripts.seed import (
            User, Hospital, Ambulance, Emergency, EmergencyHistory,
            get_password_hash, datetime, timedelta, timezone
        )
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        # Create users
        db.add(User(
            id="U-TEST-01", name="Test Dispatcher", email="dispatcher@test.com",
            hashed_password=get_password_hash("Pass@123"), role="dispatcher", status="Active"
        ))
        db.add(User(
            id="U-TEST-02", name="Test Hospital", email="hospital@test.com",
            hashed_password=get_password_hash("Pass@123"), role="hospital", status="Active", hospital_id="H-01"
        ))
        db.add(User(
            id="U-TEST-03", name="Test Paramedic", email="paramedic@test.com",
            hashed_password=get_password_hash("Pass@123"), role="paramedic", status="Active"
        ))
        db.add(User(
            id="U-TEST-04", name="Test Admin", email="admin@test.com",
            hashed_password=get_password_hash("Pass@123"), role="admin", status="Active"
        ))
        # Create hospital
        db.add(Hospital(
            id="H-01", name="City Centre Hospital", location="MG Road",
            lat=12.9716, lng=77.5946, distance_km=2.0,
            capabilities=["Cardiac", "Stroke", "Trauma", "ICU"],
            departments=["Emergency", "Cardiology"],
            department_availability=[{"department": "Cardiology", "available": True}],
            beds_available=10, beds_reserved=2, beds_unavailable=0,
            icu_available=2, icu_reserved=0, icu_unavailable=0,
            oxygen_available=True, status="Available", operational_load=0.5
        ))
        db.add(Hospital(
            id="H-02", name="Suburban Hospital", location="Whitefield",
            lat=12.9698, lng=77.7500, distance_km=18.0,
            capabilities=["General", "Medical"],
            departments=["Emergency"],
            department_availability=[{"department": "Emergency", "available": True}],
            beds_available=1, beds_reserved=0, beds_unavailable=0,
            icu_available=0, icu_reserved=0, icu_unavailable=0,
            oxygen_available=True, status="Available", operational_load=0.9
        ))
        # Create ambulance
        db.add(Ambulance(
            id="A-01", unit="KA-01-A-1001", status="Available",
            paramedic_name="Ramesh Kumar", location="MG Road", lat=12.9716, lng=77.5946
        ))
        db.commit()
    finally:
        db.close()
    yield
    Base.metadata.drop_all(bind=test_engine)
    test_engine.dispose()
    try:
        if os.path.exists("./test_seta_hrc.db"):
            os.remove("./test_seta_hrc.db")
    except Exception:
        pass


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def dispatcher_token():
    return create_access_token(data={"sub": "U-TEST-01", "role": "dispatcher", "email": "dispatcher@test.com"})


@pytest.fixture
def hospital_token():
    return create_access_token(data={"sub": "U-TEST-02", "role": "hospital", "email": "hospital@test.com"})


@pytest.fixture
def paramedic_token():
    return create_access_token(data={"sub": "U-TEST-03", "role": "paramedic", "email": "paramedic@test.com"})


@pytest.fixture
def admin_token():
    return create_access_token(data={"sub": "U-TEST-04", "role": "admin", "email": "admin@test.com"})
