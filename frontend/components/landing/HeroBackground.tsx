export function HeroBackground() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <div className="landing-grid absolute inset-0" />
      <svg className="landing-trace absolute inset-0 h-full w-full" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
        <g fill="none" stroke="rgba(244,245,247,0.14)" strokeWidth="1">
          <path d="M80 620 C 220 540, 280 420, 420 390 S 640 300, 760 250" />
          <path d="M180 700 C 340 610, 460 560, 620 500 S 900 360, 1120 280" />
          <path d="M40 220 C 180 260, 260 340, 420 360" />
        </g>
        <g fill="rgba(244,245,247,0.45)">
          <circle cx="420" cy="390" r="2.2" />
          <circle cx="760" cy="250" r="2.2" />
          <circle cx="620" cy="500" r="2" />
          <circle cx="1120" cy="280" r="2.2" />
          <circle cx="180" cy="260" r="1.8" />
        </g>
      </svg>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,#07090d_72%)]" />
    </div>
  );
}
