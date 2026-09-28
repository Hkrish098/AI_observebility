"use client";

import { useEffect, useState } from "react";
import {
  type ChatResponse,
  type RetrievedChunk,
  type SpanRecord,
} from "@/lib/api";
import { criticalityLabel, emotionLabel, intentLabel, stepLabel } from "@/lib/labels";
import {
  costRows,
  explainFlag,
  formatLatency,
  resultList,
  routeName,
  routerConfidence,
  shareOfTotal,
  spanByType,
  TOKEN_HELP,
  tokenLabel,
  untracedLatency,
} from "@/lib/observe";
import { MetricCard, SectionHeader, StatusBadge } from "@/components/observability/ui";

type Props = {
  latest: ChatResponse | null;
  pending?: boolean;
  question?: string | null;
};

function runStatus(latest: ChatResponse): {
  tone: "ok" | "warn" | "bad";
  label: string;
} {
  if (latest.spans.some((span) => span.status === "error")) {
    return { tone: "bad", label: "Failed" };
  }
  if (latest.route === "escalate") return { tone: "bad", label: "Escalated" };
  return latest.is_flagged
    ? { tone: "warn", label: "Warning" }
    : { tone: "ok", label: "Completed" };
}

function statusExplanation(latest: ChatResponse) {
  const status = runStatus(latest);
  if (status.label === "Failed") return "A traced step returned an error.";
  if (status.label === "Escalated") {
    return latest.flag_reason ?? latest.escalate_reason ?? "A person has to take this.";
  }
  if (status.label === "Warning") return explainFlag(latest.flag_reason);
  return null;
}

function decisionCopy(latest: ChatResponse) {
  if (latest.route === "escalate") {
    return {
      title: "Human escalation required",
      route: "Escalate",
      outcome: latest.escalate_reason ?? "A person has to take this.",
    };
  }
  if (latest.route === "clarify") {
    const missingOrder = (latest.escalate_reason ?? "").toLowerCase().includes("order id");
    const asksForOrder = latest.answer.toLowerCase().includes("order id");
    return {
      title: missingOrder || asksForOrder ? "Asked for the order ID" : "Asked for more detail",
      route: "Clarification",
      outcome: missingOrder
        ? "Additional order information is required before taking an order-specific action."
        : (latest.escalate_reason ?? "More detail is required before answering."),
    };
  }
  return {
    title: "Amazon Help answered",
    route: "Auto-response",
    outcome: latest.escalate_reason ?? "A reply was sent from past Help answers.",
  };
}

function decisionFactors(latest: ChatResponse) {
  const factors: string[] = [];
  const retrieved = resultList(spanByType(latest, "retriever"))?.length ?? null;
  const used = latest.retrieved_chunks.length;
  const missingOrder = (latest.escalate_reason ?? "").toLowerCase().includes("order id");
  if (missingOrder) factors.push("Order ID was not in the tweet");
  if (latest.route === "clarify" && !spanByType(latest, "llm")) {
    factors.push("Reply came from the clarification template");
  }
  if (latest.route === "escalate" && latest.ticket_id) {
    factors.push(`Ticket ${latest.ticket_id} was opened`);
  }
  if (retrieved != null && retrieved > 0 && used === 0) {
    factors.push(`${retrieved} candidates retrieved, none attached to the reply`);
  }
  if (used > 0) {
    factors.push(`${used} source${used === 1 ? "" : "s"} attached to the reply`);
  }
  return factors;
}

function spanDetail(span: SpanRecord) {
  const count = resultList(span)?.length;
  if (span.span_type === "retriever" && count != null) return `${count} candidates retrieved`;
  if (span.span_type === "rerank" && count != null) return `${count} candidates ranked`;
  if (span.span_type === "rerank") return "Sources ranked";
  if (span.span_type === "embed") {
    const vector = resultList(span);
    return vector && vector.length > 0 ? "Query embedded for search" : "No embedding returned";
  }
  if (span.span_type === "llm" && span.status === "ok") return "Customer-facing draft";
  if (span.span_type === "router") return "Intent path chosen";
  if (span.status === "error") return "This step failed";
  return null;
}

