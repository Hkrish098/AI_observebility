"use client";

import { Thread } from "@/components/customer/Thread";
import { useCase } from "@/lib/case";
import { intentLabel } from "@/lib/labels";

function caseStatus(route?: string) {
  if (route === "escalate") return "Escalated";
  if (route === "clarify") return "Waiting on customer";
  if (route === "auto") return "Answered";
  return "Open";
}

export function CaseContext() {
  const { posts, latest } = useCase();
  const caseId = latest ? latest.trace_id.slice(0, 8).toUpperCase() : null;

  return (
    <section className="flex h-full min-h-0 flex-col border-[#eaecf0] bg-[#101114] text-white lg:border-r">
      <div className="shrink-0 border-b border-white/10 px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">
          Case context
        </p>
        <p className="mt-1 font-mono text-[13px] text-white">
          {caseId ? `Case #${caseId}` : "No case yet"}
        </p>
        <p className="mt-0.5 text-[12px] text-[#98a2b3]">
          {latest ? `${intentLabel(latest.intent) ?? "Inquiry"} · Processed just now` : "Post from customer support to open a case."}
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[12px] sm:grid-cols-4">
          <div>
            <dt className="text-[#98a2b3]">Customer</dt>
            <dd>@you</dd>
          </div>
          <div>
            <dt className="text-[#98a2b3]">Channel</dt>
            <dd>Twitter</dd>
          </div>
          <div>
            <dt className="text-[#98a2b3]">Type</dt>
            <dd>{intentLabel(latest?.intent) ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[#98a2b3]">Status</dt>
            <dd>{caseStatus(latest?.route)}</dd>
          </div>
        </dl>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {posts.length === 0 ? (
          <p className="px-5 py-6 text-[14px] leading-6 text-[#98a2b3]">
            This is the case the customer is in. Open Support, post a tweet, then come back here
            to inspect how it was handled.
          </p>
        ) : (
          <Thread posts={posts} />
        )}
      </div>
    </section>
  );
}
