const SIGNALS = ["Decision", "Retrieval", "Trace", "Quality"];

export function ProductSignals() {
  return (
    <p className="text-[12px] tracking-[0.08em] text-[#7d8694]">
      {SIGNALS.map((signal, index) => (
        <span key={signal}>
          {index > 0 && <span className="mx-2 text-[#3a414c]">·</span>}
          {signal}
        </span>
      ))}
    </p>
  );
}
