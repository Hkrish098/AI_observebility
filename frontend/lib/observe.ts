import type { ChatResponse, SpanRecord } from "@/lib/api";

export function formatLatency(ms: number) {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export function resultList(span: SpanRecord | undefined) {
  const output = span?.output_payload;
  if (!output || !Array.isArray(output.result)) return null;
  return output.result;
}

export function spanByType(latest: ChatResponse, type: SpanRecord["span_type"]) {
  return latest.spans.find((span) => span.span_type === type);
}

export function tracedLatency(latest: ChatResponse) {
  return latest.spans.reduce((sum, span) => sum + (span.latency_ms ?? 0), 0);
}

export function untracedLatency(latest: ChatResponse) {
  return latest.total_latency_ms - tracedLatency(latest);
}

export function shareOfTotal(ms: number, total: number) {
  if (total <= 0 || ms < 0) return null;
  return Math.round((ms / total) * 100);
}

export const TOKEN_HELP =
  "Sum of total tokens reported for this run: the Groq intent call, plus the Gemini draft when a reply is generated. Input and output are not split. Embeddings and reranking are not included.";

export const COST_HELP =
  "Cost is shown only when pricing information is available from the configured model/provider.";

export function tokenLabel(tokens: number) {
  return tokens > 0 ? String(tokens) : "Not tracked";
}

export type CostRow = { label: string; value: string; hint?: string };

export function costRows(latest: ChatResponse): CostRow[] {
  const name = latest.model_name.toLowerCase();
  const priced = !["groq", "gemini", "llama"].some((part) => name.includes(part));
  const rows: CostRow[] = [
    priced
      ? {
          label: "Estimated run cost",
          value: `$${latest.total_cost_usd.toFixed(4)}`,
          hint: COST_HELP,
        }
      : { label: "Cost", value: "Not tracked", hint: COST_HELP },
  ];
  const stages: Array<[string, number | null | undefined]> = [
    ["Generation", latest.generation_cost_usd],
    ["Embeddings", latest.embedding_cost_usd],
    ["Evaluation", latest.evaluation_cost_usd],
  ];
  for (const [label, value] of stages) {
    if (typeof value === "number") rows.push({ label, value: `$${value.toFixed(4)}` });
  }
  return rows;
}

export function routeName(route?: string) {
  if (route === "escalate") return "Escalate";
  if (route === "clarify") return "Clarify";
  return "Auto-response";
}

export function explainFlag(reason: string | null) {
  if (!reason) return "This run was flagged. No reason was returned.";
  return reason
    .split(";")
    .map((part) => humanizeFlag(part.trim()))
    .filter(Boolean)
    .join(" ");
}

function humanizeFlag(reason: string) {
  const latency = reason.match(/^latency (\d+)ms exceeded (\d+)ms$/);
  if (latency) {
    return `Latency ${formatLatency(Number(latency[1]))} exceeded ${formatLatency(Number(latency[2]))}.`;
  }
  const grounded = reason.match(/^groundedness_score ([0-9.]+) < ([0-9.]+)$/);
  if (grounded) {
    return `Groundedness ${Math.round(Number(grounded[1]) * 100)}% is below the ${Math.round(Number(grounded[2]) * 100)}% flag threshold.`;
  }
  const cost = reason.match(/^cost ([0-9.]+) exceeded \$([0-9.]+)$/);
  if (cost) {
    return `Estimated cost $${cost[1]} exceeded $${cost[2]}.`;
  }
  if (reason === "answer mentions policy but no source was retrieved") {
    return "The reply mentions policy, and no source was attached.";
  }
  return reason;
}

export function routerConfidence(span: SpanRecord | undefined) {
  const value = span?.output_payload?.confidence;
  return typeof value === "number" ? value : null;
}
