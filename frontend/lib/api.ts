export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type RetrievedChunk = {
  chunk_id: string;
  source: string;
  content: string;
  similarity: number;
};

export type SpanRecord = {
  span_id: string;
  trace_id: string;
  span_type:
    | "router"
    | "retriever"
    | "tool"
    | "llm"
    | "embed"
    | "rerank"
    | "judge";
  input_payload: Record<string, unknown> | null;
  output_payload: Record<string, unknown> | null;
  latency_ms: number | null;
  status: string;
};

export type ChatResponse = {
  trace_id: string;
  session_id: string;
  answer: string;
  model_name: string;
  prompt_version: string;
  total_latency_ms: number;
  total_tokens: number;
  total_cost_usd: number;
  generation_cost_usd?: number | null;
  embedding_cost_usd?: number | null;
  evaluation_cost_usd?: number | null;
  is_flagged: boolean;
  flag_reason: string | null;
  route?: string;
  intent?: string | null;
  emotion?: string | null;
  criticality?: string | null;
  evaluation_score?: number;
  ticket_id?: string | null;
  support_phone?: string | null;
  escalate_reason?: string | null;
  spans: SpanRecord[];
  retrieved_chunks: RetrievedChunk[];
  supabase_persisted: boolean;
};

export type HealthStatus = {
  status: string;
  rag_ready: boolean;
  rag_chunks: number;
};

export type TraceSummary = {
  trace_id: string;
  session_id: string;
  user_query: string;
  final_response: string | null;
  model_name: string | null;
  prompt_version: string | null;
  total_latency_ms: number | null;
  total_tokens: number | null;
  total_cost_usd: number | null;
  evaluation_score: number | null;
  is_flagged: boolean;
  flag_reason: string | null;
  created_at: string | null;
};

export async function sendChat(query: string, sessionId: string) {
  const response = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, session_id: sessionId }),
  });
  if (!response.ok) {
    throw new Error(`Chat failed (${response.status})`);
  }
  return (await response.json()) as ChatResponse;
}

export async function getHealth() {
  const response = await fetch(`${API_URL}/health`);
  if (!response.ok) {
    throw new Error(`Health failed (${response.status})`);
  }
  return (await response.json()) as HealthStatus;
}

export async function listTraces(flaggedOnly = false) {
  const response = await fetch(
    `${API_URL}/api/traces?flagged_only=${flaggedOnly}&limit=25`,
  );
  if (!response.ok) {
    throw new Error(`Traces failed (${response.status})`);
  }
  return (await response.json()) as TraceSummary[];
}
