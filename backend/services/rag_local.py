"""Local cosine RAG over amazon_rag_chunks_embedded.parquet."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import numpy as np
import pandas as pd

from models.schemas import RetrievedChunk

ROOT = Path(__file__).resolve().parents[2]
EMBEDDED = ROOT / "data" / "eda_results" / "amazon_rag_chunks_embedded.parquet"
NPY = ROOT / "data" / "eda_results" / "embeddings.npy"
CHUNKS = ROOT / "data" / "eda_results" / "amazon_rag_chunks.parquet"


def rag_ready() -> bool:
    return EMBEDDED.exists() or (CHUNKS.exists() and NPY.exists())


def rag_chunk_count() -> int:
    if not rag_ready():
        return 0
    df, matrix = _load()
    return int(len(df) if len(df) else len(matrix))


@lru_cache(maxsize=1)
def _load() -> tuple[pd.DataFrame, np.ndarray]:
    if EMBEDDED.exists():
        df = pd.read_parquet(EMBEDDED)
        matrix = np.asarray(df["embedding"].tolist(), dtype=np.float32)
        return df, matrix
    df = pd.read_parquet(CHUNKS)
    matrix = np.load(NPY)
    return df, matrix


def _tokenize(text: str) -> set[str]:
    return {tok for tok in "".join(ch.lower() if ch.isalnum() else " " for ch in text).split() if tok}


def retrieve_lexical(query: str, k: int = 20) -> list[RetrievedChunk]:
    """Offline overlap search against the Amazon index (no Gemini call)."""
    df, _matrix = _load()
    q = _tokenize(query)
    scores: list[tuple[float, int]] = []
    texts = df["text"].astype(str)
    for i, text in enumerate(texts):
        tokens = _tokenize(text)
        if not q or not tokens:
            sim = 0.0
        else:
            sim = len(q & tokens) / max(len(q), 1)
        scores.append((sim, i))
    scores.sort(reverse=True)
    out: list[RetrievedChunk] = []
    for sim, idx in scores[:k]:
        row = df.iloc[idx]
        chunk_id = str(row["chunk_id"] if "chunk_id" in df.columns else row.get("tweet_id"))
        out.append(
            RetrievedChunk(
                chunk_id=chunk_id,
                source=str(row.get("source", "AmazonHelp")),
                content=str(row["text"]),
                similarity=round(float(sim), 3),
            )
        )
    return out


def retrieve_for_query(query: str, k: int = 5) -> list[RetrievedChunk]:
    from services.providers import gemini_client

    return retrieve_local(gemini_client.embed_text_sync(query), k=k)


def retrieve_local(query_embedding: list[float], k: int = 20) -> list[RetrievedChunk]:
    df, matrix = _load()
    q = np.asarray(query_embedding, dtype=np.float32)
    q_norm = np.linalg.norm(q) or 1.0
    m_norm = np.linalg.norm(matrix, axis=1, keepdims=True)
    m_norm[m_norm == 0] = 1.0
    sims = (matrix @ q) / (m_norm.ravel() * q_norm)
    top = np.argsort(sims)[::-1][:k]
    out: list[RetrievedChunk] = []
    for idx in top:
        row = df.iloc[int(idx)]
        chunk_id = str(row["chunk_id"] if "chunk_id" in df.columns else row.get("tweet_id"))
        out.append(
            RetrievedChunk(
                chunk_id=chunk_id,
                source=str(row.get("source", "AmazonHelp")),
                content=str(row["text"]),
                similarity=round(float(sims[int(idx)]), 3),
            )
        )
    return out


if __name__ == "__main__":
    if not rag_ready():
        raise SystemExit("RAG index missing")
    for hit in retrieve_for_query("Where is my package?", k=5):
        print(f"{hit.similarity:.3f} {hit.chunk_id} {hit.content[:120]}")
