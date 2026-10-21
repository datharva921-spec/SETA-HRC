# SETA-HRC FastAPI Backend

This is the backend service for **SETA-HRC: Smart Emergency Triage, Ambulance & Hospital Resource Coordination System**.

> **SIMULATION NOTICE:**  
> All hospital bed levels, patient records, ambulance GPS locations, and triage queues are **simulated demonstration data**. The system is not connected to live 911 dispatch or actual clinical electronic health records.

## Quick Start

### 1. Virtual Environment & Dependencies
```powershell
cd setahrc-backend
.\venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Environment Configuration
Copy `.env.example` to `.env` if not already present:
```ini
DATABASE_URL=mysql+pymysql://root:root@localhost:3306/seta_hrc
SQLITE_FALLBACK=True
JWT_SECRET_KEY=seta_hrc_super_secret_jwt_key_2026_safe_demo
ACCESS_TOKEN_EXPIRE_MINUTES=1440
PORT=8000
HOST=0.0.0.0
RELOAD=True
```

### 3. Database Migration & Seed
```powershell
alembic upgrade head
python scripts/seed.py
```

### 4. Run Server
```powershell
python run.py
```
- API Base: `http://localhost:8000/api`
- Swagger Docs: `http://localhost:8000/docs`
- WebSocket: `ws://localhost:8000/ws`

### 5. Run Automated Tests
```powershell
pytest -v
```

See the root [README.md](../README.md) for full project architecture and workflow instructions.
