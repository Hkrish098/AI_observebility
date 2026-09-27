from __future__ import annotations

import asyncio
import uuid
from time import perf_counter

from core.config import settings
from core.telemetry import bind_trace, collected_spans, observe_span, persist_trace, update_trace
from models.schemas import ChatResponse, RetrievedChunk
from services.amazon_labels import decide_route
from services.evaluator import estimate_cost_usd, flag_trace, heuristic_scores
from services.intent_router import classify_intent
from services.providers import gemini_client
from services.reranker import rerank_chunks
from services.retriever import retrieve_policies

SUPPORT_PHONE = "1-888-280-4331"

FAQ_SYSTEM = (
    "You write as @AmazonHelp on Twitter. Reply in 1-3 short sentences, like a real AmazonHelp tweet. "
    "Use only the retrieved historical replies. Do not invent tracking, refunds, or account facts. "
    "Do not paste bullet lists of old tweets. Do not say 'based on company policy'."
)


def _ticket_id() -> str:
    return f"AH-{uuid.uuid4().hex[:8].upper()}"


def _ticket_tweet(ticket_id: str) -> str:
    return (
        f"We're sorry this has been stressful. We've opened ticket {ticket_id}. "
        f"Call {SUPPORT_PHONE} and share that number — a person will take it from here."
    )


def _clarify_tweet(intent: str | None) -> str:
    if intent in {"shipping_inquiry", "delivery_failed", "cancel_modify"}:
        return (
            "Sorry you're waiting on this. Could you reply with the order id "
            "(like 123-1234567-1234567)? We'll look it up before sending you anywhere."
        )
    return (
        "We want to help, and we don't want to guess. Can you tell us the order id "
        "and what you'd like us to check?"
    )


class SupportAgent:
    async def run(self, query: str, session_id: str | None = None) -> ChatResponse:
        started = perf_counter()
        trace_id = uuid.uuid4()
        session_id = session_id or str(uuid.uuid4())
        bind_trace(trace_id)
        model_label = f"groq:{settings.groq_router_model}+gemini:{settings.gemini_model}"
        persisted = await persist_trace(
            {
                "trace_id": str(trace_id),
                "session_id": session_id,
                "user_query": query,
                "model_name": model_label,
                "prompt_version": settings.prompt_version,
            }
        )

        routing = await self._route_intent(query)

        groq_intent = routing["intent"]
        tokens = int(routing.get("_tokens") or 0)
        chunks: list[RetrievedChunk] = []
        extra_tokens = 0
        ticket_id: str | None = None
        support_phone: str | None = None

        if groq_intent != "escalate":
            chunks, extra_tokens = await self._retrieve_for_query(query)
        tokens += extra_tokens

        top_sim = chunks[0].similarity if chunks else None
        decision = decide_route(query, groq_intent, top_sim)
        escalate_reason = decision["reason"]

        if decision["route"] == "escalate":
            ticket_id = _ticket_id()
            support_phone = SUPPORT_PHONE
            answer = _ticket_tweet(ticket_id)
        elif decision["route"] == "clarify":
            answer = _clarify_tweet(decision["intent"])
        else:
            answer, gen_tokens = await self._draft_help_tweet(query, chunks)
            tokens += gen_tokens

        latency_ms = int((perf_counter() - started) * 1000)
        cost = estimate_cost_usd(tokens, model_label)
        scores = heuristic_scores(query, answer, chunks)
        is_flagged, flag_reason = flag_trace(
            scores,
            200,
            cost,
            chunks,
            answer,
            latency_ms=latency_ms,
        )
        if decision["route"] == "escalate":
            is_flagged = True
            flag_reason = escalate_reason
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
                "final_response": answer,
                "total_latency_ms": latency_ms,
                "total_tokens": tokens,
                "total_cost_usd": cost,
                "evaluation_score": evaluation_score,
                "is_flagged": is_flagged,
                "flag_reason": flag_reason,
            },
        )
        return ChatResponse(
            trace_id=trace_id,
            session_id=session_id,
            answer=answer,
            model_name=model_label,
            prompt_version=settings.prompt_version,
            total_latency_ms=latency_ms,
            total_tokens=tokens,
            total_cost_usd=cost,
            is_flagged=is_flagged,
            flag_reason=flag_reason,
            route=decision["route"],
            intent=decision["intent"],
            emotion=decision.get("emotion"),
            criticality=decision.get("criticality"),
            evaluation_score=evaluation_score,
            ticket_id=ticket_id,
            support_phone=support_phone,
            escalate_reason=escalate_reason,
            spans=collected_spans(),
            retrieved_chunks=chunks if decision["route"] == "auto" else [],
            supabase_persisted=persisted,
        )

    @observe_span("router")
    async def _route_intent(self, query: str) -> dict:
        return await classify_intent(query)

    async def _retrieve_for_query(self, query: str) -> tuple[list[RetrievedChunk], int]:
        embedding = await self._embed_query(query)
        retrieved = await self._search_chunks(query, embedding)
        chunks = await self._rerank_chunks(query, retrieved)
        return chunks, 0

    @observe_span("embed")
    async def _embed_query(self, query: str) -> list[float] | None:
        if not settings.gemini_configured:
            return None
        try:
            return await asyncio.to_thread(gemini_client.embed_text_sync, query)
        except Exception:
            return None

    @observe_span("retriever")
    async def _search_chunks(self, query: str, embedding: list[float] | None) -> list[RetrievedChunk]:
        return await retrieve_policies(query, k=20, embedding=embedding)

    @observe_span("rerank")
    async def _rerank_chunks(self, query: str, retrieved: list[RetrievedChunk]) -> list[RetrievedChunk]:
        if not retrieved:
            return []
        if not settings.cohere_configured:
            return retrieved[:3]
        try:
            return await rerank_chunks(query, retrieved, top_n=3)
        except Exception:
            return retrieved[:3]

    @observe_span("llm")
    async def _draft_help_tweet(self, query: str, chunks: list[RetrievedChunk]) -> tuple[str, int]:
        tokens = 0
        context = "\n".join(f"- {chunk.source}: {chunk.content}" for chunk in chunks)
        fallback = (
            chunks[0].content[:240]
            if chunks
            else "Sorry about the wait. Reply with your order id and we'll look it up."
        )
        if not settings.gemini_configured:
            return fallback, tokens
        try:
            result = await asyncio.to_thread(
                gemini_client.generate_text_sync,
                f"Customer tweet: {query}\n\nHistorical @AmazonHelp replies:\n{context}",
                FAQ_SYSTEM,
            )
            return result["text"], int(result.get("tokens") or 0)
        except Exception:
            return fallback, tokens
