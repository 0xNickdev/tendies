"use client";

import { useEffect } from "react";
import { useReducedMotion } from "@/lib/motion";

// Buttons lean toward the cursor by a few pixels and snap back. One document
// listener, transform only, off for touch and reduced motion.
export function Magnetic() {
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced || window.matchMedia("(pointer: coarse)").matches) return;
    const sel = ".btn-robin, .btn-ghost";
    // Rects are measured once per scroll/resize, never per pointer move -
    // getBoundingClientRect on every button on every move was the lag.
    let items: { el: HTMLElement; cx: number; cy: number; r: number }[] = [];
    const measure = () => {
      items = Array.from(document.querySelectorAll<HTMLElement>(sel)).map((el) => {
        const b = el.getBoundingClientRect();
        return { el, cx: b.left + b.width / 2 + window.scrollX, cy: b.top + b.height / 2 + window.scrollY, r: Math.max(b.width, b.height) * 0.9 };
      });
    };
    measure();
    let frame = 0;
    let px = 0, py = 0;
    const apply = () => {
      frame = 0;
      for (const it of items) {
        const dx = px + window.scrollX - it.cx;
        const dy = py + window.scrollY - it.cy;
        const near = Math.hypot(dx, dy) < it.r;
        const t = near ? `translate(${dx * 0.12}px, ${dy * 0.18}px)` : "";
        if (it.el.style.transform !== t) {
          it.el.style.transition = near ? "transform 60ms linear" : "transform 320ms cubic-bezier(.2,.8,.2,1)";
          it.el.style.transform = t;
        }
      }
    };
    const onMove = (e: PointerEvent) => {
      px = e.clientX; py = e.clientY;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [reduced]);
  return null;
}
