import type { ReactNode } from "react";

export function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#667085]">
      {children}
    </h3>
  );
}

export function StatusBadge({
  tone,
  label,
}: {
  tone: "ok" | "warn" | "bad" | "info";
  label: string;
}) {
  const tones = {
    ok: "bg-[#ecfdf3] text-[#067647]",
    warn: "bg-[#fffaeb] text-[#b54708]",
    bad: "bg-[#fef3f2] text-[#b42318]",
    info: "bg-[#eff8ff] text-[#175cd3]",
  };
  const dot = {
    ok: "bg-[#12b76a]",
    warn: "bg-[#f79009]",
    bad: "bg-[#f04438]",
    info: "bg-[#2e90fa]",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot[tone]}`} />
      {label}
    </span>
  );
}

export function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="min-w-0 rounded-md border border-[#eaecf0] bg-white px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#667085]">
        {label}
      </p>
      <p className="mt-1 truncate text-[15px] font-semibold text-[#101828]">{value}</p>
      {detail && <p className="mt-0.5 text-[11px] text-[#667085]">{detail}</p>}
    </div>
  );
}

export function ProgressMetric({ label, value }: { label: string; value: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] text-[#344054]">{label}</span>
        <span className="font-mono text-[12px] tabular-nums text-[#101828]">{pct}%</span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[#eaecf0]">
        <div className="h-full rounded-full bg-[#175cd3]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
