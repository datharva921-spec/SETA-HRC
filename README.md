# SETA-HRC: Smart Emergency Triage, Ambulance & Hospital Resource Coordination System

> **DISCLAIMER & SIMULATION NOTICE:**  
> This system is an academic engineering and operational prototype demonstrated strictly using **simulated demonstration data**. It is **NOT** connected to live municipal emergency dispatch systems (911/112/108), real ambulance telemetry, actual hospital inventory, or clinically certified medical AI models. All patient vitals, hospital bed counts, ambulance GPS markers, and triage recommendations are synthetic and for evaluation and demonstration purposes only.

---

## 1. Overview & Architecture

SETA-HRC integrates a reactive **React 19 + TypeScript + Vite + Tailwind CSS** frontend with a high-performance **Python FastAPI + SQLAlchemy + MySQL** backend (with automatic zero-config SQLite development fallback). Real-time situational awareness is powered by **WebSockets**, allowing emergency dispatchers, hospital resource managers, paramedics, and administrators to coordinate life-saving workflows with zero manual screen refreshes.

### Key Architectural Components

```
+---------------------------------------------------------------------------------------+
|                                    REACT FRONTEND                                     |
|  - Role-based Dashboard (Dispatcher, Hospital Staff, Paramedic, System Admin)         |
|  - Real-time Acuity Priority Queue (Level 1 Resuscitation -> Level 5 Non-Urgent)      |
|  - Multi-Factor Hospital Recommendation Card & Transparent Factor Explanations        |
|  - Ambulance Dispatch Tracker & Status Stepper (Dispatched -> En Route -> Hospital)   |
|  - Hospital Intake Referral Desk (Acceptance / Rejection with Reason)                 |
|  - Transactional Resource Reservation & Bed Inventory Monitor                         |
|  - Experimental Explainable Clinical NLP Symptom Classifier & Evaluation Benchmarks   |
+-------------------------------------------+-------------------------------------------+
                                            |
                         REST APIs + WebSocket (ws://localhost:8000/ws)
                                            |
+-------------------------------------------v-------------------------------------------+
|                                FASTAPI BACKEND & CORE                                 |
|  - /api/auth: JWT Authentication & Role-Based Access Control (RBAC)                   |
|  - /api/emergencies: Case Intake, Status Progression, & Lifecycle History             |
|  - /api/triage: Deterministic Rule-Based Triage (ESI / Manchester Compatible)         |
|  - /api/recommendations: Multi-Factor Scoring (Capability 35%, Bed/ICU 30%, Dist 20%) |
|  - /api/dispatch: Ambulance Assignment & Live Status Progression                      |
|  - /api/referrals: Hospital Referral Acceptance & Rejection Workflows                 |
|  - /api/reservations: Atomic Capacity-Checked Resource Allocations (Zero-Oversell)    |
|  - /api/analytics: System Performance Metrics, Audit History, SETA vs FIFO Evaluation |
|  - ConnectionManager: Broadcasts live mutations over WebSockets to connected clients  |
+-------------------------------------------+-------------------------------------------+
                                            |
                    SQLAlchemy ORM + Alembic Schema Migrations
                                            |
+-------------------------------------------v-------------------------------------------+
|                         DATABASE LAYER (MySQL / SQLite)                               |
|  - users, hospitals, ambulances, emergencies, emergency_histories                     |
|  - hospital_recommendations, resource_reservations, resource_histories                |
|  - notifications, audit_logs                                                          |
+---------------------------------------------------------------------------------------+
```

---

## 2. Directory Structure

