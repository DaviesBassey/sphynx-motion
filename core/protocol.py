from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any, TypedDict, Literal
from pydantic import BaseModel, EmailStr, Field, HttpUrl

class Role(str, Enum):
    USER = "user"
    CREATOR = "creator"
    ADMIN = "admin"
    SUPERADMIN = "superadmin"

class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class TransactionStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REVERSED = "reversed"

# --- LangGraph State Records ---
class AgentState(TypedDict):
    """Deterministic LangGraph state record."""
    input_text: str
    risk_assessment: Optional[RiskLevel]
    decision: Optional[str]
    token_usage: Dict[str, int]
    metadata: Dict[str, Any]

# --- Groq Core Processing Engine Definitions ---
class GroqResponse(BaseModel):
    id: str
    model: str
    content: str
    usage: Dict[str, int]

# --- Fintech Domain Models (Synchronized with DB 017) ---
class Profile(BaseModel):
    id: str  # UUID
    full_name: str
    email: EmailStr
    updated_at: datetime
    stripe_customer_id: Optional[str] = None
    financial_profile_text: Optional[str] = None
    # Represent vector as list of floats
    portfolio_embedding: Optional[List[float]] = Field(None, min_length=1536, max_length=1536)

class Transaction(BaseModel):
    id: str  # UUID
    user_id: str  # UUID
    amount: float = Field(..., decimal_places=4)
    currency: str = Field(..., min_length=3, max_length=3) # CHAR(3)
    status: TransactionStatus
    created_at: datetime

class UnderwritingRecord(BaseModel):
    id: str
    user_id: str
    risk_score: float = Field(..., ge=0.0, le=1.0)
    level: RiskLevel
    justification: str
    processed_at: datetime

class PaymentIntent(BaseModel):
    id: str
    amount: int
    currency: str = "ZAR"
    status: Literal["requires_payment_method", "requires_confirmation", "succeeded", "canceled"]
    client_secret: str

# --- Telemetry Models ---
class TracedExecution(BaseModel):
    trace_id: str
    chain_name: str
    latency_ms: float
    token_cost: float
    system_prompt_version: str
