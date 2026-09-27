#!/usr/bin/env python3
"""Embed a query and print top-5 local AmazonHelp hits."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))

from dotenv import load_dotenv

load_dotenv(BACKEND / ".env")

from services.providers import gemini_client  # noqa: E402
from services.rag_local import rag_ready, retrieve_local  # noqa: E402


def main() -> None:
    query = " ".join(sys.argv[1:]) or "Where is my package?"
    if not rag_ready():
        raise SystemExit("RAG index missing. Run scripts/embed_rag_chunks.py first.")
    vector = gemini_client.embed_text_sync(query)
    hits = retrieve_local(vector, k=5)
    print(f"query: {query}")
    for hit in hits:
        print(f"{hit.similarity:.3f} {hit.chunk_id} {hit.content[:140].replace(chr(10), ' ')}")


if __name__ == "__main__":
    main()