```
SETA_HRC_PROJECT/
├── README.md                                 # Master documentation and run guide
├── run_backend.bat                           # Windows batch launcher for backend
├── run_frontend.bat                          # Windows batch launcher for frontend
├── setahrc-backend/
│   ├── .env                                  # Active backend environment configuration
│   ├── .env.example                          # Environment configuration template
│   ├── run.py                                # Application server runner (uvicorn)
│   ├── requirements.txt                      # Python dependencies
│   ├── alembic.ini                           # Alembic database migration config
│   ├── seta_hrc.db                           # Local SQLite database (when MySQL offline)
│   ├── alembic/
│   │   └── versions/                         # Database schema migrations
│   │       └── f158552ad923_initial_schema.py
│   ├── scripts/
│   │   └── seed.py                           # Idempotent database seed script
│   ├── tests/
│   │   ├── conftest.py                       # Pytest fixtures and isolated test DB
│   │   ├── test_auth.py                      # Auth & RBAC unit tests
│   │   ├── test_emergencies.py               # Emergency intake & triage queue tests
│   │   ├── test_scoring.py                   # Recommendation algorithm & Haversine tests
│   │   ├── test_analytics.py                 # Analytics, benchmark & NLP tests
│   │   └── test_workflow.py                  # End-to-end coordination lifecycle tests
│   └── app/
│       ├── config.py                         # Pydantic Settings & database fallback
│       ├── database.py                       # SQLAlchemy engine & session factory
│       ├── main.py                           # FastAPI application & WebSocket endpoint
│       ├── core/
│       │   ├── security.py                   # Direct bcrypt hashing & JWT tokens
│       │   ├── deps.py                       # Dependency injection & RBAC checks
│       │   ├── triage.py                     # Deterministic rule-based triage engine
│       │   ├── scoring.py                    # Multi-factor hospital recommendation algorithm
│       │   ├── ai_analytics.py               # Explainable synthetic classifier & benchmarks
│       │   └── websocket.py                  # WebSocket connection manager
│       ├── models/                           # SQLAlchemy relational models
│       ├── schemas/                          # Pydantic request / response schemas
│       └── routers/                          # REST API routers
└── setahrc-frontend/
    └── SETA-HRC-Emergency-Coordination-Frontend/
        ├── package.json
        ├── pnpm-workspace.yaml
        └── artifacts/seta-hrc/
            ├── .env                          # Frontend environment config
            ├── .env.example                  # Frontend environment template
            ├── package.json                  # Frontend dependencies
            ├── vite.config.ts                # Vite configuration with local port fallbacks
            └── src/
                ├── App.tsx                   # Main connected application UI & role switcher
                ├── lib/
                │   ├── api-client.ts         # Axios client with JWT interceptors
                │   ├── types.ts              # Data types & backend normalizers
                │   └── use-websocket.ts      # Live WebSocket sync hook
                ├── hooks/
                │   └── use-live-operations.ts# Central operations data & mutation hook
                └── services/                 # Modular API client services
                    ├── auth.ts               # Login, registration, profile service
                    ├── emergencies.ts        # Case intake, triage, queue service
                    ├── hospitals.ts          # Hospital capacity & recommendations
                    ├── ambulances.ts         # Dispatch status & telemetry service
                    ├── referrals.ts          # Acceptance / rejection / reservation service
                    ├── analytics.ts          # Metrics, evaluation benchmarks, audit trail
                    └── notifications.ts      # Alerts & notifications service
```

---

## 3. Environment Configuration

### Backend (`setahrc-backend/.env`)

```ini
# Database Connection URL (MySQL)
DATABASE_URL=mysql+pymysql://root:root@localhost:3306/seta_hrc

# SQLite Fallback: Set to True to allow automatic fallback to local SQLite if MySQL is offline
SQLITE_FALLBACK=True

# JWT Authentication
JWT_SECRET_KEY=seta_hrc_super_secret_jwt_key_2026_safe_demo
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Server settings
PORT=8000
HOST=0.0.0.0
RELOAD=True
```

### Frontend (`setahrc-frontend/SETA-HRC-Emergency-Coordination-Frontend/artifacts/seta-hrc/.env`)

```ini
VITE_API_BASE_URL=http://localhost:8000/api
VITE_WS_URL=ws://localhost:8000/ws
PORT=3000
```

---

## 4. Database Setup, Migrations & Seeding

The application natively supports **MySQL 8.0+** and features a resilient **SQLite automatic fallback** mode for quick local setup without requiring a pre-installed MySQL service.

