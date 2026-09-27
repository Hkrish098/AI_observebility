"use client";

import { CaseContext } from "@/components/admin/CaseContext";
import { ObservabilityPanel } from "@/components/ObservabilityPanel";
import { useCase } from "@/lib/case";

export function AdminConsole() {
  const { latest } = useCase();

  return (
    <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,0.9fr)_minmax(20rem,1.1fr)]">
      <CaseContext />
      <ObservabilityPanel latest={latest} />
    </div>
  );
}
