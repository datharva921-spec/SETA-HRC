import json
import logging
from typing import List
from fastapi import WebSocket

logger = logging.getLogger("seta_hrc.websocket")


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info("WebSocket client connected. Active: %d", len(self.active_connections))

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info("WebSocket client disconnected. Active: %d", len(self.active_connections))

    async def broadcast(self, event_type: str, data: dict):
        payload = json.dumps({"type": event_type, "data": data}, default=str)
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(payload)
            except Exception as exc:
                logger.warning("Error sending WebSocket message: %s", exc)
                disconnected.append(connection)

        for dead in disconnected:
            self.disconnect(dead)


ws_manager = ConnectionManager()