export function ObservabilityPanel({ latest, pending = false, question = null }: Props) {
  const [openStep, setOpenStep] = useState<string | null>(null);
  const [openChunk, setOpenChunk] = useState<string | null>(null);
  const [showFull, setShowFull] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOpenStep(null);
    setOpenChunk(null);
    setShowFull(false);
    setShowWhy(false);
    setCopied(false);
  }, [latest?.trace_id]);

  return (
    <aside className="flex h-full min-h-0 min-w-0 flex-col bg-[#f8f9fb] text-[#101828]">
      <header className="shrink-0 border-b border-[#eaecf0] bg-[#f8f9fb] px-4 py-3">
        <p className="text-[11px] font-semibold tracking-[0.1em] text-[#667085] uppercase">
          Observability
        </p>
        <div className="mt-1 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[18px] font-semibold leading-tight">AI execution trace</h2>
            <p className="mt-0.5 font-mono text-[11px] text-[#667085]">
              {latest ? `Run #${latest.trace_id.slice(0, 8)}` : "No run yet"}
            </p>
          </div>
          {latest && (
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(latest.trace_id).then(() => {
                  setCopied(true);
                });
              }}
              className="shrink-0 text-[12px] font-medium text-[#175cd3] hover:underline"
            >
              {copied ? "Copied" : "Copy run ID"}
            </button>
          )}
        </div>
        {latest && (
          <p className="mt-1 text-[12px] text-[#667085]">
            {intentLabel(latest.intent) ?? "Unclear"} · {routeName(latest.route)} · Processed just now
          </p>
        )}
        {pending && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-[#175cd3]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2e90fa]" />
            Processing
          </p>
        )}
        {latest && <RunSummary latest={latest} showWhy={showWhy} onToggle={() => setShowWhy((v) => !v)} />}
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {!latest && (
          <p className="text-[13px] leading-5 text-[#667085]">
            {pending
              ? "The reply is in progress. The trace will appear when the run finishes."
              : "Post a tweet. This inspector shows the decision, what was understood, the steps that ran, the evidence attached, and how long it took."}
          </p>
        )}

        {latest && (
          <>
            <DecisionSection latest={latest} question={question} />
            <UnderstandingSection latest={latest} />
            <TraceSection
              latest={latest}
              openStep={openStep}
              onToggle={(id) => setOpenStep((current) => (current === id ? null : id))}
            />
            <EvidenceSection
              latest={latest}
              openChunk={openChunk}
              onToggle={(id) => setOpenChunk((current) => (current === id ? null : id))}
            />
            <QualitySection latest={latest} />
            <PerformanceSection latest={latest} />
            <FinalSection
              latest={latest}
              showFull={showFull}
              onToggle={() => setShowFull((value) => !value)}
            />
          </>
        )}
      </div>
    </aside>
  );
}

function RunSummary({
  latest,
  showWhy,
  onToggle,
}: {
  latest: ChatResponse;
  showWhy: boolean;
  onToggle: () => void;
}) {
  const status = runStatus(latest);
  const explanation = statusExplanation(latest);
  const used = latest.retrieved_chunks.length;
  const raw = latest.flag_reason;
  const canExplain = status.label === "Warning" || status.label === "Escalated" || status.label === "Failed";
  return (
    <div className="mt-3">
      <div className="rounded-md border border-[#eaecf0] bg-white px-3 py-2.5">
        <StatusBadge {...status} />
        {explanation && <p className="mt-1.5 text-[12px] leading-5 text-[#344054]">{explanation}</p>}
        {canExplain && raw && raw !== explanation && (
          <button
            type="button"
            aria-expanded={showWhy}
            onClick={onToggle}
            className="mt-1 text-[12px] font-medium text-[#175cd3] hover:underline"
          >
            {showWhy ? "Hide reason" : "Why this status?"}
          </button>
        )}
        {showWhy && raw && (
          <p className="mt-1 font-mono text-[11px] leading-5 text-[#667085]">{raw}</p>
        )}
      </div>
      <p className="mt-2 text-[12px] text-[#344054]">
        <span className="font-mono tabular-nums">{formatLatency(latest.total_latency_ms)}</span>
        {" total · "}
        {routeName(latest.route)}
        {" route · "}
        {used} evidence used
      </p>
    </div>
  );
}

