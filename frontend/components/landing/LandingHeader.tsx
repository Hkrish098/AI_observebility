import { SystemStatus } from "@/components/landing/SystemStatus";

export function LandingHeader() {
  return (
    <header className="relative z-10 flex items-start justify-between gap-4 px-5 py-5 sm:px-10 sm:py-6">
      <div className="min-w-0">
        <p className="text-[15px] font-semibold tracking-tight">AmazonHelp</p>
        <p className="mt-1 text-[12px] text-[#9aa3b2]">AI Support Intelligence</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[12px] text-[#d0d5dd] sm:text-[13px]">AI Observability</p>
        <SystemStatus />
      </div>
    </header>
  );
}
