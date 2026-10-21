from datetime import datetime
from pydantic import BaseModel


class NotificationResponse(BaseModel):
    id: str
    title: str
    message: str
    type: str
    read: bool
    created_at: datetime

    class Config:
        from_attributes = True