### Option A: MySQL 8.0 Setup (Production / Standard)
1. Ensure your local MySQL service is running on port 3306.
2. Create the target database:
   ```sql
   CREATE DATABASE IF NOT EXISTS seta_hrc CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
3. Update `DATABASE_URL` in `setahrc-backend/.env` with your username and password.

### Option B: Zero-Config SQLite Fallback
If MySQL is not installed or unreachable, the application automatically creates and uses `seta_hrc.db` in `setahrc-backend/`.

### Run Alembic Migrations
From `setahrc-backend/`:
```powershell
cd setahrc-backend
.\venv\Scripts\activate
alembic upgrade head
```

### Run Repeatable Development Seed Script
The seed script is **idempotent** (can be rerun at any time without duplicating records) and populates the database with:
- **4 demonstration user accounts** across all system roles.
- **5 simulated hospitals** with diverse capabilities (Level 1 Trauma, Cardiac, Burn Center, Pediatric ICU, General).
- **6 simulated ambulances** with varying statuses (Available, Dispatched, Maintenance).
- **6 fictional emergency cases** in various triage priority categories.
- Sample resource reservations, audit logs, and operational notifications.

```powershell
cd setahrc-backend
.\venv\Scripts\python scripts/seed.py
```

### Demonstration Accounts & Credentials:
| Role | Email | Password | Allowed Capabilities |
| :--- | :--- | :--- | :--- |
| **Dispatcher** | `asha.nair@seta-hrc.org` | `Dispatcher@123` | Intake cases, run triage, approve recommendations, dispatch ambulances |
| **Hospital Staff** | `rohan.shetty@seta-hrc.org` | `Hospital@123` | Review referrals, accept/reject cases, update bed/ICU/ventilator capacity |
| **Paramedic** | `priya.menon@seta-hrc.org` | `Paramedic@123` | Advance ambulance dispatch status, submit field vitals and handover notes |
| **Administrator** | `ops@seta-hrc.org` | `Admin@123` | View full audit trail, configure system settings, trigger AI evaluations |

---

## 5. How to Run the Application Locally

The frontend and backend run as separate local development servers.

### Terminal 1: Backend Server (FastAPI)
```powershell
cd "setahrc-backend"
.\venv\Scripts\activate
python run.py
```
- API Base URL: `http://localhost:8000/api`
- Interactive Swagger UI: `http://localhost:8000/docs`
- ReDoc Documentation: `http://localhost:8000/redoc`
- WebSocket Endpoint: `ws://localhost:8000/ws`

### Terminal 2: Frontend Server (Vite)
```powershell
cd "setahrc-frontend\SETA-HRC-Emergency-Coordination-Frontend\artifacts\seta-hrc"
pnpm run dev
```
- Application Web UI: `http://localhost:3000`

---

## 6. Running Automated Tests

The test suite validates authentication, RBAC boundaries, deterministic triage rules, multi-factor recommendation math, transactional resource reservations, and the end-to-end coordination lifecycle.

```powershell
cd "setahrc-backend"
.\venv\Scripts\pytest -v
```

### Verified Test Cases (14/14 Passing):
1. `tests/test_auth.py::test_login_success` - Validates JWT issuance and user profile response.
2. `tests/test_auth.py::test_login_invalid_password` - Confirms 401 unauthorized rejection.
3. `tests/test_auth.py::test_register_new_user` - Tests user registration and duplicate email prevention.
4. `tests/test_auth.py::test_get_current_user` - Tests bearer token resolution.
5. `tests/test_auth.py::test_admin_list_users` - Enforces admin-only RBAC constraint.
6. `tests/test_emergencies.py::test_create_emergency_critical_triage` - Tests emergency case intake with rule-based triage.
7. `tests/test_emergencies.py::test_triage_priority_queue_ordering` - Tests strict priority ordering (Priority 1 first).
8. `tests/test_scoring.py::test_haversine_distance` - Validates geographical distance calculations.
9. `tests/test_scoring.py::test_deterministic_scoring_reproducibility` - Validates consistent hospital ranking weights.
10. `tests/test_workflow.py::test_complete_emergency_coordination_lifecycle` - Comprehensive test covering steps A through N.
11. `tests/test_workflow.py::test_concurrent_reservation_capacity_limit` - Asserts reservations cannot exceed hospital capacity.
12. `tests/test_analytics.py::test_analytics_summary` - Tests dashboard KPI aggregations directly from the database.
13. `tests/test_analytics.py::test_system_evaluation` - Tests SETA-HRC vs Nearest-only and Priority vs FIFO simulation benchmarks.
14. `tests/test_analytics.py::test_synthetic_text_classification` - Tests explainable clinical symptom classifier with uncertainty warnings.

