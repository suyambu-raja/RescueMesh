"""
RapidRescue Backend — Device Identity Routes

Handles:
  POST /api/identity/register   — register a device user (no login needed)
  GET  /api/identity/me         — get device user profile
  POST /api/identity/link       — link email/password to existing user_id
  POST /api/identity/sync       — batch-sync offline queued actions
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import DeviceUser, User
from app.schemas import (
    DeviceUserRegister,
    DeviceUserResponse,
    LinkLoginRequest,
    SyncQueueRequest,
    UserResponse,
    Token,
)
from app.auth import hash_password, create_access_token, get_device_user

router = APIRouter(prefix="/api/identity", tags=["Device Identity"])


@router.post("/register", status_code=201)
async def register_device(data: DeviceUserRegister, db: AsyncSession = Depends(get_db)):
    """
    Register a new device user (called on first app launch).
    If the user_id already exists, return the existing record (idempotent).
    """
    result = await db.execute(
        select(DeviceUser).where(DeviceUser.user_id == data.user_id)
    )
    existing = result.scalar_one_or_none()

    if existing:
        # Idempotent — just return the existing record
        return {
            "status": "success",
            "data": DeviceUserResponse.model_validate(existing).model_dump(),
            "message": "Device user already registered.",
        }

    device_user = DeviceUser(
        user_id=data.user_id,
        display_name=data.display_name,
        device_info=data.device_info,
    )
    db.add(device_user)
    await db.commit()
    await db.refresh(device_user)

    return {
        "status": "success",
        "data": DeviceUserResponse.model_validate(device_user).model_dump(),
        "message": "Device user registered successfully.",
    }


@router.get("/me")
async def get_my_identity(
    device_user: DeviceUser = Depends(get_device_user),
):
    """Get the device user profile via X-User-ID header."""
    if not device_user:
        raise HTTPException(status_code=404, detail="Device user not found. Send X-User-ID header.")
    return {
        "status": "success",
        "data": DeviceUserResponse.model_validate(device_user).model_dump(),
    }


@router.post("/link")
async def link_login(data: LinkLoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Link email/password credentials to an existing device user_id.
    This does NOT create a new identity — it adds login capability
    to the existing device user.
    """
    # 1. Verify device user exists
    result = await db.execute(
        select(DeviceUser).where(DeviceUser.user_id == data.user_id)
    )
    device_user = result.scalar_one_or_none()
    if not device_user:
        raise HTTPException(status_code=404, detail="Device user not found. Register first.")

    # 2. Check if email already taken
    result = await db.execute(select(User).where(User.email == data.email))
    existing_user = result.scalar_one_or_none()

    if existing_user:
        # If already linked to this device_user, just return success
        if device_user.linked_user_id == existing_user.id:
            access_token = create_access_token(data={"sub": existing_user.id})
            return {
                "status": "success",
                "data": {
                    "user": UserResponse.model_validate(existing_user).model_dump(),
                    "device_user": DeviceUserResponse.model_validate(device_user).model_dump(),
                    "access_token": access_token,
                    "token_type": "bearer",
                },
                "message": "Already linked.",
            }
        raise HTTPException(status_code=409, detail="Email already registered to another account.")

    # 3. Create the User record and link to DeviceUser
    user = User(
        full_name=data.full_name,
        email=data.email,
        hashed_password=hash_password(data.password),
        user_tag=data.user_id,  # Sync the tag
    )
    db.add(user)
    await db.flush()  # Get user.id

    device_user.linked_user_id = user.id
    device_user.display_name = data.full_name
    await db.commit()
    await db.refresh(user)
    await db.refresh(device_user)

    access_token = create_access_token(data={"sub": user.id})
    return {
        "status": "success",
        "data": {
            "user": UserResponse.model_validate(user).model_dump(),
            "device_user": DeviceUserResponse.model_validate(device_user).model_dump(),
            "access_token": access_token,
            "token_type": "bearer",
        },
        "message": "Login credentials linked to device identity.",
    }


