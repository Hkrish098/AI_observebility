#!/usr/bin/env python3
"""Filter English AmazonHelp replies → ~15k diverse RAG chunks (iterative expansion v1)."""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from services.amazon_labels import categorize_reply, is_dm_style  # noqa: E402

CLEAN = ROOT / "data" / "eda_results" / "amazon_agent_en_clean.parquet"
CLEAN_CSV = ROOT / "data" / "eda_results" / "amazon_agent_en_clean.csv"
OUT = ROOT / "data" / "eda_results" / "amazon_rag_chunks.parquet"
OUT_CSV = ROOT / "data" / "eda_results" / "amazon_rag_chunks.csv"
SAMPLE_SIZE = 15_000
MIN_LEN = 80
RNG = 42


def load_clean() -> pd.DataFrame:
    if CLEAN.exists():
        return pd.read_parquet(CLEAN)
    return pd.read_csv(CLEAN_CSV)


def stratified_sample(df: pd.DataFrame, n: int) -> pd.DataFrame:
    df = df.copy()
    counts = df["category"].value_counts()
    alloc = (counts / counts.sum() * n).round().astype(int)
    while alloc.sum() > n:
        alloc[alloc.idxmax()] -= 1
    while alloc.sum() < n:
        alloc[alloc.idxmax()] += 1

    parts = []
    for cat, k in alloc.items():
        g = df[df["category"] == cat]
        k = min(int(k), len(g))
        parts.append(g.sample(n=k, random_state=RNG) if k else g)
    out = pd.concat(parts, ignore_index=True)
    if len(out) > n:
        out = out.sample(n=n, random_state=RNG)
    return out.reset_index(drop=True)


def main() -> None:
    df = load_clean()
    print(f"starting: {len(df):,}")

    text = df["text"].fillna("").astype(str)
    mask_dm = text.map(is_dm_style)
    df = df.loc[~mask_dm].copy()
    print(f"after DM filter: {len(df):,}")

    df = df[df["text"].str.len() >= MIN_LEN].copy()
    print(f"after length>={MIN_LEN}: {len(df):,}")

    df = df.drop_duplicates(subset=["text"]).copy()
    print(f"after text dedup: {len(df):,}")

    df["category"] = df["text"].map(categorize_reply)
    print(df["category"].value_counts().to_string())

    n = min(SAMPLE_SIZE, len(df))
    sample = stratified_sample(df, n)
    rag = sample[["tweet_id", "text", "created_at", "category"]].rename(
        columns={"tweet_id": "chunk_id"}
    )
    rag["source"] = "AmazonHelp"
    rag["expansion_round"] = 1

    OUT.parent.mkdir(parents=True, exist_ok=True)
    rag.to_parquet(OUT, index=False)
    rag.to_csv(OUT_CSV, index=False)
    print(f"saved {len(rag):,} → {OUT}")
    print(rag["category"].value_counts().to_string())


if __name__ == "__main__":
    main()
