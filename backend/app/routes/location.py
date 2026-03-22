"""
RapidRescue Backend — Location Routes
"""

from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import UserLocation, User
from app.schemas import LocationUpdate, LocationResponse
from app.auth import get_current_user

router = APIRouter(prefix="/api/location", tags=["Location"])


@router.post("/", response_model=LocationResponse, status_code=201)
async def update_location(
    data: LocationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update/log the user's current location."""
    loc = UserLocation(
        user_id=current_user.id,
        latitude=data.latitude,
        longitude=data.longitude,
        accuracy=data.accuracy,
    )
    db.add(loc)
    await db.commit()
    await db.refresh(loc)
    return loc


@router.get("/history", response_model=List[LocationResponse])
async def location_history(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the current user's location history (most recent first)."""
    result = await db.execute(
        select(UserLocation)
        .where(UserLocation.user_id == current_user.id)
        .order_by(UserLocation.timestamp.desc())
        .limit(50)
    )
    return result.scalars().all()
