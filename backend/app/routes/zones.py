"""
RapidRescue Backend — Danger Zone Routes
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import DangerZone, User
from app.schemas import DangerZoneCreate, DangerZoneResponse
from app.auth import get_current_user, get_device_or_auth_user

router = APIRouter(prefix="/api/zones", tags=["Danger Zones"])


@router.get("/")
async def list_zones(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DangerZone).where(DangerZone.is_active == True).order_by(DangerZone.created_at.desc()))
    zones = [DangerZoneResponse.model_validate(z).model_dump() for z in result.scalars().all()]
    return {"status": "success", "data": zones}


@router.get("/{zone_id}")
async def get_zone(zone_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DangerZone).where(DangerZone.id == zone_id))
    zone = result.scalar_one_or_none()
    if not zone:
        raise HTTPException(status_code=404, detail="Danger zone not found.")
    return {"status": "success", "data": DangerZoneResponse.model_validate(zone).model_dump()}


@router.post("/", status_code=201)
async def report_zone(
    data: DangerZoneCreate,
    db: AsyncSession = Depends(get_db),
    identity: dict = Depends(get_device_or_auth_user),
):
    zone = DangerZone(
        **data.model_dump(), 
        reported_by=identity.get("db_user_id"),
        reporter_tag=identity.get("user_id")
    )
    db.add(zone)
    await db.commit()
    await db.refresh(zone)
    return {"status": "success", "data": DangerZoneResponse.model_validate(zone).model_dump()}


@router.delete("/{zone_id}")
async def delete_zone(
    zone_id: str,
    db: AsyncSession = Depends(get_db),
    identity: dict = Depends(get_device_or_auth_user),
):
    result = await db.execute(select(DangerZone).where(DangerZone.id == zone_id))
    zone = result.scalar_one_or_none()
    
    if not zone:
        raise HTTPException(status_code=404, detail="Danger zone not found.")
    
    # Check permissions: Original DB user OR same Device tag
    can_delete = False
    
    # 1. Check logged-in user match
    if zone.reported_by and identity.get("db_user_id") == zone.reported_by:
        can_delete = True
    
    # 2. Check device tag match (for anonymous OR logged in users on same device)
    if not can_delete and zone.reporter_tag and identity.get("user_id") == zone.reporter_tag:
        can_delete = True
        
    if not can_delete:
        raise HTTPException(status_code=403, detail="You do not have permission to delete this report.")
        
    await db.delete(zone)
    await db.commit()
    return {"status": "success", "message": "Danger zone deleted successfully."}


@router.delete("/{zone_id}", status_code=200)
async def deactivate_zone(
    zone_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(select(DangerZone).where(DangerZone.id == zone_id))
    zone = result.scalar_one_or_none()
    if not zone:
        raise HTTPException(status_code=404, detail="Danger zone not found.")
    zone.is_active = False
    await db.commit()
    return {"status": "success", "message": "Zone deactivated"}
