"use client";

import { CustomerSupport } from "@/components/customer/CustomerSupport";
import { ObservabilityPanel } from "@/components/ObservabilityPanel";
import { useCase } from "@/lib/case";

export function Desk() {
  const { latest } = useCase();

  return (
    <div className="flex h-screen flex-col bg-[#dfe3e8]">
      <header className="shrink-0 px-5 py-3">
        <p className="text-[16px] font-semibold text-[#101828]">AmazonHelp</p>
        <p className="text-[12px] text-[#667085]">
          Your tweet on the left. How it was handled on the right.
        </p>
      </header>
      <main className="grid min-h-0 flex-1 grid-cols-2 gap-4 px-4">
        <div className="h-full min-h-0 overflow-hidden rounded-2xl border border-black/15 shadow-sm">
          <CustomerSupport />
        </div>
        <div className="h-full min-h-0 overflow-hidden rounded-2xl border border-[#d0d5dd] bg-white shadow-sm">
          <ObservabilityPanel latest={latest} />
        </div>
      </main>
      <footer className="shrink-0 px-5 py-3 text-[12px] text-[#667085]">
        AmazonHelp · customer thread and the decision layer
      </footer>
    </div>
  );
}
