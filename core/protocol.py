from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr, Field, HttpUrl

class Role(str, Enum):
    USER = "user"
    CREATOR = "creator"
    ADMIN = "admin"
    SUPERADMIN = "superadmin"

class SubscriptionStatus(str, Enum):
    FREE = "free"
    ACTIVE = "active"
    CANCELLED = "cancelled"
    EXPIRED = "expired"

class TransactionType(str, Enum):
    EARN = "earn"
    SPEND = "spend"
    PURCHASE = "purchase"
    GRANT = "grant"
    DEDUCT = "deduct"
    REFUND = "refund"

class Profile(BaseModel):
    id: str  # UUID
    display_name: Optional[str] = None
    email: EmailStr
    avatar_url: Optional[HttpUrl] = None
    role: Role = Role.USER
    soul_balance: int = Field(default=0, ge=0)
    subscription_status: SubscriptionStatus = SubscriptionStatus.FREE
    is_suspended: bool = False
    suspension_reason: Optional[str] = None
    last_active: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

class SoulTokenTransaction(BaseModel):
    id: str  # UUID
    user_id: str  # UUID
    amount: int
    type: TransactionType
    reference: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime

class PaymentStatus(str, Enum):
    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"

class PaymentOrder(BaseModel):
    id: str  # UUID
    user_id: str  # UUID
    provider: str
    provider_order_id: str
    product_type: str
    product_id: Optional[str] = None
    amount: Optional[float] = None
    currency: str = "ZAR"
    status: PaymentStatus = PaymentStatus.PENDING
    created_at: datetime

class SoulTokenPackage(BaseModel):
    id: str  # UUID
    amount: int = Field(..., gt=0)
    price_zar: float = Field(..., gt=0)
    is_active: bool = True
    sort_order: int = 0
