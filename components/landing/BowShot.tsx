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

// Three cut-outs of one scene (public/archer-*.webp, keyed from the
// generated layers): the body is static, the bow sits in the forward hand,
// and the string + arrow are drawn live so they can actually be pulled.
// Geometry is in percent of the body box so it scales with the hero.
const BOW = { left: 2.3, top: -4, height: 93.5 };
const TIP_TOP = { x: 13.6, y: -3.7 };
const TIP_BOTTOM = { x: 13.6, y: 89.1 };
const NOCK = { restX: 13.6, fullX: 63.3, y: 41 };
const ARROW = { length: 61, height: 7.5 };

export function ArcherFigure({ className = "", fired = false }: { className?: string; fired?: boolean }) {
  const { offset, draw } = useBowTension();
  const nockX = NOCK.restX + (NOCK.fullX - NOCK.restX) * draw;
  return (
    <div
      // The blend that drops nothing here - layers are already transparent.
      // The figure leans back and glows brighter as the bow draws.
      className={`relative ${className}`}
      style={{
        aspectRatio: "2091 / 1390",
        transform: `translate3d(${offset.x * -16}px, ${offset.y * -10}px, 0) rotate(${offset.x * -2}deg) scale(${1 + draw * 0.03})`,
        transition: "transform 80ms linear",
        filter: `drop-shadow(0 0 ${8 + draw * 26}px rgba(212,250,9,${0.15 + draw * 0.45}))`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/archer-body.webp" alt="" className="absolute inset-0 h-full w-full" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/archer-bow.webp"
        alt=""
        className="absolute"
        style={{
          left: `${BOW.left}%`,
          top: `${BOW.top}%`,
          height: `${BOW.height}%`,
          // the limbs flex back a touch at full draw
          transform: `scaleX(${1 - draw * 0.08})`,
          transformOrigin: "left center",
        }}
      />
      {/* the string: two lines from the limb tips to the nock */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
        {/* dark halo first so the string reads over the lime body */}
        <polyline
          points={`${TIP_TOP.x},${TIP_TOP.y} ${nockX},${NOCK.y} ${TIP_BOTTOM.x},${TIP_BOTTOM.y}`}
          fill="none"
          stroke="#0A0B05"
          strokeWidth="5"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          opacity="0.9"
        />
        <polyline
          points={`${TIP_TOP.x},${TIP_TOP.y} ${nockX},${NOCK.y} ${TIP_BOTTOM.x},${TIP_BOTTOM.y}`}
          fill="none"
          stroke="#D4FA09"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
      </svg>
      {/* the arrow: nock on the string, fades in as it is drawn, flies on fire */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/archer-arrow.webp"
        alt=""
        className="absolute"
        style={{
          left: `${nockX - ARROW.length}%`,
          top: `${NOCK.y - ARROW.height / 2}%`,
          width: `${ARROW.length}%`,
          opacity: fired ? 0 : Math.min(1, draw * 1.6),
          // whatever sticks out left of the bow stays hidden - otherwise the
          // shaft would lie across the headline at half draw
          clipPath: `inset(0 0 0 ${Math.max(0, ((ARROW.length - nockX) / ARROW.length) * 100)}%)`,
          // a dark edge so the lime arrow reads across the lime arm
          filter: "drop-shadow(0 0 1.5px #0A0B05) drop-shadow(0 0 1.5px #0A0B05)",
          transform: fired ? "translateX(-140vw)" : undefined,
          transition: fired ? "transform 420ms cubic-bezier(.2,.8,.2,1), opacity 300ms ease-out 200ms" : "opacity 120ms linear",
          animation: !fired && draw > 0.8 ? "tremble 90ms linear infinite" : "none",
        }}
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
