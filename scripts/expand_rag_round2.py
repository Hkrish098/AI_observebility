#!/usr/bin/env python3
"""Add more AmazonHelp chunks for weak intents from rag_round1_by_intent.csv.

Only embeds new chunk_ids. Does not re-embed the full 130k table.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "backend"))

from scripts.build_rag_chunks import load_clean  # noqa: E402
from services.amazon_labels import categorize_reply, is_dm_style  # noqa: E402

CHUNKS = ROOT / "data" / "eda_results" / "amazon_rag_chunks.parquet"
BY_INTENT = ROOT / "data" / "eval" / "rag_round1_by_intent.csv"
MIN_LEN = 80
ADD_PER_INTENT = 400
WEAK_SIM = 0.55
INTENT_TO_CATEGORY = {
    "shipping_inquiry": "shipping",
    "delivery_failed": "shipping",
    "return_refund": "refund",
    "cancel_modify": "order",
    "account_prime": "account",
    "product_quality": "other",
    "other": "other",
}


def weak_categories() -> list[str]:
    if not BY_INTENT.exists():
        return ["shipping", "refund"]
    stats = pd.read_csv(BY_INTENT)
    stats = stats.sort_values("mean_top1")
    cats: list[str] = []
    for row in stats.itertuples(index=False):
        if float(row.mean_top1) >= WEAK_SIM:
            continue
        cat = INTENT_TO_CATEGORY.get(str(row.gold_intent), "other")
        if cat not in cats:
            cats.append(cat)
        if len(cats) >= 2:
            break
    return cats or ["shipping", "refund"]


def main() -> None:
    current = pd.read_parquet(CHUNKS)
    current["chunk_id"] = current["chunk_id"].astype(str)
    have = set(current["chunk_id"])
    clean = load_clean()
    text = clean["text"].fillna("").astype(str)
    pool = clean.loc[~text.map(is_dm_style)].copy()
    pool = pool[pool["text"].str.len() >= MIN_LEN].drop_duplicates(subset=["text"])
    pool["category"] = pool["text"].map(categorize_reply)
    pool["chunk_id"] = pool["tweet_id"].astype(str)
    pool = pool[~pool["chunk_id"].isin(have)]

    cats = weak_categories()
    print("weak categories", cats)
    extras = []
    for cat in cats:
        g = pool[pool["category"] == cat]
        take = min(ADD_PER_INTENT, len(g))
        if take:
            extras.append(g.sample(n=take, random_state=7))
            print(f"  add {take} {cat}")
    if not extras:
        print("nothing to add")
        return

    add = pd.concat(extras, ignore_index=True)
    rag = add[["chunk_id", "text", "created_at", "category"]].copy()
    rag["source"] = "AmazonHelp"
    rag["expansion_round"] = 2
    merged = pd.concat([current, rag], ignore_index=True).drop_duplicates(subset=["chunk_id"])
    merged.to_parquet(CHUNKS, index=False)
    merged.to_csv(CHUNKS.with_suffix(".csv"), index=False)
    print(f"index now {len(merged):,} (was {len(current):,})")
    print("next: python scripts/embed_rag_chunks.py  # resumes, embeds new ids only")


if __name__ == "__main__":
    main()
