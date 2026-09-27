from __future__ import annotations

import json
from typing import Any

from google import genai
from google.genai import types

from core.config import settings

ORDER_STATUS_TOOL = types.Tool(
    function_declarations=[
        types.FunctionDeclaration(
            name="get_order_status",
            description="Look up warehouse order status, carrier, tracking number, and ETA by order id.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "order_id": types.Schema(type=types.Type.STRING, description="Numeric order id such as 1001"),
                },
                required=["order_id"],
            ),
        )
    ]
)


_client_singleton: genai.Client | None = None


def _client() -> genai.Client:
    global _client_singleton
    if _client_singleton is None:
        _client_singleton = genai.Client(api_key=settings.gemini_api_key)
    return _client_singleton


def embed_text_sync(text: str) -> list[float]:
    return embed_texts_sync([text])[0]


def embed_texts_sync(texts: list[str]) -> list[list[float]]:
    result = _client().models.embed_content(
        model=settings.gemini_embedding_model,
        contents=texts,
        config=types.EmbedContentConfig(output_dimensionality=768),
    )
    return [list(item.values) for item in result.embeddings]


def generate_text_sync(prompt: str, system: str | None = None) -> dict[str, Any]:
    config = types.GenerateContentConfig(temperature=settings.llm_temperature)
    if system:
        config = types.GenerateContentConfig(
            temperature=settings.llm_temperature,
            system_instruction=system,
        )
    response = _client().models.generate_content(
        model=settings.gemini_model,
        contents=prompt,
        config=config,
    )
    usage = getattr(response, "usage_metadata", None)
    tokens = 0
    if usage is not None:
        tokens = int(getattr(usage, "total_token_count", 0) or 0)
    return {
        "text": (response.text or "").strip(),
        "model": settings.gemini_model,
        "provider": "gemini",
        "tokens": tokens,
    }


def generate_json_sync(prompt: str) -> dict[str, Any]:
    response = _client().models.generate_content(
        model=settings.gemini_model,
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0,
            response_mime_type="application/json",
        ),
    )
    raw = response.text or "{}"
    data = json.loads(raw)
    usage = getattr(response, "usage_metadata", None)
    tokens = int(getattr(usage, "total_token_count", 0) or 0) if usage else 0
    data["_tokens"] = tokens
    data["_model"] = settings.gemini_model
    data["_provider"] = "gemini"
    return data


def plan_tool_call_sync(query: str) -> dict[str, Any]:
    chat = _client().chats.create(
        model=settings.gemini_model,
        config=types.GenerateContentConfig(temperature=0, tools=[ORDER_STATUS_TOOL]),
    )
    response = chat.send_message(query)
    function_call = None
    for candidate in response.candidates or []:
        for part in candidate.content.parts or []:
            if part.function_call:
                function_call = part.function_call
                break
    if function_call is None:
        return {"name": None, "args": {}, "text": (response.text or "").strip()}
    args = dict(function_call.args or {})
    return {"name": function_call.name, "args": args, "text": ""}
