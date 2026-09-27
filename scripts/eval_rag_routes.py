#!/usr/bin/env python3
"""Retrieve-only RAG eval against the reviewed golden set (eval_250 sheet)."""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))

from dotenv import load_dotenv

load_dotenv(BACKEND / ".env")

from services.amazon_labels import decide_route  # noqa: E402
from services.providers import gemini_client  # noqa: E402
from services.rag_local import rag_ready, retrieve_lexical, retrieve_local  # noqa: E402

EVAL = ROOT / "data" / "eval" / "golden_eval_set_reviewed.xlsx"
FALLBACK = ROOT / "data" / "eval" / "amazon_eval_250.xlsx"
OUT = ROOT / "data" / "eval" / "rag_round1_metrics.csv"
SUMMARY = ROOT / "data" / "eval" / "rag_round1_summary.csv"


def load_eval() -> pd.DataFrame:
    path = EVAL if EVAL.exists() else FALLBACK
    xl = pd.ExcelFile(path)
    sheet = "eval_250" if "eval_250" in xl.sheet_names else xl.sheet_names[0]
    df = pd.read_excel(xl, sheet_name=sheet)
    if "gold_intent" not in df.columns:
        df["gold_intent"] = df.get("intent")
    if "gold_route" not in df.columns:
        df["gold_route"] = df.get("route")
    df["gold_intent"] = df["gold_intent"].astype(str).str.strip().str.lower()
    df["gold_route"] = df["gold_route"].astype(str).str.strip().str.lower()
    df["gold_route"] = df["gold_route"].replace({"auto_handle": "auto", "escalate_human": "escalate"})
    return df.dropna(subset=["text", "gold_intent", "gold_route"]).reset_index(drop=True)


def main() -> None:
    if not rag_ready():
        raise SystemExit("RAG index missing. Run scripts/embed_rag_chunks.py first.")
    gold = load_eval()
    flags = set(sys.argv[1:])
    use_lexical = "--lexical" in flags or "lexical" in flags
    nums = [int(a) for a in sys.argv[1:] if a.isdigit()]
    if nums:
        gold = gold.head(nums[0])
    print(f"evaluating {len(gold)} rows lexical={use_lexical}")
    rows = []
    retrieve_mode = "lexical" if use_lexical else "gemini"
    for i, row in gold.iterrows():
        query = str(row["text"])
        if use_lexical:
            hits = retrieve_lexical(query, k=20)
        else:
            try:
                vector = gemini_client.embed_text_sync(query)
                hits = retrieve_local(vector, k=20)
            except Exception as exc:
                print(f"embed failed ({exc}); falling back to lexical retrieve")
                hits = retrieve_lexical(query, k=20)
                retrieve_mode = "lexical_fallback"
        top_sim = hits[0].similarity if hits else None
        decision = decide_route(query, groq_intent="faq", top_similarity=top_sim)
        pred_intent = decision["intent"]
        pred_route = decision["route"]
        gold_intent = row["gold_intent"]
        gold_route = row["gold_route"]
        rows.append(
            {
                "tweet_id": row.get("tweet_id"),
                "gold_intent": gold_intent,
                "pred_intent": pred_intent,
                "intent_match": pred_intent == gold_intent,
                "gold_route": gold_route,
                "pred_route": pred_route,
                "route_match": pred_route == gold_route,
                "top1_similarity": top_sim,
                "escalate_hit": gold_route == "escalate" and pred_route == "escalate",
                "reason": decision["reason"],
            }
        )
        if (i + 1) % 25 == 0:
            print(f"eval {i + 1}/{len(gold)}")

    detail = pd.DataFrame(rows)
    route_acc = float(detail["route_match"].mean())
    intent_acc = float(detail["intent_match"].mean())
    gold_esc = detail[detail["gold_route"] == "escalate"]
    esc_recall = float(gold_esc["escalate_hit"].mean()) if len(gold_esc) else None
    by_intent = (
        detail.groupby("gold_intent")
        .agg(
            n=("tweet_id", "count"),
            mean_top1=("top1_similarity", "mean"),
            route_acc=("route_match", "mean"),
        )
        .reset_index()
    )
    summary = pd.DataFrame(
        [
            {
                "n": len(detail),
                "route_accuracy": round(route_acc, 3),
                "intent_accuracy": round(intent_acc, 3),
                "escalate_recall": None if esc_recall is None else round(esc_recall, 3),
                "mean_top1_similarity": round(float(detail["top1_similarity"].mean()), 3),
                "retrieve_mode": retrieve_mode,
            }
        ]
    )
    detail.to_csv(OUT, index=False)
    summary.to_csv(SUMMARY, index=False)
    by_intent.to_csv(ROOT / "data" / "eval" / "rag_round1_by_intent.csv", index=False)
    print(summary.to_string(index=False))
    print(by_intent.to_string(index=False))
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
