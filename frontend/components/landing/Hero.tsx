import { CTAButton } from "@/components/landing/CTAButton";
import { ProductSignals } from "@/components/landing/ProductSignals";

export function Hero() {
  return (
    <main className="relative z-10 flex w-full min-w-0 flex-1 flex-col items-center justify-center px-5 py-12 text-center sm:px-10 sm:py-16">
      <p className="land-rise text-[11px] font-medium tracking-[0.22em] text-[#9aa3b2] sm:text-[12px] sm:tracking-[0.28em]">
        AI OBSERVABILITY
      </p>
      <h1 className="land-rise land-delay mt-6 w-full max-w-4xl">
        <span className="block text-[clamp(0.7rem,3.2vw,1.15rem)] font-medium tracking-[0.12em] text-[#c5ccd6] sm:tracking-[0.22em]">
          GET INTO THE WORLD OF
        </span>
        <span className="mt-3 block text-[clamp(2rem,9vw,5.75rem)] leading-[0.95] font-semibold tracking-[-0.04em] sm:tracking-[-0.035em]">
          AI Observability
        </span>
      </h1>
      <p className="land-rise land-delay-2 mt-6 max-w-xl text-balance text-[15px] leading-6 text-[#9aa3b2] sm:text-[16px] sm:leading-7">
        See how AI understands customer requests, retrieves context, makes decisions, and
        generates responses.
      </p>
      <div className="land-rise land-delay-3 mt-10">
        <CTAButton />
      </div>
      <div className="land-rise land-delay-3 mt-8">
        <ProductSignals />
      </div>
    </main>
  );
}
