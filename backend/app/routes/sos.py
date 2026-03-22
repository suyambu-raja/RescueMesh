"""
RapidRescue Backend — SOS Alert Routes
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import SOSAlert, User
from app.schemas import SOSAlertCreate, SOSAlertResponse, SOSStatusEnum
from app.auth import get_current_user, get_current_user_optional, hash_password
from typing import Optional

router = APIRouter(prefix="/api/sos", tags=["SOS Alerts"])

ANON_EMAIL = "anonymous@rescue.local"

async def get_or_create_anon_user(db: AsyncSession):
    """Get or create an anonymous user for unauthenticated SOS."""
    result = await db.execute(select(User).where(User.email == ANON_EMAIL))
    anon = result.scalar_one_or_none()
    if anon:
        return anon
    # Pre-hashed "anonymous" password - avoids bcrypt initialization bug
    anon = User(
        full_name="Anonymous Rescuer",
        email=ANON_EMAIL,
        hashed_password="$2b$12$anonymous.placeholder.hash.value.unused",
        user_tag="U_ANON000",
    )
    db.add(anon)
    await db.commit()
    await db.refresh(anon)
    return anon


@router.get("/")
async def list_active_alerts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SOSAlert).where(SOSAlert.status != "resolved").order_by(SOSAlert.created_at.desc())
    )
    alerts = [SOSAlertResponse.model_validate(a).model_dump() for a in result.scalars().all()]
    return {"status": "success", "data": alerts}


@router.post("/", status_code=201)
async def create_alert(
    data: SOSAlertCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    if not current_user:
        current_user = await get_or_create_anon_user(db)

    alert = SOSAlert(
        user_id=current_user.id,
        latitude=data.latitude,
        longitude=data.longitude,
        battery_percentage=data.battery_percentage,
        message=data.message,
        sos_type=data.sos_type,
    )
    db.add(alert)
    await db.commit()
    await db.refresh(alert)
    return {"status": "success", "data": SOSAlertResponse.model_validate(alert).model_dump()}


@router.patch("/{alert_id}/status")
async def update_alert_status(
    alert_id: str,
    new_status: SOSStatusEnum,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(select(SOSAlert).where(SOSAlert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="SOS alert not found.")
    alert.status = new_status.value
    if new_status == SOSStatusEnum.resolved:
        alert.resolved_at = datetime.now(timezone.utc)
    await db.commit()
    return {"status": "success", "data": {"id": alert.id, "status": alert.status}}
