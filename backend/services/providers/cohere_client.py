from __future__ import annotations

from typing import Any

import cohere

from core.config import settings


def rerank_sync(query: str, documents: list[str], top_n: int = 3) -> list[dict[str, Any]]:
    client = cohere.ClientV2(api_key=settings.cohere_api_key)
    result = client.rerank(
        model=settings.cohere_rerank_model,
        query=query,
        documents=documents,
        top_n=min(top_n, len(documents)),
    )
    ranked: list[dict[str, Any]] = []
    for item in result.results:
        ranked.append(
            {
                "index": int(item.index),
                "relevance_score": float(item.relevance_score),
            }
        )
    return ranked
