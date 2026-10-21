import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import engine, Base
import app.models  # Ensures all models are registered with Base metadata
from app.core.websocket import ws_manager
from app.core.security import decode_access_token

from app.routers import (
    auth,
    emergencies,
    triage,
    hospitals,
    recommendations,
    dispatch,
    referrals,
    reservations,
    analytics,
    audit,
    notifications,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seta_hrc")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing SETA-HRC database tables...")
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables initialized successfully.")
    except Exception as exc:
        logger.error("Failed to initialize database tables: %s", exc)
    yield
    logger.info("SETA-HRC Backend shutting down.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Smart Emergency Triage, Ambulance & Hospital Resource Coordination System Backend API",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health checks
@app.get("/healthz", tags=["Health"])
@app.get("/api/healthz", tags=["Health"])
def health_check():
    return {"status": "ok", "service": "SETA-HRC Backend", "version": settings.VERSION}


@app.get("/", tags=["Root"])
def root():
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs_url": "/docs",
        "api_prefix": settings.API_V1_STR,
        "mode": "Simulated Research & Operational Demo",
    }


# WebSocket endpoint for real-time coordination updates
@app.websocket("/ws")
@app.websocket("/api/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(default="")
):
    await ws_manager.connect(websocket)
    try:
        # Welcome message
        await websocket.send_json({
            "type": "CONNECTION_ESTABLISHED",
            "message": "Connected to SETA-HRC real-time coordination broadcast stream."
        })
        while True:
            # Keep-alive receive loop
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as exc:
        logger.warning("WebSocket exception: %s", exc)
        ws_manager.disconnect(websocket)


# Mount routers under /api
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(emergencies.router, prefix=settings.API_V1_STR)
app.include_router(triage.router, prefix=settings.API_V1_STR)
app.include_router(hospitals.router, prefix=settings.API_V1_STR)
app.include_router(recommendations.router, prefix=settings.API_V1_STR)
app.include_router(dispatch.router, prefix=settings.API_V1_STR)
app.include_router(referrals.router, prefix=settings.API_V1_STR)
app.include_router(reservations.router, prefix=settings.API_V1_STR)
app.include_router(analytics.router, prefix=settings.API_V1_STR)
app.include_router(audit.router, prefix=settings.API_V1_STR)
app.include_router(notifications.router, prefix=settings.API_V1_STR)