---

## 7. End-to-End Coordination Workflow Walkthrough (A - N)

Follow these steps to experience the complete coordination workflow:

1. **A. Log in as a Dispatcher:**  
   Open `http://localhost:3000`. Click the demo dispatcher pill (`Asha Nair - Dispatcher`) or log in using `asha.nair@seta-hrc.org` / `Dispatcher@123`.

2. **B. Register a Demonstration Emergency:**  
   In the **Emergency Intake** form, enter patient age (e.g. 58), systolic BP (85), SpO2 (88%), Heart Rate (125), and chief complaint: `"Sudden severe crushing chest pain radiating to left arm"`. Click **Register Emergency**.

3. **C. Generate a Transparent Triage Recommendation:**  
   Click **Run Rule-Based Triage**. The engine classifies the case as **Priority 1 (Critical / Resuscitation)** with an explicit rationale displaying which vital signs violated critical thresholds.

4. **D. View the Updated Priority Queue:**  
   Observe the **Active Priority Queue**. The new emergency is dynamically positioned at the top of the queue according to acuity score and timestamp.

5. **E. Retrieve Hospital Availability:**  
   Select the emergency case. The system queries all networked hospitals, retrieving real-time bed, ICU, and ventilator availability.

6. **F. Generate Ranked Hospital Recommendations:**  
   Click **Generate Recommendations**. The multi-factor scoring engine ranks hospitals using weighted factors:
   - Specialty capability match (35%)
   - Critical resource availability (30%)
   - Haversine transit distance (20%)
   - Current ED operational load (15%)

7. **G. Obtain Human Approval for a Recommendation:**  
   Review the top-ranked hospital's factor breakdown. Click **Approve Recommendation** to designate the target facility.

8. **H. Assign an Available Ambulance:**  
   Select an available ambulance (e.g. `AMB-01`) from the fleet dropdown and click **Dispatch Ambulance**.

9. **I. Send Referral to Hospital:**  
   The referral status transitions to `Referred`, sending an urgent notification to the hospital intake desk.

10. **J. Record Hospital Acceptance or Rejection:**  
    Switch role to **Hospital Staff** (`Rohan Shetty`). Open the hospital desk view and click **Accept Referral** (or choose **Reject** with a recorded operational rationale).

11. **K. Update Resource Reservations Transactionally:**  
    Upon acceptance, reserve an ICU bed and ventilator. The backend executes an atomic database check ensuring reservations never exceed available capacity and decrements hospital availability.

12. **L. Update Ambulance and Emergency Status:**  
    Switch role to **Paramedic** (`Priya Menon`). Advance status: `En Route` -> `On Scene` -> `Transporting` -> `Arrived`. Input transit vitals and handover notes.

13. **M. Complete the Case:**  
    Click **Complete Case Handover**. The emergency transitions to `Resolved`, the ambulance returns to `Available`, and reserved resources transition to `Occupied`.

14. **N. Verify Database Records, Audit History & Analytics:**  
    Switch to **Administrator** (`Ops Team`). Open the **Audit Trail** to inspect tamper-evident logs for all operations and view the **System Evaluation** benchmark comparison.

---

## 8. Complete List of Implemented REST API Endpoints

### Authentication & Users (`/api/auth`)
- `POST /api/auth/register` - Create new user account.
- `POST /api/auth/login` - Authenticate credentials and receive JWT bearer token.
- `GET /api/auth/me` - Retrieve current user profile and role.
- `GET /api/auth/users` - Admin user directory.

### Emergency Intake & Triage (`/api/emergencies`, `/api/triage`)
- `GET /api/emergencies` - Filter and list emergency cases.
- `POST /api/emergencies` - Register new emergency case.
- `GET /api/emergencies/{id}` - Case details with vitals, history, and status.
- `POST /api/emergencies/{id}/triage` - Execute transparent rule-based triage.
- `GET /api/emergencies/queue/priority` - Priority-sorted queue.
- `PATCH /api/emergencies/{id}/status` - Advance emergency lifecycle state.
- `POST /api/triage/assess` - Stateless triage evaluation helper.