@router.post("/sync")
async def sync_offline_queue(data: SyncQueueRequest, db: AsyncSession = Depends(get_db)):
    """
    Batch-sync queued offline actions.
    The frontend sends all pending items when connectivity returns.
    Each item is { endpoint, method, payload }.
    """
    # Verify device user
    result = await db.execute(
        select(DeviceUser).where(DeviceUser.user_id == data.user_id)
    )
    device_user = result.scalar_one_or_none()
    if not device_user:
        raise HTTPException(status_code=404, detail="Device user not found.")

    synced = 0
    errors = []

    for item in data.items:
        try:
            # Route the sync item to the appropriate handler
            # We process common write endpoints inline
            endpoint = item.endpoint.strip("/")
            payload = item.payload

            if endpoint.startswith("messages"):
                from app.models import Message
                msg = Message(
                    sender_id=device_user.linked_user_id or device_user.user_id,
                    sender_name=device_user.display_name,
                    sender_tag=device_user.user_id,
                    recipient_tag=payload.get("recipient_tag"),
                    content=payload.get("content", ""),
                    message_type=payload.get("message_type", "public"),
                    is_broadcast=payload.get("is_broadcast", False),
                    image_url=payload.get("image_url"),
                )
                db.add(msg)
                synced += 1

            elif endpoint.startswith("sos"):
                from app.models import SOSAlert
                # Need a linked user_id for FK
                user_id = device_user.linked_user_id
                if not user_id:
                    # Create an anonymous user record for FK constraint
                    anon = await _ensure_anon_user(db)
                    user_id = anon.id
                alert = SOSAlert(
                    user_id=user_id,
                    latitude=payload.get("latitude", 0),
                    longitude=payload.get("longitude", 0),
                    battery_percentage=payload.get("battery_percentage"),
                    message=payload.get("message"),
                    sos_type=payload.get("sos_type", "emergency"),
                )
                db.add(alert)
                synced += 1

            elif endpoint.startswith("zones"):
                from app.models import DangerZone
                zone = DangerZone(
                    title=payload.get("title", "Reported Zone"),
                    description=payload.get("description"),
                    severity=payload.get("severity", "medium"),
                    danger_type=payload.get("danger_type", "flood"),
                    latitude=payload.get("latitude", 0),
                    longitude=payload.get("longitude", 0),
                    location_name=payload.get("location_name"),
                    radius_meters=payload.get("radius_meters", 500),
                    reported_by=device_user.linked_user_id,
                )
                db.add(zone)
                synced += 1

            elif endpoint.startswith("food"):
                from app.models import FoodRequest
                user_id = device_user.linked_user_id
                if not user_id:
                    anon = await _ensure_anon_user(db)
                    user_id = anon.id
                fr = FoodRequest(
                    user_id=user_id,
                    num_people=payload.get("num_people", 1),
                    food_type=payload.get("food_type", "any"),
                    urgency=payload.get("urgency", "high"),
                    description=payload.get("description"),
                    latitude=payload.get("latitude", 0),
                    longitude=payload.get("longitude", 0),
                    location_name=payload.get("location_name"),
                    image_url=payload.get("image_url"),
                )
                db.add(fr)
                synced += 1

            else:
                errors.append(f"Unknown endpoint: {endpoint}")

        except Exception as e:
            errors.append(f"{item.endpoint}: {str(e)}")

    await db.commit()
    return {
        "status": "success",
        "data": {
            "synced": synced,
            "errors": errors,
            "total": len(data.items),
        },
    }


async def _ensure_anon_user(db: AsyncSession) -> User:
    """Get or create an anonymous user for FK constraints."""
    ANON_EMAIL = "anonymous@rescue.local"
    result = await db.execute(select(User).where(User.email == ANON_EMAIL))
    anon = result.scalar_one_or_none()
    if anon:
        return anon
    anon = User(
        full_name="Anonymous Rescuer",
        email=ANON_EMAIL,
        hashed_password="$2b$12$anonymous.placeholder.hash.value.unused",
        user_tag="U_ANON000",
    )
    db.add(anon)
    await db.flush()
    return anon
