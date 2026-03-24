"""
RapidRescue Backend — Message Routes
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.database import get_db
from app.models import Message, User
from app.schemas import MessageCreate, MessageResponse
from app.auth import get_current_user, get_current_user_optional, get_device_or_auth_user

router = APIRouter(prefix="/api/messages", tags=["Messages"])


@router.get("/")
async def list_messages(
    message_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    identity: dict = Depends(get_device_or_auth_user),
):
    query = select(Message)
    user_id = identity["user_id"]
    db_user_id = identity.get("db_user_id")

    if message_type:
        query = query.where(Message.message_type == message_type)
    else:
        # Show messages relevant to this user (by tag or db id)
        conditions = [
            Message.is_broadcast == True,
            Message.message_type == "public",
            Message.sender_tag == user_id,
            Message.recipient_tag == user_id,
        ]
        if db_user_id:
            conditions.extend([
                Message.sender_id == db_user_id,
                Message.recipient_id == db_user_id,
            ])
        query = query.where(or_(*conditions))

    result = await db.execute(query.order_by(Message.created_at.desc()))
    msgs = [MessageResponse.model_validate(m).model_dump() for m in result.scalars().all()]
    return {"status": "success", "data": msgs}


@router.post("/", status_code=201)
async def send_message(
    data: MessageCreate,
    db: AsyncSession = Depends(get_db),
    identity: dict = Depends(get_device_or_auth_user),
):
    # Use db_user_id if authenticated, fall back to user_id tag
    sender_id = identity.get("db_user_id") or identity["user_id"]
    sender_name = identity["display_name"]
    sender_tag = identity["user_id"]

    # Resolve recipient by user_tag if provided
    recipient_id = data.recipient_id
    recipient_tag = data.recipient_tag

    if recipient_tag and not recipient_id:
        result = await db.execute(select(User).where(User.user_tag == recipient_tag))
        recipient = result.scalar_one_or_none()
        if recipient:
            recipient_id = recipient.id

    msg = Message(
        sender_id=sender_id,
        sender_name=sender_name,
        sender_tag=sender_tag,
        recipient_id=recipient_id,
        recipient_tag=recipient_tag,
        content=data.content,
        message_type=data.message_type.value,
        is_broadcast=data.is_broadcast or data.message_type.value == "public",
        image_url=data.image_url,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return {"status": "success", "data": MessageResponse.model_validate(msg).model_dump()}


@router.patch("/{message_id}/read")
async def mark_as_read(
    message_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Message).where(Message.id == message_id))
    msg = result.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found.")
    msg.is_read = True
    await db.commit()
    return {"status": "success", "data": {"id": msg.id, "is_read": True}}


@router.delete("/{message_id}")
async def delete_message(
    message_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Message).where(Message.id == message_id))
    msg = result.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found.")
    if msg.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this message.")
    await db.delete(msg)
    await db.commit()
    return {"status": "success", "message": "Deleted successfully."}
