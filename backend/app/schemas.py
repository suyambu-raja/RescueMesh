"""
RapidRescue Backend — Pydantic Schemas
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


# ── Auth ──────────────────────────────────────────────────────────────────

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: Optional[str] = None


# ── User ──────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=120)
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=6)
    user_tag: Optional[str] = None


class UserLogin(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: str
    user_tag: Optional[str] = None
    full_name: str
    email: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Contact ───────────────────────────────────────────────────────────────

class ContactCreate(BaseModel):
    name: str = Field(..., max_length=120)
    user_tag: Optional[str] = None  # U_XXXXXXX format
    phone: Optional[str] = None
    contact_user_id: Optional[str] = None
    is_emergency: bool = False


class ContactResponse(BaseModel):
    id: str
    owner_id: str
    contact_user_id: Optional[str]
    name: str
    user_tag: Optional[str]
    phone: Optional[str]
    is_emergency: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Shelter ───────────────────────────────────────────────────────────────

class ShelterCreate(BaseModel):
    name: str = Field(..., max_length=200)
    latitude: float
    longitude: float
    address: Optional[str] = None
    total_beds: int = 0
    occupied_beds: int = 0
    contact_phone: Optional[str] = None
    image_url: Optional[str] = None
    description: Optional[str] = None


class ShelterUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    total_beds: Optional[int] = None
    occupied_beds: Optional[int] = None
    is_active: Optional[bool] = None
    contact_phone: Optional[str] = None
    description: Optional[str] = None


class ShelterResponse(BaseModel):
    id: str
    name: str
    latitude: float
    longitude: float
    address: Optional[str]
    total_beds: int
    occupied_beds: int
    is_active: bool
    contact_phone: Optional[str]
    image_url: Optional[str]
    description: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Danger Zone ───────────────────────────────────────────────────────────

class SeverityEnum(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class DangerZoneCreate(BaseModel):
    title: str = Field(..., max_length=200)
    description: Optional[str] = None
    severity: SeverityEnum = SeverityEnum.medium
    danger_type: str = "flood"
    latitude: float
    longitude: float
    location_name: Optional[str] = None
    radius_meters: float = 500
    image_url: Optional[str] = None


class DangerZoneResponse(BaseModel):
    id: str
    title: str
    description: Optional[str]
    severity: str
    danger_type: str
    latitude: float
    longitude: float
    location_name: Optional[str]
    radius_meters: float
    image_url: Optional[str]
    is_active: bool
    reported_by: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Message ───────────────────────────────────────────────────────────────

class MessageTypeEnum(str, Enum):
    public = "public"
    private = "private"
    food_request = "food_request"


class MessageCreate(BaseModel):
    recipient_id: Optional[str] = None
    recipient_tag: Optional[str] = None  # U_XXXXXXX target
    content: str = Field(..., min_length=1)
    message_type: MessageTypeEnum = MessageTypeEnum.public
    is_broadcast: bool = False
    image_url: Optional[str] = None


class MessageResponse(BaseModel):
    id: str
    sender_id: str
    sender_name: Optional[str]
    sender_tag: Optional[str]
    recipient_id: Optional[str]
    recipient_tag: Optional[str]
    content: str
    message_type: str
    is_broadcast: bool
    is_read: bool
    image_url: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Food Request ──────────────────────────────────────────────────────────

class UrgencyEnum(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class FoodRequestCreate(BaseModel):
    num_people: int = Field(..., ge=1)
    food_type: str = "any"
    urgency: UrgencyEnum = UrgencyEnum.high
    description: Optional[str] = None
    latitude: float
    longitude: float
    location_name: Optional[str] = None
    image_url: Optional[str] = None


class FoodRequestResponse(BaseModel):
    id: str
    user_id: str
    user_tag: Optional[str] = None
    num_people: int
    food_type: str
    urgency: str
    description: Optional[str]
    latitude: float
    longitude: float
    location_name: Optional[str]
    status: str
    image_url: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── SOS Alert ─────────────────────────────────────────────────────────────

class SOSStatusEnum(str, Enum):
    active = "active"
    responding = "responding"
    resolved = "resolved"


class SOSAlertCreate(BaseModel):
    latitude: float
    longitude: float
    battery_percentage: Optional[int] = None
    message: Optional[str] = None
    sos_type: str = "emergency"


class SOSAlertResponse(BaseModel):
    id: str
    user_id: str
    latitude: float
    longitude: float
    battery_percentage: Optional[int]
    message: Optional[str]
    sos_type: str
    status: str
    created_at: datetime
    resolved_at: Optional[datetime]

    model_config = {"from_attributes": True}


# ── Location ─────────────────────────────────────────────────────────────

class LocationUpdate(BaseModel):
    latitude: float
    longitude: float
    accuracy: Optional[float] = None


class LocationResponse(BaseModel):
    id: str
    user_id: str
    latitude: float
    longitude: float
    accuracy: Optional[float]
    timestamp: datetime

    model_config = {"from_attributes": True}


# ── Chat (Assistant) ─────────────────────────────────────────────────────

class ChatInput(BaseModel):
    message: str = Field(..., min_length=1)


class ChatMessageResponse(BaseModel):
    id: str
    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Standard API Wrapper ─────────────────────────────────────────────────

class APIResponse(BaseModel):
    status: str = "success"
    data: Optional[dict | list] = None
    message: Optional[str] = None
