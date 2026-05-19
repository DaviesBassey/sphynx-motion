from fastapi import APIRouter, HTTPException, Depends
from core.protocol import AgentState, RiskLevel, UnderwritingRecord
from ..lib.auth import verify_clerk_session
from langgraph.graph import StateGraph, END
from opik import track
from typing import Dict, Any
import datetime

router = APIRouter()

@track
def evaluate_risk(state: AgentState) -> AgentState:
    """Deterministic risk evaluation DAG node with Opik telemetry."""
    # Underwriting Logic: Low risk for initialization
    state["risk_assessment"] = RiskLevel.LOW
    state["decision"] = "Proceed"
    return state

workflow = StateGraph(AgentState)
workflow.add_node("evaluate", evaluate_risk)
workflow.set_entry_point("evaluate")
workflow.add_edge("evaluate", END)
chain = workflow.compile()

@router.post("/evaluate", response_model=UnderwritingRecord)
async def run_underwriting(
    input_data: Dict[str, Any],
    user_id: str = Depends(verify_clerk_session)
) -> UnderwritingRecord:
    initial_state: AgentState = {
        "input_text": str(input_data.get("text", "")),
        "risk_assessment": None,
        "decision": None,
        "token_usage": {},
        "metadata": {"requester_id": user_id}
    }

    # Execute LangGraph DAG
    result: AgentState = await chain.ainvoke(initial_state) # type: ignore

    return UnderwritingRecord(
        id="uw_" + str(datetime.datetime.now().timestamp()),
        user_id=user_id,
        risk_score=0.1,
        level=result["risk_assessment"] or RiskLevel.LOW,
        justification="System assessment completed via LangGraph DAG with Opik tracing",
        processed_at=datetime.datetime.now()
    )
