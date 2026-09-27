from fastapi import APIRouter, BackgroundTasks

from models.schemas import ChatRequest, ChatResponse
from services.agent import SupportAgent
from services.evaluator import evaluate_and_flag

router = APIRouter(prefix="/api", tags=["chat"])
agent = SupportAgent()


@router.post("/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest, background_tasks: BackgroundTasks) -> ChatResponse:
    result = await agent.run(payload.query, payload.session_id)
    tool_status = 200
    for span in result.spans:
        if span.span_type == "tool" and span.output_payload:
            tool_status = int(span.output_payload.get("status_code", 200))
    background_tasks.add_task(
        evaluate_and_flag,
        result.trace_id,
        payload.query,
        result.answer,
        result.retrieved_chunks,
        tool_status,
        result.total_cost_usd,
        result.total_latency_ms,
    )
    return result
