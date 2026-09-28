"use client";

import Link from "next/link";
import { CustomerSupport } from "@/components/customer/CustomerSupport";
import { ObservabilityPanel } from "@/components/ObservabilityPanel";
import { useCase, type Post } from "@/lib/case";

function questionFor(posts: Post[], selectedId: string | null) {
  if (!selectedId) return null;
  const index = posts.findIndex((post) => post.id === selectedId);
  if (index <= 0) return null;
  for (let i = index - 1; i >= 0; i -= 1) {
    if (posts[i].kind === "customer") return posts[i].text;
  }
  return null;
}

export function Desk() {
  const { latest, pending, posts, selectedId } = useCase();
  const question = questionFor(posts, selectedId);

  return (
    <div className="flex min-h-dvh flex-col bg-[#dfe3e8] lg:h-dvh">
      <header className="shrink-0 px-5 py-3">
        <p className="text-[12px] text-[#667085]">
          <Link href="/" className="hover:text-[#101828]">
            Home
          </Link>
          <span className="mx-1.5 text-[#98a2b3]">/</span>
          AI Observability
        </p>
        <p className="mt-1 text-[16px] font-semibold text-[#101828]">AmazonHelp</p>
        <p className="text-[12px] text-[#667085]">
          Case context on the left. How it was handled on the right.
        </p>
      </header>
      <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 px-4 lg:grid-cols-2">
        <div className="h-[32rem] min-h-0 overflow-hidden rounded-2xl border border-black/15 shadow-sm lg:h-full">
          <CustomerSupport />
        </div>
        <div className="h-[32rem] min-h-0 overflow-hidden rounded-2xl border border-[#d0d5dd] bg-white shadow-sm lg:h-full">
          <ObservabilityPanel latest={latest} pending={pending} question={question} />
        </div>
      </main>
      <footer className="shrink-0 px-5 py-3 text-[12px] text-[#667085]">
        AmazonHelp · customer thread and the decision layer
      </footer>
    </div>
  );
}
