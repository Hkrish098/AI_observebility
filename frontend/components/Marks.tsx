export function BirdMark({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#1d9bf0" />
      <path
        fill="#fff"
        d="M18.2 8.4c-.5.2-1 .4-1.6.4.6-.3 1-.9 1.2-1.5-.5.3-1.1.6-1.8.7A2.7 2.7 0 0 0 12 10.4c0 .2 0 .4.1.6-2.2-.1-4.2-1.2-5.5-2.8-.2.4-.4.9-.4 1.4 0 .9.5 1.8 1.2 2.3-.4 0-.9-.1-1.2-.4v.1c0 1.3.9 2.4 2.2 2.6-.2.1-.5.1-.7.1-.2 0-.3 0-.5-.1.3 1 1.3 1.8 2.4 1.8A5.5 5.5 0 0 1 6 16.6 7.7 7.7 0 0 0 10.2 18c5 0 7.8-4.2 7.8-7.8v-.4c.5-.4 1-.9 1.4-1.4-.5.2-1 .4-1.2.4z"
      />
    </svg>
  );
}

export function AmazonMark({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-label="Amazon" role="img">
      <rect width="64" height="64" rx="32" fill="#ffffff" />
      <text
        x="32"
        y="36"
        textAnchor="middle"
        fill="#111111"
        fontSize="34"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="700"
      >
        a
      </text>
      <path
        d="M12 44c10 9 30 9 42 0"
        fill="none"
        stroke="#ff9900"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path d="M50 40.5l5.5 2.2-2.4 4.2" fill="#ff9900" />
    </svg>
  );
}
