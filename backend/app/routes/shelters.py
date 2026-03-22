"""
RapidRescue Backend — Shelter Routes
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Shelter
from app.schemas import ShelterCreate, ShelterUpdate, ShelterResponse
from app.auth import get_current_user

router = APIRouter(prefix="/api/shelters", tags=["Shelters"])


@router.get("/")
async def list_shelters(
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db),
):
    query = select(Shelter)
    if active_only:
        query = query.where(Shelter.is_active == True)
    result = await db.execute(query)
    shelters = [ShelterResponse.model_validate(s).model_dump() for s in result.scalars().all()]
    return {"status": "success", "data": shelters}


@router.get("/{shelter_id}")
async def get_shelter(shelter_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Shelter).where(Shelter.id == shelter_id))
    shelter = result.scalar_one_or_none()
    if not shelter:
        raise HTTPException(status_code=404, detail="Shelter not found.")
    return {"status": "success", "data": ShelterResponse.model_validate(shelter).model_dump()}


@router.post("/", status_code=201)
async def create_shelter(
    data: ShelterCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    shelter = Shelter(**data.model_dump())
    db.add(shelter)
    await db.commit()
    await db.refresh(shelter)
    return {"status": "success", "data": ShelterResponse.model_validate(shelter).model_dump()}


@router.patch("/{shelter_id}")
async def update_shelter(
    shelter_id: str,
    data: ShelterUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(select(Shelter).where(Shelter.id == shelter_id))
    shelter = result.scalar_one_or_none()
    if not shelter:
        raise HTTPException(status_code=404, detail="Shelter not found.")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(shelter, key, value)
    await db.commit()
    await db.refresh(shelter)
    return {"status": "success", "data": ShelterResponse.model_validate(shelter).model_dump()}
