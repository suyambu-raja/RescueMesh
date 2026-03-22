"""
RapidRescue Backend — Contacts Routes
"""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.database import get_db
from app.models import Contact, User
from app.schemas import ContactCreate, ContactResponse
from app.auth import get_current_user, get_current_user_optional

router = APIRouter(prefix="/api/contacts", tags=["Contacts"])


@router.get("/")
async def list_contacts(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    if not current_user:
        return {"status": "success", "data": []}
    result = await db.execute(
        select(Contact).where(Contact.owner_id == current_user.id).order_by(Contact.name.asc())
    )
    contacts = [ContactResponse.model_validate(c).model_dump() for c in result.scalars().all()]
    return {"status": "success", "data": contacts}


@router.post("/", status_code=201)
async def add_contact(
    data: ContactCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contact = Contact(
        owner_id=current_user.id,
        name=data.name,
        user_tag=data.user_tag,
        phone=data.phone,
        contact_user_id=data.contact_user_id,
        is_emergency=data.is_emergency,
    )
    db.add(contact)
    await db.commit()
    await db.refresh(contact)
    return {"status": "success", "data": ContactResponse.model_validate(contact).model_dump()}