### Hospitals & Recommendations (`/api/hospitals`, `/api/recommendations`)
- `GET /api/hospitals` - List hospitals with real-time bed, ICU, ventilator capacity.
- `GET /api/hospitals/{id}` - Single hospital profile and inventory.
- `PATCH /api/hospitals/{id}/resources` - Update hospital resource counts.
- `POST /api/recommendations/generate` - Run deterministic scoring algorithm.
- `POST /api/recommendations/{id}/approve` - Dispatcher approval of recommendation.

### Ambulance Dispatch (`/api/dispatch`)
- `GET /api/dispatch/ambulances` - List ambulances with GPS coordinates and crew info.
- `POST /api/dispatch/assign` - Assign ambulance to emergency case.
- `PATCH /api/dispatch/{ambulance_id}/status` - Advance status (`Dispatched`, `En Route`, `On Scene`, `Transporting`, `Arrived`, `Available`).

### Hospital Referrals (`/api/referrals`)
- `POST /api/referrals/respond` - Hospital intake decision (`Accepted` / `Rejected`).
- `GET /api/referrals/{emergency_id}` - Case referral details and history.

### Resource Reservations (`/api/reservations`)
- `POST /api/reservations` - Atomic reservation creation with capacity check.
- `POST /api/reservations/{id}/release` - Release or cancel reservation.
- `GET /api/reservations/hospital/{hospital_id}` - Active hospital reservations.

### Analytics, Benchmarks & Audit (`/api/analytics`, `/api/audit`, `/api/notifications`)
- `GET /api/analytics/summary` - Live KPI metrics aggregated from DB.
- `GET /api/analytics/evaluation` - Comparative evaluation (SETA vs Nearest, Priority vs FIFO).
- `POST /api/analytics/classify-symptoms` - Explainable synthetic NLP classifier.
- `GET /api/audit` - Paginated audit trail.
- `GET /api/notifications` - Operational notifications.
- `PATCH /api/notifications/{id}/read` - Mark notification as read.
- `GET /healthz` - Service health status.
- `WebSocket /ws` - Live broadcast channel for all connected clients.

---

## 9. Environment Variables Reference

| Variable | Target | Default | Description |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Backend | `mysql+pymysql://root:root@localhost:3306/seta_hrc` | Primary relational database connection string. |
| `SQLITE_FALLBACK` | Backend | `True` | Fallback to SQLite if MySQL is unavailable. |
| `JWT_SECRET_KEY` | Backend | `seta_hrc_super_secret_jwt_key_2026_safe_demo` | Secret key for signing JWT auth tokens. |
| `ACCESS_TOKEN_EXPIRE_MINUTES`| Backend | `1440` (24h) | JWT session expiration in minutes. |
| `PORT` | Backend | `8000` | Port for FastAPI / Uvicorn server. |
| `HOST` | Backend | `0.0.0.0` | Host interface binding. |
| `RELOAD` | Backend | `True` | Enable hot code reload in development. |
| `VITE_API_BASE_URL` | Frontend | `http://localhost:8000/api` | Base HTTP endpoint for backend REST APIs. |
| `VITE_WS_URL` | Frontend | `ws://localhost:8000/ws` | Base WebSocket endpoint for live updates. |
| `PORT` | Frontend | `3000` | Local dev server port for Vite. |

---

## 10. System Assumptions & Known Boundaries

1. **Simulated Geospatial Data:** Distance calculations use the Haversine formula based on synthetic latitude and longitude coordinates in a simulated metropolitan grid. Real road traffic API integration (e.g. Google Maps or OpenStreetMap Matrix API) can be plugged into `app/core/scoring.py`.
2. **Deterministic Triage Rule Base:** Triage scoring adheres to standardized Emergency Severity Index (ESI) thresholds rather than black-box models, ensuring clinical transparency and zero unexplainable recommendations.
3. **Synthetic NLP Symptom Classifier:** The symptom classifier in `app/core/ai_analytics.py` provides transparent keyword extraction and confidence estimates on synthetic emergency notes. It is explicitly accompanied by clinical disclaimers and requires human dispatcher review before any action is taken.
4. **Single-Node WebSocket Manager:** The current WebSocket manager maintains client connections in memory. For horizontal multi-instance production clustering, integrate a Redis Pub/Sub adapter.
