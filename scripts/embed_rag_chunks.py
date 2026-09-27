#!/usr/bin/env python3
"""Embed amazon_rag_chunks with Gemini 768-d. Resumes from checkpoint.

  cd backend && source .venv/bin/activate
  python ../scripts/embed_rag_chunks.py
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))

from dotenv import load_dotenv

load_dotenv(BACKEND / ".env")

from core.config import settings  # noqa: E402
from services.providers import gemini_client  # noqa: E402

CHUNKS = ROOT / "data" / "eda_results" / "amazon_rag_chunks.parquet"
CHUNKS_CSV = ROOT / "data" / "eda_results" / "amazon_rag_chunks.csv"
CKPT = ROOT / "data" / "eda_results" / "embed_checkpoint.parquet"
OUT_DF = ROOT / "data" / "eda_results" / "amazon_rag_chunks_embedded.parquet"
OUT_NPY = ROOT / "data" / "eda_results" / "embeddings.npy"

BATCH_SIZE = 10
FLUSH_EVERY = 10
# Free tier: 100 embed_content items/min for gemini-embedding-001
TARGET_RPM = 80
MAX_RETRIES = 8


def load_chunks() -> pd.DataFrame:
    if CHUNKS.exists():
        return pd.read_parquet(CHUNKS)
    return pd.read_csv(CHUNKS_CSV)


def load_checkpoint() -> dict[str, list[float]]:
    if not CKPT.exists():
        return {}
    saved = pd.read_parquet(CKPT)
    return {
        str(row.chunk_id): list(row.embedding)
        for row in saved.itertuples(index=False)
    }


def flush_checkpoint(done: dict[str, list[float]]) -> None:
    rows = [{"chunk_id": k, "embedding": v} for k, v in done.items()]
    pd.DataFrame(rows).to_parquet(CKPT, index=False)


def _retry_seconds(exc: Exception) -> float:
    text = str(exc)
    if "retry in" in text.lower():
        for token in text.replace("s.", " ").split():
            try:
                return min(max(float(token), 5.0), 90.0)
            except ValueError:
                continue
    return 20.0


def embed_batch(texts: list[str]) -> list[list[float]]:
    last_error: Exception | None = None
    for _attempt in range(MAX_RETRIES):
        try:
            vectors = gemini_client.embed_texts_sync(texts)
            time.sleep(60.0 / TARGET_RPM * max(len(texts), 1))
            return vectors
        except Exception as exc:
            last_error = exc
            message = str(exc).lower()
            if "429" in message or "503" in message or "unavailable" in message or "resource" in message:
                time.sleep(_retry_seconds(exc))
                continue
            if len(texts) > 1:
                out: list[list[float]] = []
                for text in texts:
                    out.extend(embed_batch([text]))
                return out
            raise
    raise RuntimeError(f"embed failed after retries: {last_error}")


def write_index(df: pd.DataFrame, done: dict[str, list[float]]) -> None:
    ordered = [done[str(cid)] for cid in df["chunk_id"]]
    matrix = np.asarray(ordered, dtype=np.float32)
    out = df.copy()
    out["embedding"] = [row.tolist() for row in matrix]
    out.to_parquet(OUT_DF, index=False)
    np.save(OUT_NPY, matrix)
    print(f"wrote {OUT_DF} shape={matrix.shape}")


def main() -> None:
    if not settings.gemini_configured:
        raise SystemExit("GEMINI_API_KEY missing in backend/.env")
    df = load_chunks()
    df["chunk_id"] = df["chunk_id"].astype(str)
    done = load_checkpoint()
    pending = df[~df["chunk_id"].isin(done)].reset_index(drop=True)
    print(f"chunks={len(df)} already={len(done)} pending={len(pending)}")

    since_flush = 0
    try:
        for start in range(0, len(pending), BATCH_SIZE):
            batch = pending.iloc[start : start + BATCH_SIZE]
            texts = batch["text"].astype(str).tolist()
            ids = batch["chunk_id"].astype(str).tolist()
            vectors = embed_batch(texts)
            if len(vectors) != len(ids):
                raise RuntimeError(f"batch size mismatch {len(vectors)} != {len(ids)}")
            for chunk_id, vec in zip(ids, vectors):
                done[chunk_id] = vec
            since_flush += len(ids)
            print(f"embedded {len(done)}/{len(df)}", flush=True)
            if since_flush >= FLUSH_EVERY:
                flush_checkpoint(done)
                since_flush = 0
    finally:
        if done:
            flush_checkpoint(done)

    have = df[df["chunk_id"].isin(done)].reset_index(drop=True)
    write_index(have, done)
    if len(done) != len(df):
        print(
            f"partial index {len(done)}/{len(df)} — free-tier daily embed cap; "
            "rerun scripts/embed_rag_chunks.py tomorrow to resume"
        )


if __name__ == "__main__":
    main()
