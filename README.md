# Amazon support agent (personal project)

Inbound Amazon message → intent → grounded reply from real AmazonHelp history **or** escalate to a human, with traces.

## Data

1. EDA: `data/eda_results/amazon_agent_en_clean.*`
2. RAG v1 (15k): `python scripts/build_rag_chunks.py` → `data/eda_results/amazon_rag_chunks.parquet`
3. Embed: from `backend/` venv, `python ../scripts/embed_rag_chunks.py`
4. Eval 250: `python scripts/build_golden_eval.py` → `data/eval/amazon_eval_250.xlsx`

Do **not** embed all 130k replies. Expand later if eval shows coverage holes.

