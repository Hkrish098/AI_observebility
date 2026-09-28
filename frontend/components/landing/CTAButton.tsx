import Link from "next/link";

export function CTAButton() {
  return (
    <Link
      href="/observability"
      className="group inline-flex items-center gap-3 rounded-full bg-[#f4f5f7] px-6 py-3 text-[13px] font-semibold tracking-[0.14em] text-[#101114] transition-colors duration-300 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f4f5f7]"
    >
      START EXPLORING
      <span aria-hidden="true" className="inline-block transition-transform duration-300 group-hover:translate-x-1">
        →
      </span>
    </Link>
  );
}