function DecisionSection({ latest, question }: { latest: ChatResponse; question: string | null }) {
  const copy = decisionCopy(latest);
  const factors = decisionFactors(latest);
  return (
    <section>
      <SectionHeader>AI decision</SectionHeader>
      <div className="mt-2 border border-[#eaecf0] border-l-2 border-l-[#101828] bg-white px-3 py-3">
        {question && (
          <p className="text-[12px] leading-5 text-[#667085]">
            Asked: {question.length > 140 ? `${question.slice(0, 140)}…` : question}
          </p>
        )}
        <p className="mt-1 text-[16px] font-semibold leading-snug">{copy.title}</p>
        <p className="mt-2 text-[11px] font-medium tracking-[0.06em] text-[#667085] uppercase">
          {copy.route}
        </p>
        <p className="mt-1 text-[13px] leading-5 text-[#344054]">{copy.outcome}</p>
        {latest.route === "escalate" && latest.ticket_id && (
          <p className="mt-2 font-mono text-[12px] text-[#101828]">
            {latest.ticket_id}
            {latest.support_phone ? ` · ${latest.support_phone}` : ""}
          </p>
        )}
        {factors.length > 0 && (
          <div className="mt-3 border-t border-[#eaecf0] pt-2">
            <p className="text-[11px] font-medium tracking-[0.06em] text-[#667085] uppercase">
              Decision factors
            </p>
            <ul className="mt-1 space-y-1">
              {factors.map((factor) => (
                <li key={factor} className="text-[12px] leading-5 text-[#344054]">
                  {factor}
                </li>
              ))}
            </ul>
          </div>
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
        <MetricCard label="Route" value={routeName(latest.route)} />
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
  const remainder = untracedLatency(latest);
  return (
    <section>
      <SectionHeader>Execution trace</SectionHeader>
      <ol className="mt-2">
        {latest.spans.map((span, index) => {
          const open = openStep === span.span_id;
          const last = index === latest.spans.length - 1 && remainder <= 0;
          const failed = span.status === "error";
          const detail = spanDetail(span);
          const confidence = span.span_type === "router" ? routerConfidence(span) : null;
          return (
            <li key={span.span_id} className="relative pl-5">
              {!last && <span className="absolute top-3 bottom-0 left-[5px] w-px bg-[#d0d5dd]" />}
              <span
                className={`absolute top-1.5 left-0 h-2.5 w-2.5 rounded-full border-2 border-[#f8f9fb] ${
                  failed ? "bg-[#f04438]" : "bg-[#12b76a]"
                }`}
              />
              <button
                type="button"
                aria-expanded={open}
                onClick={() => onToggle(span.span_id)}
                className="mb-1 w-full rounded-md px-2 py-1.5 text-left hover:bg-white"
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
                    <span className="block">Status: {failed ? "Failed" : "Completed"}</span>
                    <span className="block">Duration: {formatLatency(span.latency_ms ?? 0)}</span>
                    {detail && <span className="block">{detail}</span>}
                    {confidence != null && (
                      <span className="block">
                        Router confidence: {Math.round(confidence * 100)}%. This is the classifier
                        score, not the evaluation score.
                      </span>
                    )}
                  </span>
                )}
              </button>
            </li>
          );
        })}
        {remainder > 0 && (
          <li className="relative pl-5">
            <span className="absolute top-1.5 left-0 h-2.5 w-2.5 rounded-full border-2 border-[#f8f9fb] bg-[#98a2b3]" />
            <div className="mb-1 px-2 py-1.5">
              <span className="flex items-baseline justify-between gap-3">
                <span className="text-[13px] font-medium">Outside traced steps</span>
                <span className="font-mono text-[11px] tabular-nums text-[#667085]">
                  {formatLatency(remainder)}
                </span>
              </span>
              <span className="mt-0.5 block text-[11px] text-[#667085]">
                Time in the run that is not inside a traced step
              </span>
            </div>
          </li>
        )}
      </ol>
      <p className="mt-1 px-2 font-mono text-[11px] text-[#667085]">
        Total {formatLatency(latest.total_latency_ms)}
      </p>
    </section>
  );
}

function EvidenceSection({
  latest,
  openChunk,
  onToggle,
}: {
  latest: ChatResponse;
  openChunk: string | null;
  onToggle: (id: string) => void;
}) {
  const retrieved = resultList(spanByType(latest, "retriever"));
  const ranked = resultList(spanByType(latest, "rerank"));
  const used = latest.retrieved_chunks;
  const retrievalRan = Boolean(spanByType(latest, "retriever"));
  return (
    <section>
      <SectionHeader>Retrieval and evidence</SectionHeader>
      <dl className="mt-2 grid grid-cols-3 gap-2">
        <Count label="Retrieved" value={retrieved ? String(retrieved.length) : retrievalRan ? "Not tracked" : "Did not run"} />
        <Count label="Ranked" value={ranked ? String(ranked.length) : retrievalRan ? "Not tracked" : "Did not run"} />
        <Count label="Evidence used" value={String(used.length)} />
      </dl>
      <p className="mt-2 text-[12px] leading-5 text-[#667085]">
        {!retrievalRan
          ? "Retrieval did not run for this reply."
          : used.length === 0
            ? "No evidence attached to this response. Retrieved candidates are not the same as evidence used."
            : `${used.length} source${used.length === 1 ? "" : "s"} attached to this response.`}
      </p>
      <ul className="mt-2 space-y-2">
        {used.map((chunk, index) => (
          <EvidenceCard
            key={chunk.chunk_id}
            chunk={chunk}
            index={index}
            open={openChunk === chunk.chunk_id}
            onToggle={() => onToggle(chunk.chunk_id)}
          />
        ))}
      </ul>
    </section>
  );
}

function Count({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-[#eaecf0] bg-white px-2 py-2">
      <dt className="text-[10px] font-medium tracking-[0.06em] text-[#667085] uppercase">{label}</dt>
      <dd className="mt-1 font-mono text-[13px] text-[#101828]">{value}</dd>
    </div>
  );
}

function EvidenceCard({
  chunk,
  index,
  open,
  onToggle,
}: {
  chunk: RetrievedChunk;
  index: number;
  open: boolean;
  onToggle: () => void;
}) {
  const excerpt = chunk.content.length > 160 ? `${chunk.content.slice(0, 160)}…` : chunk.content;
  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="w-full rounded-md border border-[#eaecf0] bg-white px-3 py-2 text-left hover:border-[#d0d5dd]"
      >
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-medium">
              {chunk.source || `Source ${index + 1}`}
            </span>
            <span className="mt-0.5 block text-[11px] text-[#667085]">
              AmazonHelp history · similarity {chunk.similarity.toFixed(2)}
            </span>
            {!open && (
              <span className="mt-1 block text-[12px] leading-5 text-[#344054]">{excerpt}</span>
            )}
          </span>
          <span className="shrink-0 text-[11px] font-medium text-[#067647]">Used</span>
        </span>
        {open && (
          <span className="mt-2 block space-y-1 text-[12px] leading-5 text-[#344054]">
            <span className="block">Similarity: {chunk.similarity.toFixed(2)}</span>
            <span className="block">Status: Used</span>
            <span className="block">{chunk.content}</span>
          </span>
        )}
      </button>
    </li>
  );
}

function QualitySection({ latest }: { latest: ChatResponse }) {
  const score = latest.evaluation_score;
  const hasScore = typeof score === "number";
  const [open, setOpen] = useState(false);
  const best = latest.retrieved_chunks.reduce((max, chunk) => Math.max(max, chunk.similarity), 0);
  if (!hasScore && latest.retrieved_chunks.length === 0) return null;
  return (
    <section>
      <SectionHeader>Response quality</SectionHeader>
      <div className="mt-2 rounded-md border border-[#eaecf0] bg-white px-3 py-3">
        {hasScore && (
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] text-[#344054]">Evaluation score</span>
              <span className="font-mono text-[12px] tabular-nums">{Math.round(score * 100)}%</span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[#eaecf0]">
              <div
                className="h-full rounded-full bg-[#175cd3]"
                style={{ width: `${Math.round(Math.min(1, Math.max(0, score)) * 100)}%` }}
              />
            </div>
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpen((value) => !value)}
              className="mt-2 text-[12px] font-medium text-[#175cd3] hover:underline"
            >
              What this score means
            </button>
            {open && (
              <p className="mt-1 text-[12px] leading-5 text-[#667085]">
                Average of groundedness, answer relevance, and context relevance from the heuristic
                scorer. This is not model confidence.
              </p>
            )}
          </div>
        )}
        {latest.retrieved_chunks.length > 0 && (
          <p className="mt-3 text-[12px] text-[#344054]">
            Best attached similarity{" "}
            <span className="font-mono tabular-nums">{best.toFixed(2)}</span>
          </p>
        )}
      </div>
    </section>
  );
}

function PerformanceSection({ latest }: { latest: ChatResponse }) {
  const total = latest.total_latency_ms;
  const remainder = untracedLatency(latest);
  const rows = latest.spans
    .filter((span) => span.latency_ms != null)
    .map((span) => {
      const ms = span.latency_ms ?? 0;
      const share = shareOfTotal(ms, total);
      return {
        label: stepLabel(span.span_type),
        value: `${formatLatency(ms)}${share == null ? "" : ` · ${share}%`}`,
      };
    });
  if (remainder > 0) {
    const share = shareOfTotal(remainder, total);
    rows.push({
      label: "Other",
      value: `${formatLatency(remainder)}${share == null ? "" : ` · ${share}%`}`,
    });
  }
  return (
    <section>
      <SectionHeader>Performance</SectionHeader>
      <div className="mt-2 space-y-3 rounded-md border border-[#eaecf0] bg-white px-3 py-3">
        <div>
          <p className="text-[11px] font-medium tracking-[0.06em] text-[#667085] uppercase">Latency</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
            <Stat label="Total latency" value={formatLatency(total)} />
            {rows.map((row) => (
              <Stat key={row.label} label={row.label} value={row.value} />
            ))}
          </dl>
        </div>
        <div>
          <p className="text-[11px] font-medium tracking-[0.06em] text-[#667085] uppercase">Usage</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
            <Stat label="Total tokens" value={tokenLabel(latest.total_tokens)} hint={TOKEN_HELP} />
            <Stat label="Evidence used" value={String(latest.retrieved_chunks.length)} />
          </dl>
        </div>
        <div>
          <p className="text-[11px] font-medium tracking-[0.06em] text-[#667085] uppercase">Cost</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
            {costRows(latest).map((row) => (
              <Stat key={row.label} label={row.label} value={row.value} hint={row.hint} />
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-[11px] text-[#667085]">
        {label}
        {hint && (
          <button
            type="button"
            aria-expanded={open}
            aria-label={`About ${label}`}
            onClick={() => setOpen((current) => !current)}
            className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-[#d0d5dd] text-[9px] leading-none text-[#667085]"
          >
            i
          </button>
        )}
      </dt>
      <dd className="font-mono text-[13px] text-[#101828] tabular-nums">{value}</dd>
      {open && hint && <p className="mt-1 text-[11px] leading-4 text-[#667085]">{hint}</p>}
    </div>
  );
}

function FinalSection({
  latest,
  showFull,
  onToggle,
}: {
  latest: ChatResponse;
  showFull: boolean;
  onToggle: () => void;
}) {
  const answer = latest.answer;
  const attached = latest.retrieved_chunks.length > 0;
  const preview = answer.length > 160 ? `${answer.slice(0, 160)}…` : answer;
  return (
    <section className="pb-2">
      <SectionHeader>Final response</SectionHeader>
      <div className="mt-2 rounded-md border border-[#eaecf0] bg-white px-3 py-3">
        <p className="text-[13px] leading-5 text-[#344054]">{showFull ? answer : preview}</p>
        <p className="mt-2 text-[11px] text-[#344054]">
          Customer-facing · {attached ? "Evidence attached" : "No evidence attached"}
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
