"""
RapidRescue Backend — Chat Assistant Routes
"""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import ChatMessage, User
from app.schemas import ChatInput, ChatMessageResponse
from app.auth import get_current_user

router = APIRouter(prefix="/api/chat", tags=["Assistant Chat"])


@router.get("/")
async def get_chat_history(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.user_id == current_user.id)
        .order_by(ChatMessage.created_at.asc())
        .limit(50)
    )
    messages = [ChatMessageResponse.model_validate(m).model_dump() for m in result.scalars().all()]
    return {"status": "success", "data": messages}


@router.post("/")
async def send_chat_message(
    data: ChatInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Save user message
    user_msg = ChatMessage(user_id=current_user.id, role="user", content=data.message)
    db.add(user_msg)

    # Simple mock response logic for now
    mock_response = "I have received your message. Please stay safe. How else can I assist you with your emergency?"
    if "safe route" in data.message.lower():
        mock_response = "I'm calculating the safest route for you away from the recent danger zones."
    elif "shelter" in data.message.lower():
        mock_response = "There are 3 shelters within a 2-mile radius. I can guide you to the nearest one."
        
    ai_msg = ChatMessage(user_id=current_user.id, role="assistant", content=mock_response)
    db.add(ai_msg)
    
    await db.commit()
    await db.refresh(user_msg)
    await db.refresh(ai_msg)
    
    return {
        "status": "success",
        "data": {
            "user_message": ChatMessageResponse.model_validate(user_msg).model_dump(),
            "assistant_response": ChatMessageResponse.model_validate(ai_msg).model_dump(),
        }
    }
