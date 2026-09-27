from __future__ import annotations

import asyncio

from core.config import settings
from core.telemetry import bind_trace, observe_span, update_trace
from models.schemas import EvaluationScores, RetrievedChunk
from services.providers import gemini_client
from services.retriever import lexical_overlap_score

JUDGE_PROMPT = """You are an evaluator for a RAG support agent.
Score 0 to 1.
Return JSON:
{{
  "context_relevance": number,
  "groundedness": number,
  "answer_relevance": number,
  "hallucination": number,
  "failure_reason": string|null
}}

Question: {query}
Answer: {answer}
Retrieved context:
{context}
"""


def estimate_cost_usd(tokens: int, model_name: str) -> float:
    if "groq" in model_name or "gemini" in model_name or "llama" in model_name:
        return 0.0
    per_1k = 0.00015 if "mini" in model_name else 0.002
    return round((tokens / 1000) * per_1k, 6)


def heuristic_scores(query: str, answer: str, chunks: list[RetrievedChunk]) -> EvaluationScores:
    context = " ".join(chunk.content for chunk in chunks)
    groundedness = lexical_overlap_score(answer, context) if context else 0.2
    answer_relevance = lexical_overlap_score(answer, query)
    context_relevance = max((chunk.similarity for chunk in chunks), default=0.0)
    hallucination = round(max(0.0, 1.0 - groundedness), 3)
    return EvaluationScores(
        context_relevance=round(context_relevance, 3),
        groundedness=groundedness,
        answer_relevance=answer_relevance,
        hallucination=hallucination,
        safety=0.99,
    )


def flag_trace(
    scores: EvaluationScores,
    tool_status_code: int,
    total_cost_usd: float,
    chunks: list[RetrievedChunk],
    answer: str,
    latency_ms: int = 0,
) -> tuple[bool, str | None]:
    reasons: list[str] = []
    groundedness = scores.groundedness or 0.0
    if chunks and groundedness < settings.groundedness_flag_threshold:
        reasons.append(f"groundedness_score {groundedness} < {settings.groundedness_flag_threshold}")
    if tool_status_code >= 400:
        reasons.append(f"tool returned status {tool_status_code}")
    if total_cost_usd > settings.cost_flag_threshold_usd:
        reasons.append(f"cost {total_cost_usd} exceeded ${settings.cost_flag_threshold_usd}")
    if latency_ms > settings.latency_flag_threshold_ms:
        reasons.append(f"latency {latency_ms}ms exceeded {settings.latency_flag_threshold_ms}ms")
    mentions_policy = any(word in answer.lower() for word in ("policy", "refund", "warranty"))
    if not chunks and mentions_policy:
        reasons.append("answer mentions policy but no source was retrieved")
    if reasons:
        return True, "; ".join(reasons)
    return False, None


async def llm_judge(query: str, answer: str, chunks: list[RetrievedChunk]) -> EvaluationScores | None:
    if not settings.gemini_configured:
        return None
    context = "\n".join(f"- {chunk.source}: {chunk.content}" for chunk in chunks) or "(none)"
    prompt = JUDGE_PROMPT.format(query=query, answer=answer, context=context)
    try:
        data = await asyncio.to_thread(gemini_client.generate_json_sync, prompt)
        return EvaluationScores(
            context_relevance=float(data.get("context_relevance", 0)),
            groundedness=float(data.get("groundedness", 0)),
            answer_relevance=float(data.get("answer_relevance", 0)),
            hallucination=float(data.get("hallucination", 0)),
            safety=0.99,
        )
    except Exception:
        return None


async def evaluate_and_flag(
    trace_id,
    query: str,
    answer: str,
    chunks: list[RetrievedChunk],
    tool_status_code: int,
    total_cost_usd: float,
    latency_ms: int = 0,
) -> tuple[EvaluationScores, bool, str | None]:
    bind_trace(trace_id)
    scores = heuristic_scores(query, answer, chunks)
    async with observe_span("judge", {"query": query, "model": settings.gemini_model}) as span:
        judged = await llm_judge(query, answer, chunks)
        if judged is not None:
            scores = judged
            span.set_output(judged.model_dump())
        else:
            span.set_output({"fallback": "heuristic", **scores.model_dump()})
    is_flagged, reason = flag_trace(
        scores, tool_status_code, total_cost_usd, chunks, answer, latency_ms=latency_ms
    )
    evaluation_score = round(
        (
            (scores.groundedness or 0)
            + (scores.answer_relevance or 0)
            + (scores.context_relevance or 0)
        )
        / 3,
        3,
    )
    await update_trace(
        trace_id,
        {
            "evaluation_score": evaluation_score,
            "is_flagged": is_flagged,
            "flag_reason": reason,
        },
    )
    return scores, is_flagged, reason
