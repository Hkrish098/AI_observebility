"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getHealth } from "@/lib/api";

export function AppFrame({
  mode,
  children,
}: {
  mode: "support" | "admin";
  children: React.ReactNode;
}) {
  const dark = mode === "support";
  const [status, setStatus] = useState("Checking");

  useEffect(() => {
    if (mode !== "admin") return;
    getHealth()
      .then((health) => setStatus(health.status === "ok" ? "System operational" : "Degraded"))
      .catch(() => setStatus("Desk offline"));
  }, [mode]);

  return (
    <div className={`flex h-screen flex-col ${dark ? "bg-black text-white" : "bg-[#f8f9fb] text-[#101828]"}`}>
      <header
        className={`flex shrink-0 items-center justify-between gap-4 border-b px-5 py-3 ${
          dark ? "border-white/10 bg-black" : "border-[#eaecf0] bg-white"
        }`}
      >
        <div className="flex items-center gap-6">
          <div>
            <p className="text-[16px] font-semibold leading-none">AmazonHelp</p>
            <p className={`mt-1 text-[12px] ${dark ? "text-[#71767b]" : "text-[#667085]"}`}>
              {mode === "support" ? "Customer support" : "Admin console"}
            </p>
          </div>
          <nav className="flex items-center gap-1 text-[13px]">
            <Link
              href="/support"
              className={`rounded-md px-2.5 py-1 ${
                mode === "support"
                  ? dark
                    ? "bg-white text-black"
                    : "bg-[#101828] text-white"
                  : dark
                    ? "text-[#71767b] hover:text-white"
                    : "text-[#667085] hover:text-[#101828]"
              }`}
            >
              Support
            </Link>
            <Link
              href="/admin"
              className={`rounded-md px-2.5 py-1 ${
                mode === "admin"
                  ? "bg-[#101828] text-white"
                  : dark
                    ? "text-[#71767b] hover:text-white"
                    : "text-[#667085] hover:text-[#101828]"
              }`}
            >
              Admin console
            </Link>
          </nav>
        </div>
        {mode === "admin" && (
          <p className="hidden items-center gap-2 text-[12px] text-[#667085] sm:flex">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                status === "System operational" ? "bg-[#12b76a]" : "bg-[#f79009]"
              }`}
            />
            {status}
          </p>
        )}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
      <footer
        className={`shrink-0 border-t px-5 py-2 text-[11px] ${
          dark ? "border-white/10 text-[#71767b]" : "border-[#eaecf0] text-[#667085]"
        }`}
      >
        {mode === "support" ? "AmazonHelp · Customer support" : "AmazonHelp Admin · AI observability"}
      </footer>
    </div>
  );
}
