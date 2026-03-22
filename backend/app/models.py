"""
RapidRescue Backend — SQLAlchemy Models
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Float,
    Boolean,
    Integer,
    DateTime,
    Text,
    ForeignKey,
    Enum as SAEnum,
)
from sqlalchemy.orm import relationship
from app.database import Base


def _utcnow():
    return datetime.now(timezone.utc)


def _uuid():
    return str(uuid.uuid4())


def _user_tag():
    """Generate a short unique tag like U_8F3K92X for mesh-network identity."""
    import random
    import string
    chars = string.ascii_uppercase + string.digits
    return 'U_' + ''.join(random.choices(chars, k=7))


# ── User ─────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=_uuid)
    user_tag = Column(String(10), nullable=True, default=_user_tag, index=True)
    full_name = Column(String(120), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    # Relationships
    messages_sent = relationship("Message", back_populates="sender", foreign_keys="Message.sender_id")
    sos_alerts = relationship("SOSAlert", back_populates="user")
    locations = relationship("UserLocation", back_populates="user")
    contacts = relationship("Contact", back_populates="owner", foreign_keys="Contact.owner_id")


# ── Contact ───────────────────────────────────────────────────────────────

class Contact(Base):
    __tablename__ = "contacts"

    id = Column(String, primary_key=True, default=_uuid)
    owner_id = Column(String, ForeignKey("users.id"), nullable=False)
    contact_user_id = Column(String, ForeignKey("users.id"), nullable=True)
    name = Column(String(120), nullable=False)
    user_tag = Column(String(10), nullable=True)  # U_XXXXXXX format
    phone = Column(String(20), nullable=True)
    is_emergency = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    owner = relationship("User", back_populates="contacts", foreign_keys=[owner_id])


# ── Shelter ───────────────────────────────────────────────────────────────

class Shelter(Base):
    __tablename__ = "shelters"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String(200), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    address = Column(String(500))
    total_beds = Column(Integer, default=0)
    occupied_beds = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    contact_phone = Column(String(20))
    image_url = Column(Text, nullable=True)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


# ── Danger Zone ───────────────────────────────────────────────────────────

class DangerZone(Base):
    __tablename__ = "danger_zones"

    id = Column(String, primary_key=True, default=_uuid)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    severity = Column(SAEnum("low", "medium", "high", "critical", name="severity_enum"), default="medium")
    danger_type = Column(String(50), default="flood")
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    location_name = Column(String(200), nullable=True)
    radius_meters = Column(Float, default=500)
    image_url = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True)
    reported_by = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


# ── Message ───────────────────────────────────────────────────────────────

class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=_uuid)
    sender_id = Column(String, ForeignKey("users.id"), nullable=False)
    sender_name = Column(String(120), nullable=True)
    sender_tag = Column(String(10), nullable=True)  # U_XXXXXXX format
    recipient_id = Column(String, ForeignKey("users.id"), nullable=True)
    recipient_tag = Column(String(10), nullable=True)  # U_XXXXXXX format for mesh routing
    content = Column(Text, nullable=False)
    message_type = Column(SAEnum("public", "private", "food_request", name="message_type_enum"), default="public")
    is_broadcast = Column(Boolean, default=False)
    is_read = Column(Boolean, default=False)
    image_url = Column(String(1000), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    sender = relationship("User", back_populates="messages_sent", foreign_keys=[sender_id])


# ── Food Request ──────────────────────────────────────────────────────────

class FoodRequest(Base):
    __tablename__ = "food_requests"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    num_people = Column(Integer, nullable=False)
    food_type = Column(String(100), default="any")
    urgency = Column(SAEnum("low", "medium", "high", "critical", name="urgency_enum"), default="high")
    description = Column(Text, nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    location_name = Column(String(200), nullable=True)
    status = Column(SAEnum("pending", "accepted", "delivered", name="food_status_enum"), default="pending")
    image_url = Column(String(1000), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)


# ── SOS Alert ─────────────────────────────────────────────────────────────

class SOSAlert(Base):
    __tablename__ = "sos_alerts"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    battery_percentage = Column(Integer, nullable=True)
    message = Column(Text)
    sos_type = Column(String(50), default="emergency")
    status = Column(SAEnum("active", "responding", "resolved", name="sos_status_enum"), default="active")
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="sos_alerts")


# ── User Location ────────────────────────────────────────────────────────

class UserLocation(Base):
    __tablename__ = "user_locations"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    accuracy = Column(Float, nullable=True)
    timestamp = Column(DateTime(timezone=True), default=_utcnow)

    user = relationship("User", back_populates="locations")


# ── Chat (Assistant) ─────────────────────────────────────────────────────

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    role = Column(SAEnum("user", "assistant", name="chat_role_enum"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
