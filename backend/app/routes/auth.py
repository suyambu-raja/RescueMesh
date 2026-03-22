"""
RapidRescue Backend — Auth Routes
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User
from app.schemas import UserCreate, UserLogin, UserResponse, Token
from app.auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(data: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    user_kwargs = {
        "full_name": data.full_name,
        "email": data.email,
        "hashed_password": hash_password(data.password),
    }
    if data.user_tag:
        user_kwargs["user_tag"] = data.user_tag
        
    user = User(**user_kwargs)
    db.add(user)
    await db.commit()
    await db.refresh(user)

    access_token = create_access_token(data={"sub": user.id})
    return {
        "status": "success",
        "data": {
            "user": UserResponse.model_validate(user).model_dump(),
            "access_token": access_token,
            "token_type": "bearer",
        },
    }


@router.post("/login")
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    access_token = create_access_token(data={"sub": user.id})
    return {
        "status": "success",
        "data": {
            "user": UserResponse.model_validate(user).model_dump(),
            "access_token": access_token,
            "token_type": "bearer",
        },
    }


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "status": "success",
        "data": UserResponse.model_validate(current_user).model_dump(),
    }
