"use client";

import { useInView, useReducedMotion } from "@/lib/motion";

/* Scroll reveal — content lifts and fades in the first time it enters view.
   With reduced motion it simply renders, already in place. */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const { ref, inView } = useInView<HTMLDivElement>();
  const on = reduced || inView;

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: on ? 1 : 0,
        transform: on ? "none" : "translate3d(0, 18px, 0)",
        transition: reduced
          ? undefined
          : `opacity 520ms cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 520ms cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
        willChange: on ? "auto" : "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}
