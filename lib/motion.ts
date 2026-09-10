"use client";

import { useEffect, useRef, useState } from "react";

// Everything here degrades to "no motion, final state" when the visitor asks
// for reduced motion, and all animation runs on transform/opacity only.

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return reduced;
}

// Fires once when the element first scrolls into view.
export function useInView<T extends HTMLElement>(rootMargin = "-12% 0px") {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);

  return { ref, inView };
}

// Pointer position as -1..1 around the viewport centre, eased toward the
// target every frame so the parallax lags the cursor slightly.
export function usePointerParallax(strength = 1) {
  const reduced = useReducedMotion();
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (reduced) return;
    // a coarse pointer (touch) has no hover position to follow
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const onMove = (e: PointerEvent) => {
      target.current = {
        x: (e.clientX / window.innerWidth - 0.5) * 2 * strength,
        y: (e.clientY / window.innerHeight - 0.5) * 2 * strength,
      };
    };

    let frame = 0;
    const tick = () => {
      current.current = {
        x: current.current.x + (target.current.x - current.current.x) * 0.06,
        y: current.current.y + (target.current.y - current.current.y) * 0.06,
      };
      setOffset({ ...current.current });
      frame = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    frame = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, [reduced, strength]);

  return offset;
}

// How far the page has scrolled, in pixels, sampled on animation frames.
export function useScrollY() {
  const reduced = useReducedMotion();
  const [y, setY] = useState(0);

  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    let queued = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      frame = requestAnimationFrame(() => {
        setY(window.scrollY);
        queued = false;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [reduced]);

  return y;
}

// Counts a number up once its element is in view.
export function useCountUp(value: number, duration = 1100) {
  const reduced = useReducedMotion();
  const { ref, inView } = useInView<HTMLDivElement>();
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduced || value === 0) {
      setShown(value);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutExpo — fast start, long settle
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      setShown(value * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, reduced, value, duration]);

  return { ref, shown };
}
