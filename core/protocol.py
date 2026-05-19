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

# --- Fintech Domain Models ---
class Profile(BaseModel):
    id: str  # UUID
    email: EmailStr
    role: Role = Role.USER
    is_mfa_enabled: bool = False
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
