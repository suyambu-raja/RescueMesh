"""
RapidRescue Backend — Food Request Routes
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import FoodRequest, User
from app.schemas import FoodRequestCreate, FoodRequestResponse
from app.auth import get_current_user, get_device_or_auth_user

router = APIRouter(prefix="/api/food", tags=["Food Requests"])


@router.get("/")
async def list_food_requests(db: AsyncSession = Depends(get_db)):
    query = select(FoodRequest, User.user_tag).join(User, FoodRequest.user_id == User.id).where(FoodRequest.status != "delivered").order_by(FoodRequest.created_at.desc())
    result = await db.execute(query)
    
    requests = []
    for r, utag in result.all():
        d = FoodRequestResponse.model_validate(r).model_dump()
        d["user_tag"] = utag
        requests.append(d)
        
    return {"status": "success", "data": requests}


@router.post("/", status_code=201)
async def create_food_request(
    data: FoodRequestCreate,
    db: AsyncSession = Depends(get_db),
    identity: dict = Depends(get_device_or_auth_user),
):
    user_id = identity.get("db_user_id")
    if not user_id:
        # Need a User record for FK — use or create anon
        ANON_EMAIL = "anonymous@rescue.local"
        result = await db.execute(select(User).where(User.email == ANON_EMAIL))
        anon = result.scalar_one_or_none()
        if not anon:
            anon = User(
                full_name="Anonymous Rescuer",
                email=ANON_EMAIL,
                hashed_password="$2b$12$anonymous.placeholder.hash.value.unused",
                user_tag="U_ANON000",
            )
            db.add(anon)
            await db.flush()
        user_id = anon.id

    request = FoodRequest(
        user_id=user_id,
        num_people=data.num_people,
        food_type=data.food_type,
        urgency=data.urgency.value,
        description=data.description,
        latitude=data.latitude,
        longitude=data.longitude,
        location_name=data.location_name,
        image_url=data.image_url,
    )
    db.add(request)
    await db.commit()
    await db.refresh(request)
    resp = FoodRequestResponse.model_validate(request).model_dump()
    resp["user_tag"] = identity["user_id"]
    return {"status": "success", "data": resp}


@router.delete("/{request_id}")
async def delete_food_request(
    request_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(FoodRequest).where(FoodRequest.id == request_id))
    r = result.scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail="Food request not found.")
    if r.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this request.")
    await db.delete(r)
    await db.commit()
    return {"status": "success", "message": "Deleted successfully."}
