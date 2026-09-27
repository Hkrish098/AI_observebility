from __future__ import annotations

import asyncio

from models.schemas import RetrievedChunk
from services.providers.cohere_client import rerank_sync


async def rerank_chunks(query: str, chunks: list[RetrievedChunk], top_n: int = 3) -> list[RetrievedChunk]:
    if not chunks:
        return []
    ranked = await asyncio.to_thread(
        rerank_sync,
        query,
        [chunk.content for chunk in chunks],
        top_n,
    )
    selected: list[RetrievedChunk] = []
    for item in ranked:
        chunk = chunks[item["index"]].model_copy(update={"similarity": round(item["relevance_score"], 3)})
        selected.append(chunk)
    return selected or chunks[:top_n]
