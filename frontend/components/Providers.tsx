"use client";

import { CaseProvider } from "@/lib/case";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return <CaseProvider>{children}</CaseProvider>;
}
