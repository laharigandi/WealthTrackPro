import asyncio
import json
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.schemas.notification import NotificationResponse, UnreadCountResponse
from app.services.notifications import NotificationService, notification_stream_manager
from app.api.deps import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def get_user_from_token_or_query(
    request: Request,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
) -> User:
    """
    Authenticate user from query parameter '?token=...' (for browser EventSource / SSE)
    or Authorization header 'Bearer ...'.
    """
    auth_header = request.headers.get("Authorization")
    raw_token = None

    if auth_header and auth_header.startswith("Bearer "):
        raw_token = auth_header.split(" ", 1)[1]
    elif token:
        raw_token = token

    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = jwt.decode(raw_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id_str: str = payload.get("sub")
        token_type: str = payload.get("type")
        if user_id_str is None or token_type != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token credentials.",
            )
        user_id = int(user_id_str)
    except (JWTError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials.",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found.",
        )
    return user


@router.get("", response_model=List[NotificationResponse])
def get_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Read-only retrieval of user's active notifications.
    Never creates or evaluates notifications during a GET request.
    """
    return NotificationService.get_user_notifications(db, current_user)


@router.get("/unread-count", response_model=UnreadCountResponse)
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Read-only query of unread notifications count.
    """
    count = NotificationService.get_unread_count(db, current_user)
    return {"unread_count": count}


@router.patch("/read-all")
@router.post("/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = NotificationService.mark_all_as_read(db, current_user)
    NotificationService.broadcast_user_notifications(db, current_user.id)
    return {"message": f"Successfully marked {count} notifications as read."}


@router.patch("/{id}/read", response_model=NotificationResponse)
@router.post("/{id}/read", response_model=NotificationResponse)
def mark_individual_read(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    n = NotificationService.mark_as_read(db, current_user, id)
    if not n:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found."
        )
    NotificationService.broadcast_user_notifications(db, current_user.id)
    return n


@router.delete("/{id}")
def delete_notification(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deleted = NotificationService.delete_notification(db, current_user, id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found."
        )
    NotificationService.broadcast_user_notifications(db, current_user.id)
    return {"message": "Notification deleted successfully."}


@router.get("/stream")
async def notification_stream(
    request: Request,
    current_user: User = Depends(get_user_from_token_or_query),
    db: Session = Depends(get_db),
):
    """
    Server-Sent Events (SSE) real-time endpoint for notifications.
    Streams notification events immediately when portfolio, goals, or KYC status changes.
    """
    user_id = current_user.id
    q = await notification_stream_manager.subscribe(user_id)

    async def event_generator():
        try:
            # Send initial connected event + initial state from existing database records (read-only)
            notifications = NotificationService.get_user_notifications(db, current_user)
            unread_count = sum(1 for n in notifications if not n.is_read)
            initial_data = {
                "notifications": [
                    {
                        "id": n.id,
                        "user_id": n.user_id,
                        "type": n.type,
                        "title": n.title,
                        "message": n.message,
                        "severity": n.severity,
                        "is_read": n.is_read,
                        "is_active": n.is_active,
                        "entity_type": n.entity_type,
                        "entity_id": n.entity_id,
                        "milestone": n.milestone,
                        "created_at": n.created_at.isoformat() if n.created_at else None,
                        "unique_key": n.unique_key,
                    }
                    for n in notifications
                ],
                "unread_count": unread_count,
            }
            yield f"event: connected\ndata: {json.dumps({'status': 'connected', 'user_id': user_id})}\n\n"
            yield f"event: notification_update\ndata: {json.dumps(initial_data)}\n\n"

            while True:
                # Check for client disconnect
                if await request.is_disconnected():
                    break

                try:
                    # Wait for message with 20 second timeout for keepalive ping
                    msg = await asyncio.wait_for(q.get(), timeout=20.0)
                    yield msg
                except asyncio.TimeoutError:
                    # Send comment ping to prevent intermediate reverse proxies/browsers from timing out
                    yield ": ping\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            await notification_stream_manager.unsubscribe(user_id, q)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Content-Type": "text/event-stream",
        },
    )
