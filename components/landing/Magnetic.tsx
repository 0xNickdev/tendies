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
    const onMove = (e: PointerEvent) => {
      document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        const near = Math.hypot(dx, dy) < Math.max(r.width, r.height) * 0.9;
        el.style.transform = near ? `translate(${dx * 0.12}px, ${dy * 0.18}px)` : "";
        el.style.transition = near ? "transform 60ms linear" : "transform 320ms cubic-bezier(.2,.8,.2,1)";
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [reduced]);
  return null;
}
