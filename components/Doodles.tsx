// Original hand-drawn marker doodles (tendie), in the neo-brutalist zine spirit.

export function HandLoop({ className = "" }: { className?: string }) {
  // rough ellipse to circle a word
  return (
    <svg
      viewBox="0 0 300 110"
      className={className}
      fill="none"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        d="M150 8C70 4 18 26 12 56c-6 32 64 48 142 47 72-1 138-18 134-49C284 22 218 12 150 8c-9 0-9 0 0 0"
        stroke="#69AAC1"
        strokeWidth="3.5"
        strokeLinecap="round"
        opacity="0.95"
      />
    </svg>
  );
}

export function Squiggle({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 14"
      className={className}
      fill="none"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        d="M2 8c14-8 28 6 42 0s28-10 42-2 28 8 42 2 24-8 28-4"
        stroke="#69AAC1"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Underline({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 12"
      className={className}
      fill="none"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        d="M3 7c40-5 90-6 140-3 18 1 38 2 54 5"
        stroke="#69AAC1"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Star({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path
        d="M12 2c.5 5 1.4 7.5 4 8.5C13.4 11.5 12.5 14 12 22c-.5-8-1.4-10.5-4-11.5 2.6-1 3.5-3.5 4-8.5z"
        fill="#69AAC1"
      />
    </svg>
  );
}

export function Sparkle({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="#69AAC1" strokeWidth="2" aria-hidden>
      <path d="M12 3v18M3 12h18M6 6l12 12M18 6L6 18" strokeLinecap="round" opacity="0.85" />
    </svg>
  );
}

export function ArrowDoodle({ className = "" }: { className?: string }) {
  // curvy "start here" arrow pointing right
  return (
    <svg viewBox="0 0 90 60" className={className} fill="none" aria-hidden>
      <path
        d="M6 14C26 6 52 10 70 30c4 4 7 9 9 14"
        stroke="#69AAC1"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M88 46c-6 1-12 0-18-3M88 46c-3-5-5-11-5-18"
        stroke="#69AAC1"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
