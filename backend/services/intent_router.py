from __future__ import annotations

import asyncio

from core.config import settings
from services.providers.groq_client import classify_intent_sync
from services.retriever import retrieve_policies

INTENT_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("tool", ("order", "tracking", "shipment", "delivered", "package", "where is")),
    ("escalate", ("manager", "lawyer", "sue", "chargeback", "fraud", "human")),
    ("faq", ("return", "refund", "exchange", "shipping", "warranty", "policy", "delivery")),
]


def _keyword_intent(query: str) -> dict:
    lowered = query.lower()
    for intent, keywords in INTENT_RULES:
        if any(keyword in lowered for keyword in keywords):
            return {
                "intent": intent,
                "tool_name": "get_order_status" if intent == "tool" else None,
                "order_id": None,
                "confidence": 0.7,
                "route": intent,
                "_provider": "keyword",
                "_model": "rules",
                "_tokens": 0,
            }
    return {
        "intent": "faq",
        "tool_name": None,
        "order_id": None,
        "confidence": 0.4,
        "route": "faq",
        "_provider": "keyword",
        "_model": "rules",
        "_tokens": 0,
    }


def _normalize(raw: dict) -> dict:
    intent = str(raw.get("intent") or "faq").lower()
    if intent in {"order_status", "action", "tool_call"}:
        intent = "tool"
    if intent in {"policy", "policy_qa", "general", "returns", "shipping", "warranty"}:
        intent = "faq"
    if intent not in {"faq", "tool", "escalate"}:
        intent = "faq"
    return {
        "intent": intent,
        "tool_name": raw.get("tool_name"),
        "order_id": raw.get("order_id"),
        "confidence": float(raw.get("confidence") or 0.5),
        "route": intent,
        "_provider": raw.get("_provider", "groq"),
        "_model": raw.get("_model", settings.groq_router_model),
        "_tokens": int(raw.get("_tokens") or 0),
    }


async def classify_intent(query: str) -> dict:
    if settings.groq_configured:
        try:
            raw = await asyncio.to_thread(classify_intent_sync, query)
            return _normalize(raw)
        except Exception as exc:
            fallback = _keyword_intent(query)
            fallback["error"] = str(exc)
            return fallback

    lowered = query.lower()
    if any(word in lowered for word in ("order", "tracking", "package")):
        return _keyword_intent(query)
    chunks = await retrieve_policies(query, k=1)
    if chunks and chunks[0].similarity >= 0.25:
        result = _keyword_intent(query)
        result["intent"] = "faq"
        result["route"] = "faq"
        return result
    return _keyword_intent(query)
