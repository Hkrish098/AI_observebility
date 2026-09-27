from __future__ import annotations

import asyncio
from collections import Counter

from core.config import settings
from db.supabase_client import get_supabase
from models.schemas import RetrievedChunk
from services.corpus import POLICY_CORPUS
from services.rag_local import rag_ready, retrieve_local

_seeded = False


def _tokenize(text: str) -> set[str]:
    return {token for token in "".join(ch.lower() if ch.isalnum() else " " for ch in text).split() if token}


def lexical_retrieve(query: str, k: int = 20) -> list[RetrievedChunk]:
    query_tokens = _tokenize(query)
    scored: list[RetrievedChunk] = []
    for chunk in POLICY_CORPUS:
        doc_tokens = _tokenize(chunk.content + " " + chunk.source)
        overlap = query_tokens & doc_tokens
        score = len(overlap) / max(len(query_tokens), 1)
        scored.append(chunk.model_copy(update={"similarity": round(min(score + 0.15, 0.99), 3)}))
    scored.sort(key=lambda item: item.similarity, reverse=True)
    return scored[:k]


def lexical_overlap_score(a: str, b: str) -> float:
    a_tokens = Counter(_tokenize(a))
    b_tokens = Counter(_tokenize(b))
    if not a_tokens or not b_tokens:
        return 0.0
    intersection = sum((a_tokens & b_tokens).values())
    return round(min(intersection / sum(a_tokens.values()), 1.0), 3)


def _to_vector_literal(values: list[float]) -> str:
    return "[" + ",".join(str(float(v)) for v in values) + "]"


async def ensure_policy_index() -> None:
    global _seeded
    if _seeded or not settings.supabase_configured or not settings.gemini_configured:
        return
    client = get_supabase()
    if client is None:
        return
    try:
        existing = await asyncio.to_thread(
            lambda: client.table("policy_chunks").select("chunk_id").limit(1).execute()
        )
        if existing.data:
            _seeded = True
            return
        rows = []
        for chunk in POLICY_CORPUS:
            embedding = await asyncio.to_thread(gemini_client.embed_text_sync, chunk.content)
            rows.append(
                {
                    "chunk_id": chunk.chunk_id,
                    "source": chunk.source,
                    "content": chunk.content,
                    "embedding": _to_vector_literal(embedding),
                }
            )
        await asyncio.to_thread(lambda: client.table("policy_chunks").upsert(rows).execute())
        _seeded = True
    except Exception:
        return


async def vector_retrieve(embedding: list[float], k: int = 20) -> list[RetrievedChunk]:
    client = get_supabase()
    if client is None:
        return []
    try:
        response = await asyncio.to_thread(
            lambda: client.rpc(
                "match_policy_chunks",
                {"query_embedding": _to_vector_literal(embedding), "match_count": k},
            ).execute()
        )
        rows = response.data or []
        return [
            RetrievedChunk(
                chunk_id=row["chunk_id"],
                source=row["source"],
                content=row["content"],
                similarity=round(float(row.get("similarity") or 0), 3),
            )
            for row in rows
        ]
    except Exception:
        return []


async def retrieve_policies(query: str, k: int = 20, embedding: list[float] | None = None) -> list[RetrievedChunk]:
    if embedding and rag_ready():
        return retrieve_local(embedding, k=k)
    await ensure_policy_index()
    if embedding:
        vector_hits = await vector_retrieve(embedding, k=k)
        if vector_hits:
            return vector_hits
    return lexical_retrieve(query, k=k)
