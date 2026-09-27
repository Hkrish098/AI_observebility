#!/usr/bin/env python3
"""Build 250 rubric-labeled Amazon customer tweets (csv + xlsx)."""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from services.amazon_labels import ascii_ratio, label_customer  # noqa: E402

RAW = ROOT / "data" / "raw" / "twcs.csv"
OUT_DIR = ROOT / "data" / "eval"
TARGET = 250
RNG = 42
QUOTA = {
    "shipping_inquiry": 50,
    "delivery_failed": 35,
    "return_refund": 45,
    "cancel_modify": 25,
    "account_prime": 30,
    "product_quality": 20,
    "other": 45,
}


def collect_inbound(max_keep: int = 40000) -> pd.DataFrame:
    chunks = []
    kept = 0
    for chunk in pd.read_csv(RAW, chunksize=80_000):
        inbound = chunk["inbound"].astype(str).str.lower().eq("true")
        mentions = chunk["text"].fillna("").str.contains("AmazonHelp", case=False, na=False)
        sub = chunk.loc[inbound & mentions].copy()
        if sub.empty:
            continue
        sub["ascii_ratio"] = sub["text"].fillna("").map(ascii_ratio)
        sub = sub[sub["ascii_ratio"] >= 0.9]
        sub = sub[sub["text"].fillna("").str.len() >= 30]
        chunks.append(sub)
        kept += len(sub)
        if kept >= max_keep:
            break
    return pd.concat(chunks, ignore_index=True).drop_duplicates(subset=["tweet_id"])


def quota_sample(df: pd.DataFrame) -> pd.DataFrame:
    labels = df["text"].map(label_customer).apply(pd.Series)
    df = pd.concat([df.reset_index(drop=True), labels.reset_index(drop=True)], axis=1)
    parts = []
    for intent, n in QUOTA.items():
        g = df[df["intent"] == intent]
        take = min(n, len(g))
        if take:
            parts.append(g.sample(n=take, random_state=RNG))
            print(f"  {intent}: {take}/{len(g)} (wanted {n})")
    out = pd.concat(parts, ignore_index=True)
    if len(out) < TARGET:
        rest = df[~df["tweet_id"].isin(out["tweet_id"])]
        need = TARGET - len(out)
        if len(rest) and need > 0:
            out = pd.concat([out, rest.sample(n=min(need, len(rest)), random_state=RNG)], ignore_index=True)
    return out.reset_index(drop=True)


def main() -> None:
    pool = collect_inbound()
    print(f"inbound english-ish pool: {len(pool):,}")
    out = quota_sample(pool)
    out["reviewer"] = ""
    out["gold_intent"] = out["intent"]
    out["gold_route"] = out["route"]
    cols = [
        "tweet_id",
        "created_at",
        "text",
        "intent",
        "route",
        "reason",
        "needs_review",
        "label_method",
        "gold_intent",
        "gold_route",
        "reviewer",
    ]
    out = out[[c for c in cols if c in out.columns]]
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    csv_path = OUT_DIR / "amazon_eval_250.csv"
    xlsx_path = OUT_DIR / "amazon_eval_250.xlsx"
    out.to_csv(csv_path, index=False)
    out.to_excel(xlsx_path, index=False, sheet_name="eval_250")
    print(f"saved {len(out)} → {csv_path}")
    print(out["intent"].value_counts().to_string())
    print(out["route"].value_counts().to_string())
    print("needs_review", int(out["needs_review"].sum()))


if __name__ == "__main__":
    main()
