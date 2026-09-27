from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field


SpanType = Literal["router", "retriever", "tool", "llm", "embed", "rerank", "judge"]


class ChatRequest(BaseModel):
    query: str = Field(min_length=1)
    session_id: str | None = None


class RetrievedChunk(BaseModel):
    chunk_id: str
    source: str
    content: str
    similarity: float


class SpanRecord(BaseModel):
    span_id: UUID
    trace_id: UUID
    span_type: SpanType
    input_payload: dict[str, Any] | None = None
    output_payload: dict[str, Any] | None = None
    latency_ms: int | None = None
    status: str = "ok"


class EvaluationScores(BaseModel):
    context_relevance: float | None = None
    groundedness: float | None = None
    answer_relevance: float | None = None
    hallucination: float | None = None
    safety: float | None = None


class ChatResponse(BaseModel):
    trace_id: UUID
    session_id: str
    answer: str
    model_name: str
    prompt_version: str
    total_latency_ms: int
    total_tokens: int
    total_cost_usd: float
    is_flagged: bool = False
    flag_reason: str | None = None
    route: str = "auto"
    intent: str | None = None
    emotion: str | None = None
    criticality: str | None = None
    evaluation_score: float = 0.0
    ticket_id: str | None = None
    support_phone: str | None = None
    escalate_reason: str | None = None
    spans: list[SpanRecord] = []
    retrieved_chunks: list[RetrievedChunk] = []
    supabase_persisted: bool = False


class TraceSummary(BaseModel):
    trace_id: UUID
    session_id: str
    user_query: str
    final_response: str | None = None
    model_name: str | None = None
    prompt_version: str | None = None
    total_latency_ms: int | None = None
    total_tokens: int | None = None
    total_cost_usd: float | None = None
    evaluation_score: float | None = None
    is_flagged: bool = False
    flag_reason: str | None = None
    created_at: datetime | None = None


class TraceDetail(TraceSummary):
    spans: list[SpanRecord] = []
    faithfulness_score: float | None = None
    user_feedback: str | None = None
    retrieved_chunks: list[RetrievedChunk] = []
