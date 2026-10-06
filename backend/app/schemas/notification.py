from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional

class NotificationResponse(BaseModel):
    id: int
    user_id: int
    type: str
    title: str
    message: str
    severity: str
    is_read: bool
    is_active: bool = True
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    milestone: Optional[float] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    unique_key: str

    model_config = ConfigDict(from_attributes=True)

class UnreadCountResponse(BaseModel):
    unread_count: int

