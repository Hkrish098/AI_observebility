-- Paste this in Supabase → SQL Editor, then run.
-- Do not enable the Data API for service-role-only writes from the backend.

create extension if not exists pgcrypto;
create extension if not exists vector;

create table if not exists public.agent_traces (
  trace_id uuid primary key default gen_random_uuid(),
  session_id text not null,
  user_query text not null,
  final_response text,
  model_name text,
  prompt_version text,
  total_latency_ms integer,
  total_tokens integer,
  total_cost_usd numeric(12, 6),
  evaluation_score numeric(6, 3),
  is_flagged boolean default false,
  flag_reason text,
  user_feedback text,
  created_at timestamptz default now()
);

create table if not exists public.trace_spans (
  span_id uuid primary key default gen_random_uuid(),
  trace_id uuid not null references public.agent_traces(trace_id) on delete cascade,
  span_type text not null check (span_type in ('router', 'retriever', 'tool', 'llm')),
  input_payload jsonb,
  output_payload jsonb,
  latency_ms integer,
  status text default 'ok',
  created_at timestamptz default now()
);

create index if not exists agent_traces_flagged_idx on public.agent_traces (is_flagged);
create index if not exists agent_traces_created_at_idx on public.agent_traces (created_at desc);
create index if not exists trace_spans_trace_id_idx on public.trace_spans (trace_id);

alter table public.agent_traces enable row level security;
alter table public.trace_spans enable row level security;
