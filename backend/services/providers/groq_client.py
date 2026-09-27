from __future__ import annotations

import json
from typing import Any

from groq import Groq

from core.config import settings

_INTENT_PROMPT = """You classify customer support queries for an e-commerce logistics agent.
Return ONLY JSON with this shape:
{"intent":"faq"|"tool"|"escalate","tool_name":"get_order_status"|null,"order_id":string|null,"confidence":0-1}

Rules:
- tool: order status, tracking, delivery ETA, cancel, where is my package. Extract a numeric order_id if present.
- faq: returns, refunds, shipping policy, warranty, general policy questions.
- escalate: legal threats, chargebacks, fraud, harassment, or explicit request for a human/manager.
"""


def classify_intent_sync(query: str) -> dict[str, Any]:
    completion = Groq(api_key=settings.groq_api_key).chat.completions.create(
        model=settings.groq_router_model,
        temperature=0,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": _INTENT_PROMPT},
            {"role": "user", "content": query},
        ],
    )
    raw = completion.choices[0].message.content or "{}"
    data = json.loads(raw)
    usage = completion.usage
    data["_provider"] = "groq"
    data["_model"] = settings.groq_router_model
    data["_tokens"] = int(getattr(usage, "total_tokens", 0) or 0)
    return data
