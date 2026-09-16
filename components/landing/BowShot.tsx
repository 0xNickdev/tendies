"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useReducedMotion } from "@/lib/motion";

// The hero's archer follows the cursor: the further the pointer sits from
// the centre, the more the bow is drawn - the figure leans back, the string
// (an SVG overlay) pulls, the arrow trembles. The primary CTA fires it: the
// arrow streaks across the screen, the page flashes lime for a beat, then
// we navigate. Everything is transform/opacity and off under reduced motion.

// Body, bow, string and arrow are driven straight from a requestAnimationFrame
// loop through refs - no React state, so the page does not re-render on
// pointer move. Glow is a separate blurred element whose opacity changes
// (cheap) instead of an animated drop-shadow filter (repaints the layers).
const BOW = { left: 2.3, top: -4, height: 93.5 };
const TIP_TOP = { x: 13.6, y: -3.7 };
const TIP_BOTTOM = { x: 13.6, y: 89.1 };
const NOCK = { restX: 13.6, fullX: 63.3, y: 41 };
const ARROW = { length: 61, height: 7.5 };

export function ArcherFigure({ className = "" }: { className?: string }) {
  const reduced = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const bow = useRef<HTMLImageElement>(null);
  const string = useRef<SVGPolylineElement>(null);
  const halo = useRef<SVGPolylineElement>(null);
  const arrow = useRef<HTMLImageElement>(null);
  const glow = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduced || window.matchMedia("(pointer: coarse)").matches) return;
    const target = { x: 0, y: 0 };
    const cur = { x: 0, y: 0 };
    let frame = 0;
    let idle = true;
    const onMove = (e: PointerEvent) => {
      target.x = (e.clientX / window.innerWidth - 0.5) * 2;
      target.y = (e.clientY / window.innerHeight - 0.5) * 2;
      if (idle) {
        idle = false;
        frame = requestAnimationFrame(tick);
      }
    };
    const tick = () => {
      cur.x += (target.x - cur.x) * 0.1;
      cur.y += (target.y - cur.y) * 0.1;
      const draw = Math.min(1, Math.hypot(cur.x, cur.y));
      const nockX = NOCK.restX + (NOCK.fullX - NOCK.restX) * draw;
      const pts = `${TIP_TOP.x},${TIP_TOP.y} ${nockX},${NOCK.y} ${TIP_BOTTOM.x},${TIP_BOTTOM.y}`;
      if (root.current)
        root.current.style.transform = `translate3d(${cur.x * -16}px, ${cur.y * -10}px, 0) rotate(${cur.x * -2}deg) scale(${1 + draw * 0.03})`;
      if (bow.current) bow.current.style.transform = `scaleX(${1 - draw * 0.08})`;
      string.current?.setAttribute("points", pts);
      halo.current?.setAttribute("points", pts);
      if (arrow.current) {
        const a = arrow.current.style;
        a.left = `${nockX - ARROW.length}%`;
        a.opacity = String(Math.min(1, draw * 1.6));
        a.clipPath = `inset(0 0 0 ${Math.max(0, ((ARROW.length - nockX) / ARROW.length) * 100)}%)`;
        a.animation = draw > 0.8 ? "tremble 90ms linear infinite" : "none";
      }
      if (glow.current) glow.current.style.opacity = String(0.25 + draw * 0.55);
      // settle: stop the loop once the figure has caught up with the pointer
      if (Math.abs(target.x - cur.x) + Math.abs(target.y - cur.y) > 0.002) frame = requestAnimationFrame(tick);
      else idle = true;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, [reduced]);

  return (
    <div ref={root} className={`relative will-change-transform ${className}`} style={{ aspectRatio: "2091 / 1390" }}>
      <div
        ref={glow}
        className="absolute left-[10%] top-[10%] h-[70%] w-[70%] rounded-full bg-robin/40 blur-[90px]"
        style={{ opacity: 0.25 }}
        aria-hidden
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/archer-body.webp" alt="" className="absolute inset-0 h-full w-full" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={bow}
        src="/archer-bow.webp"
        alt=""
        className="absolute"
        style={{ left: `${BOW.left}%`, top: `${BOW.top}%`, height: `${BOW.height}%`, transformOrigin: "left center" }}
      />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
        <polyline ref={halo} points={`${TIP_TOP.x},${TIP_TOP.y} ${NOCK.restX},${NOCK.y} ${TIP_BOTTOM.x},${TIP_BOTTOM.y}`} fill="none" stroke="#0A0B05" strokeWidth="5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" opacity="0.9" />
        <polyline ref={string} points={`${TIP_TOP.x},${TIP_TOP.y} ${NOCK.restX},${NOCK.y} ${TIP_BOTTOM.x},${TIP_BOTTOM.y}`} fill="none" stroke="#D4FA09" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={arrow}
        src="/archer-arrow.webp"
        alt=""
        className="absolute"
        style={{
          left: `${NOCK.restX - ARROW.length}%`,
          top: `${NOCK.y - ARROW.height / 2}%`,
          width: `${ARROW.length}%`,
          opacity: 0,
          filter: "drop-shadow(0 0 1.5px #0A0B05)",
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
