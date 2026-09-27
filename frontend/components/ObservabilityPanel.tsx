"use client";

import { useEffect, useState } from "react";
import {
  type ChatResponse,
  type RetrievedChunk,
  type SpanRecord,
} from "@/lib/api";
import { criticalityLabel, emotionLabel, intentLabel, stepLabel } from "@/lib/labels";
import {
  MetricCard,
  ProgressMetric,
  SectionHeader,
  StatusBadge,
} from "@/components/observability/ui";

type Props = {
  latest: ChatResponse | null;
};

function formatLatency(ms: number) {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function runStatus(latest: ChatResponse): {
  tone: "ok" | "warn" | "bad";
  label: string;
} {
  if (latest.spans.some((span) => span.status === "error")) {
    return { tone: "bad", label: "Failed" };
  }
  if (latest.route === "escalate") return { tone: "bad", label: "Escalated" };
  if (latest.is_flagged) return { tone: "warn", label: "Warning" };
  return { tone: "ok", label: "Completed" };
}

function decisionCopy(latest: ChatResponse) {
  if (latest.route === "escalate") {
    return {
      title: "Human escalation required",
      route: "Escalate",
      outcome: latest.escalate_reason ?? "A person has to take this.",
      accent: "border-l-[#d92d20]",
    };
  }
  if (latest.route === "clarify") {
    return {
      title: "Asked for the order id",
      route: "Clarify",
      outcome: latest.escalate_reason ?? "Not enough to answer or escalate.",
      accent: "border-l-[#dc6803]",
    };
  }
  return {
    title: "Amazon Help answered",
    route: "Auto-response",
    outcome: latest.escalate_reason ?? "A reply was sent from past Help answers.",
    accent: "border-l-[#079455]",
  };
}

function spanDetail(span: SpanRecord, chunks: RetrievedChunk[]) {
  const output = span.output_payload;
  const result = output && Array.isArray(output.result) ? output.result : null;
  if (span.span_type === "retriever" && result) {
    return `${result.length} candidates retrieved`;
  }
  if (span.span_type === "rerank") {
    return chunks.length ? `${chunks.length} sources selected` : "Sources ranked";
  }
  if (span.span_type === "embed" && output && typeof output.result === "object") {
    return "Query embedded for search";
  }
  if (span.span_type === "llm" && span.status === "ok") {
    return "Customer-facing draft";
  }
  if (span.span_type === "router") return "Intent path chosen";
  if (span.status === "error") return "This step failed";
  return null;
}

export function ObservabilityPanel({ latest }: Props) {
  const [openStep, setOpenStep] = useState<string | null>(null);
  const [openChunk, setOpenChunk] = useState<string | null>(null);
  const [showFull, setShowFull] = useState(false);

  useEffect(() => {
    setOpenStep(null);
    setOpenChunk(null);
    setShowFull(false);
  }, [latest?.trace_id]);

  return (
    <aside className="flex h-full min-h-0 min-w-[18rem] flex-col border-l border-[#eaecf0] bg-[#f8f9fb] text-[#101828]">
      <header className="shrink-0 border-b border-[#eaecf0] bg-[#f8f9fb] px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#667085]">
          Observability
        </p>
        <div className="mt-1 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-semibold leading-tight">AI execution trace</h2>
            <p className="mt-0.5 font-mono text-[11px] text-[#667085]">
              {latest ? `Run #${latest.trace_id.slice(0, 8)} · Processed just now` : "No run yet"}
            </p>
          </div>
          {latest && <StatusBadge {...runStatus(latest)} />}
        </div>
        {latest && (
          <p className="mt-2 text-[12px] text-[#344054]">
            <span className="font-mono tabular-nums">{formatLatency(latest.total_latency_ms)}</span>
            {typeof latest.evaluation_score === "number" && (
              <span className="text-[#667085]">
                {" "}
                · evaluation {Math.round(latest.evaluation_score * 100)}%
              </span>
            )}
          </p>
        )}
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {!latest && (
          <p className="text-[13px] leading-5 text-[#667085]">
            Post a tweet. This inspector shows the decision, what was understood, the steps that
            ran, the sources used, and how long it took.
          </p>
        )}

        {latest && (
          <>
            <DecisionSection latest={latest} />
            <UnderstandingSection latest={latest} />
            <TraceSection
              latest={latest}
              openStep={openStep}
              onToggle={(id) => setOpenStep((current) => (current === id ? null : id))}
            />
            <EvidenceSection
              chunks={latest.retrieved_chunks}
              openChunk={openChunk}
              onToggle={(id) => setOpenChunk((current) => (current === id ? null : id))}
            />
            <QualitySection latest={latest} />
            <PerformanceSection latest={latest} />
            <FinalSection
              answer={latest.answer}
              grounded={latest.retrieved_chunks.length > 0}
              showFull={showFull}
              onToggle={() => setShowFull((value) => !value)}
            />
          </>
        )}
      </div>
    </aside>
  );
}

function DecisionSection({ latest }: { latest: ChatResponse }) {
  const copy = decisionCopy(latest);
  return (
    <section>
      <SectionHeader>AI decision</SectionHeader>
      <div className={`mt-2 border border-[#eaecf0] border-l-2 bg-white px-3 py-3 ${copy.accent}`}>
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#667085]">
          Decision
        </p>
        <p className="mt-1 text-[16px] font-semibold leading-snug">{copy.title}</p>
        <p className="mt-2 text-[13px] text-[#344054]">{copy.route}</p>
        <p className="mt-1 text-[12px] leading-5 text-[#667085]">{copy.outcome}</p>
        {latest.route === "escalate" && latest.ticket_id && (
          <p className="mt-2 font-mono text-[12px] text-[#101828]">
            {latest.ticket_id}
            {latest.support_phone ? ` · ${latest.support_phone}` : ""}
          </p>
        )}
      </div>
    </section>
  );
}

function UnderstandingSection({ latest }: { latest: ChatResponse }) {
  return (
    <section>
      <SectionHeader>What we understood</SectionHeader>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <MetricCard label="Intent" value={intentLabel(latest.intent) ?? "Unclear"} />
        <MetricCard label="Emotion" value={emotionLabel(latest.emotion)} />
        <MetricCard label="Criticality" value={criticalityLabel(latest.criticality)} />
        <MetricCard
          label="Route"
          value={
            latest.route === "escalate"
              ? "Escalate"
              : latest.route === "clarify"
                ? "Clarify"
                : "Auto-response"
          }
        />
      </div>
    </section>
  );
}

function TraceSection({
  latest,
  openStep,
  onToggle,
}: {
  latest: ChatResponse;
  openStep: string | null;
  onToggle: (id: string) => void;
}) {
  return (
    <section>
      <SectionHeader>Execution trace</SectionHeader>
      <ol className="mt-2">
        {latest.spans.map((span, index) => {
          const open = openStep === span.span_id;
          const last = index === latest.spans.length - 1;
          const failed = span.status === "error";
          const detail = spanDetail(span, latest.retrieved_chunks);
          return (
            <li key={span.span_id} className="relative pl-5">
              {!last && (
                <span className="absolute top-3 bottom-0 left-[5px] w-px bg-[#d0d5dd]" />
              )}
              <span
                className={`absolute top-1.5 left-0 h-2.5 w-2.5 rounded-full border-2 border-white ${
                  failed ? "bg-[#f04438]" : "bg-[#12b76a]"
                }`}
              />
              <button
                type="button"
                aria-expanded={open}
                onClick={() => onToggle(span.span_id)}
                className={`mb-1 w-full rounded-md px-2 py-1.5 text-left hover:bg-white ${
                  open ? "border-l-2 border-l-[#175cd3] bg-white" : ""
                }`}
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px] font-medium">{stepLabel(span.span_type)}</span>
                  <span className="font-mono text-[11px] tabular-nums text-[#667085]">
                    {formatLatency(span.latency_ms ?? 0)}
                  </span>
                </span>
                <span className="mt-0.5 block text-[11px] text-[#667085]">
                  {failed ? "Failed" : "Completed"}
                  {detail ? ` · ${detail}` : ""}
                </span>
                {open && (
                  <span className="mt-2 block space-y-1 text-[12px] leading-5 text-[#344054]">
                    <span className="block">Status: {failed ? "failed" : "completed"}</span>
                    <span className="block">
                      Latency: {formatLatency(span.latency_ms ?? 0)}
                    </span>
                    {detail && <span className="block">{detail}</span>}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function EvidenceSection({
  chunks,
  openChunk,
  onToggle,
}: {
  chunks: RetrievedChunk[];
  openChunk: string | null;
  onToggle: (id: string) => void;
}) {
  return (
    <section>
      <SectionHeader>Retrieval and evidence</SectionHeader>
      <p className="mt-2 text-[12px] text-[#667085]">
        {chunks.length === 0
          ? "No sources attached to this reply."
          : `${chunks.length} source${chunks.length === 1 ? "" : "s"} used`}
      </p>
      <ul className="mt-2 space-y-2">
        {chunks.map((chunk, index) => {
          const open = openChunk === chunk.chunk_id;
          return (
            <li key={chunk.chunk_id}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => onToggle(chunk.chunk_id)}
                className="w-full rounded-md border border-[#eaecf0] bg-white px-3 py-2 text-left hover:border-[#d0d5dd]"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium">
                      {chunk.source || `Source ${index + 1}`}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-[#667085]">
                      AmazonHelp history · relevance {chunk.similarity.toFixed(2)} · used
                    </span>
                  </span>
                </span>
                {open && (
                  <span className="mt-2 block text-[12px] leading-5 text-[#344054]">
                    {chunk.content}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function QualitySection({ latest }: { latest: ChatResponse }) {
  const best = latest.retrieved_chunks.reduce(
    (max, chunk) => Math.max(max, chunk.similarity),
    0,
  );
  const hasScore = typeof latest.evaluation_score === "number";
  if (!hasScore && latest.retrieved_chunks.length === 0) return null;
  return (
    <section>
      <SectionHeader>Response quality</SectionHeader>
      <div className="mt-2 space-y-3 rounded-md border border-[#eaecf0] bg-white px-3 py-3">
        {hasScore && (
          <ProgressMetric label="Evaluation score" value={latest.evaluation_score ?? 0} />
        )}
        {latest.retrieved_chunks.length > 0 && (
          <ProgressMetric label="Best source match" value={Math.min(1, best)} />
        )}
      </div>
    </section>
  );
}

function PerformanceSection({ latest }: { latest: ChatResponse }) {
  const retrieval = latest.spans.find((span) => span.span_type === "retriever")?.latency_ms;
  const generation = latest.spans.find((span) => span.span_type === "llm")?.latency_ms;
  return (
    <section>
      <SectionHeader>Performance</SectionHeader>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 rounded-md border border-[#eaecf0] bg-white px-3 py-3">
        <Stat label="Total latency" value={formatLatency(latest.total_latency_ms)} />
        {retrieval != null && <Stat label="Retrieval" value={formatLatency(retrieval)} />}
        {generation != null && <Stat label="Generation" value={formatLatency(generation)} />}
        <Stat label="Sources" value={String(latest.retrieved_chunks.length)} />
        <Stat label="Tokens" value={String(latest.total_tokens)} />
        <Stat label="Estimated cost" value={`$${latest.total_cost_usd.toFixed(4)}`} />
      </dl>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-[#667085]">{label}</dt>
      <dd className="font-mono text-[13px] tabular-nums text-[#101828]">{value}</dd>
    </div>
  );
}

function FinalSection({
  answer,
  grounded,
  showFull,
  onToggle,
}: {
  answer: string;
  grounded: boolean;
  showFull: boolean;
  onToggle: () => void;
}) {
  const preview = answer.length > 160 ? `${answer.slice(0, 160)}…` : answer;
  return (
    <section className="pb-2">
      <SectionHeader>Final response</SectionHeader>
      <div className="mt-2 rounded-md border border-[#eaecf0] bg-white px-3 py-3">
        <p className="text-[13px] leading-5 text-[#344054]">{showFull ? answer : preview}</p>
        <p className="mt-2 text-[11px] text-[#067647]">
          Customer-facing{grounded ? " · Grounded in retrieved replies" : ""}
        </p>
        {answer.length > 160 && (
          <button
            type="button"
            onClick={onToggle}
            className="mt-2 text-[12px] font-medium text-[#175cd3] hover:underline"
          >
            {showFull ? "Show less" : "View full response"}
          </button>
        )}
      </div>
    </section>
  );
}
