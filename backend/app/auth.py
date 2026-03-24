"""
RapidRescue Backend — Authentication Utilities
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models import User
from app.schemas import TokenData

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


# ── Password Hashing ─────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ── JWT ───────────────────────────────────────────────────────────────────

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


# ── Dependencies ──────────────────────────────────────────────────────────

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Decode JWT and return the current authenticated user."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    return user


async def get_current_user_optional(
    token: str = Depends(OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """Decode JWT and return the user if present, else None."""
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
    except JWTError:
        return None

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    return user


# ── Device-First Identity ────────────────────────────────────────────────

from fastapi import Header, Request
from app.models import DeviceUser


async def get_device_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Optional["DeviceUser"]:
    """
    Resolves the device user from the X-User-ID header.
    Returns None if the header is missing or the device user doesn't exist.
    """
    user_id = request.headers.get("X-User-ID")
    if not user_id:
        return None
    result = await db.execute(select(DeviceUser).where(DeviceUser.user_id == user_id))
    return result.scalar_one_or_none()


async def get_device_or_auth_user(
    request: Request,
    token: str = Depends(OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)),
    db: AsyncSession = Depends(get_db),
):
    """
    Try JWT auth first. If no JWT, fall back to device user via X-User-ID header.
    Returns a dict with { user_id, display_name, db_user_id, is_authenticated }.
    This allows all routes to work without login.
    """
    # Try JWT first
    if token:
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            uid: str = payload.get("sub")
            if uid:
                result = await db.execute(select(User).where(User.id == uid))
                user = result.scalar_one_or_none()
                if user:
                    return {
                        "user_id": user.user_tag or user.id,
                        "display_name": user.full_name,
                        "db_user_id": user.id,
                        "is_authenticated": True,
                        "user_obj": user,
                    }
        except JWTError:
            pass

    # Fall back to device identity
    device_user_id = request.headers.get("X-User-ID")
    if device_user_id:
        result = await db.execute(
            select(DeviceUser).where(DeviceUser.user_id == device_user_id)
        )
        device_user = result.scalar_one_or_none()
        if device_user:
            # Update last_seen
            from datetime import datetime, timezone
            device_user.last_seen = datetime.now(timezone.utc)
            await db.commit()
            return {
                "user_id": device_user.user_id,
                "display_name": device_user.display_name,
                "db_user_id": device_user.linked_user_id,
                "is_authenticated": False,
                "device_user_obj": device_user,
            }

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No valid authentication or device identity provided. "
               "Send a JWT token or X-User-ID header.",
    )
