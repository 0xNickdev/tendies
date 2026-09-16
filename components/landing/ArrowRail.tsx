"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/lib/motion";

// The one image that runs the whole page: a thin lime flight path down the
// left edge, and an arrow that rides it with the scroll. Each section title
// carries data-mark; when the arrow's tip passes one, the title takes a hit
// (see .mark-hit in globals.css). Desktop only - on a phone the rail would
// sit under the copy, and there is no cursor to draw the bow with anyway.
export function ArrowRail() {
  const reduced = useReducedMotion();
  const railRef = useRef<SVGPathElement>(null);
  const arrowRef = useRef<SVGGElement>(null);
  const hit = useRef(new Set<Element>());

  useEffect(() => {
    let frame = 0;
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;

      // draw the path up to the arrow and move the arrow - straight on the
      // DOM, no state, so scrolling never re-renders the page
      const path = railRef.current;
      if (path) {
        path.setAttribute("stroke-dasharray", `${p} 1`);
        const len = path.getTotalLength();
        const at = path.getPointAtLength(len * p);
        const ahead = path.getPointAtLength(Math.min(len, len * p + 2));
        const angle = (Math.atan2(ahead.y - at.y, ahead.x - at.x) * 180) / Math.PI;
        arrowRef.current?.setAttribute("transform", `translate(${at.x} ${at.y}) rotate(${angle})`);
      }

      // hit marks whose top has crossed the arrow's vertical position
      const tipY = window.innerHeight * 0.5;
      document.querySelectorAll<HTMLElement>("[data-mark]").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top < tipY && !hit.current.has(el)) {
          hit.current.add(el);
          el.classList.add("mark-hit");
        }
      });
      frame = 0;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  if (reduced) return null;

  return (
    <div
      className="pointer-events-none fixed inset-y-0 left-0 z-30 hidden w-14 lg:block"
      aria-hidden
    >
      <svg viewBox="0 0 56 1000" preserveAspectRatio="none" className="h-full w-full">
        {/* the flight path: a long shallow S, drawn as the reader scrolls */}
        <path
          d="M 28 0 C 8 220, 48 380, 28 500 S 8 780, 28 1000"
          fill="none"
          stroke="rgba(212,250,9,0.14)"
          strokeWidth="1.5"
          strokeDasharray="4 6"
        />
        <path
          ref={railRef}
          d="M 28 0 C 8 220, 48 380, 28 500 S 8 780, 28 1000"
          fill="none"
          stroke="#D4FA09"
          strokeWidth="1.5"
          pathLength={1}
          strokeDasharray="0 1"
          style={{ filter: "drop-shadow(0 0 6px rgba(212,250,9,0.55))" }}
        />
        {/* the arrow, nose pointing along the path */}
        <g ref={arrowRef} transform="translate(28 0) rotate(90)">
          <line x1="-22" y1="0" x2="0" y2="0" stroke="#D4FA09" strokeWidth="2" strokeLinecap="round" />
          <path d="M 0 0 L -7 -4 L -7 4 Z" fill="#D4FA09" />
          <path d="M -22 0 L -27 -4 M -22 0 L -27 4 M -19 0 L -24 -4 M -19 0 L -24 4" stroke="#D4FA09" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
}
