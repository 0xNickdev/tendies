"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePointerParallax, useReducedMotion } from "@/lib/motion";

// The hero's archer follows the cursor: the further the pointer sits from
// the centre, the more the bow is drawn - the figure leans back, the string
// (an SVG overlay) pulls, the arrow trembles. The primary CTA fires it: the
// arrow streaks across the screen, the page flashes lime for a beat, then
// we navigate. Everything is transform/opacity and off under reduced motion.

export function useBowTension() {
  const reduced = useReducedMotion();
  const offset = usePointerParallax(1);
  // 0..1 - how far the string is drawn
  const draw = reduced ? 0 : Math.min(1, Math.hypot(offset.x, offset.y));
  return { offset, draw, reduced };
}

export function ArcherFigure({ className = "" }: { className?: string }) {
  const { offset, draw } = useBowTension();
  return (
    <div
      // The blend that drops the image's black plate lives on the OUTER
      // positioned wrapper in Hero.tsx: any transformed ancestor isolates a
      // blend below it. The figure leans back and glows brighter as the bow draws.
      className={`relative ${className}`}
      style={{
        transform: `translate3d(${offset.x * -16}px, ${offset.y * -10}px, 0) rotate(${offset.x * -2}deg) scale(${1 + draw * 0.03})`,
        transition: "transform 80ms linear",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/hero-archer.png"
        alt=""
        className="h-full w-auto"
        style={{ filter: `drop-shadow(0 0 ${8 + draw * 26}px rgba(212,250,9,${0.15 + draw * 0.45}))` }}
      />
    </div>
  );
}

// Wraps the primary CTA. On click: fire, flash, then go.
export function ShotLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [firing, setFiring] = useState(false);
  const from = useRef({ x: 0, y: 0 });

  const fire = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (reduced || e.metaKey || e.ctrlKey) return; // plain navigation
      e.preventDefault();
      const r = e.currentTarget.getBoundingClientRect();
      from.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      setFiring(true);
      setTimeout(() => router.push(href), 520);
    },
    [href, reduced, router],
  );

  useEffect(() => {
    if (!firing) return;
    const t = setTimeout(() => setFiring(false), 1200);
    return () => clearTimeout(t);
  }, [firing]);

  return (
    <>
      <a href={href} onClick={fire} className={className}>
        {children}
      </a>
      {firing && (
        <div className="pointer-events-none fixed inset-0 z-[100]" aria-hidden>
          {/* the arrow, from the button off to the top-right */}
          <svg
            className="absolute"
            style={{
              left: from.current.x,
              top: from.current.y,
              width: 120,
              height: 24,
              transform: "translate(-50%,-50%) rotate(-28deg)",
              animation: "shot 480ms cubic-bezier(.2,.8,.2,1) forwards",
              filter: "drop-shadow(0 0 10px rgba(212,250,9,0.9))",
            }}
            viewBox="0 0 120 24"
          >
            <line x1="4" y1="12" x2="100" y2="12" stroke="#D4FA09" strokeWidth="3" strokeLinecap="round" />
            <path d="M118 12 L100 4 L100 20 Z" fill="#D4FA09" />
            <path d="M4 12 L14 5 M4 12 L14 19 M12 12 L22 5 M12 12 L22 19" stroke="#D4FA09" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          {/* the flash */}
          <div className="absolute inset-0 bg-robin" style={{ animation: "flash 700ms ease-out 380ms forwards", opacity: 0 }} />
        </div>
      )}
    </>
  );
}
