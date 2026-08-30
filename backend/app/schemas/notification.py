from pydantic import BaseModel
from datetime import datetime

class NotificationResponse(BaseModel):
    id: int
    user_id: int
    type: str
    title: str
    message: str
    severity: str
    is_read: bool
    created_at: datetime
    unique_key: str

    class Config:
        from_attributes = True
