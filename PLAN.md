# Phase 2 plan — multi-model support agent

Loop: `Trace → Score → Flag → Debug → Fix → Test`

## Step 0 — Config and provider clients
- Add Groq, Gemini, and Cohere settings (with fallbacks if a key is missing).
- Thin wrappers in `backend/services/providers/`.
- Record provider + model on every span payload.

## Step 1 — RAG schema
- `policy_chunks` + `match_policy_chunks` RPC in `supabase/schema_phase2.sql`.
- Allow span types: `embed`, `rerank`, `judge`.
- Seed policy text (auto-seed on first FAQ if the table is empty).

## Step 2 — Groq intent router
- `llama-3.1-8b-instant` returns `{intent: faq|tool|escalate}`.
- Keyword classifier remains the fallback.

Gemini models on this project key: generation uses `gemini-3.6-flash` (2.0/2.5 flash are not available to new users on this API). Embeddings use `gemini-embedding-001` at 768 dimensions (`text-embedding-004` is not on this catalog).

## Step 3 — FAQ path
1. Gemini `text-embedding-004`
2. Top-20 from pgvector (lexical corpus fallback)
3. Cohere `rerank-v3.5` → top 3
4. Gemini `gemini-2.0-flash` grounded synthesis

## Step 4 — Tool path
- Gemini function calling → mock `get_order_status`.
- No RAG/rerank on this branch.

## Step 5 — Async judge
- Gemini structured RAG triad after the HTTP response.
- Deterministic flag rules (groundedness, tool errors, cost, missing sources).

## Step 6 — Orchestrator
- `SupportAgent` branches instead of always running all four spans.

## Step 7 — Dashboard contract
- Existing waterfall already renders extra span types.
- Health endpoint reports which providers are configured.

## Step 8 — Verify
- Order 1001 → tool path
- Return policy → FAQ path
- Angry legal / manager request → escalate
