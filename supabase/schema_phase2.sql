-- Phase 2: pgvector policy corpus + extra span types.
-- Run in Supabase SQL Editor after schema.sql.

create extension if not exists vector;

create table if not exists public.policy_chunks (
  chunk_id text primary key,
  source text not null,
  content text not null,
  embedding vector(768),
  created_at timestamptz default now()
);

alter table public.trace_spans drop constraint if exists trace_spans_span_type_check;
alter table public.trace_spans
  add constraint trace_spans_span_type_check
  check (span_type in ('router', 'retriever', 'tool', 'llm', 'embed', 'rerank', 'judge'));

create or replace function public.match_policy_chunks(
  query_embedding vector(768),
  match_count int default 20
)
returns table (
  chunk_id text,
  source text,
  content text,
  similarity float
)
language sql
stable
as $$
  select
    policy_chunks.chunk_id,
    policy_chunks.source,
    policy_chunks.content,
    1 - (policy_chunks.embedding <=> query_embedding) as similarity
  from public.policy_chunks
  where policy_chunks.embedding is not null
  order by policy_chunks.embedding <=> query_embedding
  limit match_count;
$$;

alter table public.policy_chunks enable row level security;
