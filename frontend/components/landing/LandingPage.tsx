import { Hero } from "@/components/landing/Hero";
import { HeroBackground } from "@/components/landing/HeroBackground";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHeader } from "@/components/landing/LandingHeader";

export function LandingPage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[#07090d] text-[#f4f5f7]">
      <HeroBackground />
      <LandingHeader />
      <Hero />
      <LandingFooter />
    </div>
  );
}
