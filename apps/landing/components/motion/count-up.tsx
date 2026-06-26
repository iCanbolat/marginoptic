"use client";

import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

/** Counts from 0 → `to` the first time it enters view; respects reduced motion. */
export function CountUp({
  to,
  duration = 1.6,
  format,
  className,
}: {
  to: number;
  duration?: number;
  format: (n: number) => string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const reduce = useReducedMotion();
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setVal(to);
      return;
    }
    const controls = animate(0, to, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setVal(v),
    });
    return () => controls.stop();
  }, [inView, to, duration, reduce]);

  return (
    <span ref={ref} className={className}>
      {format(val)}
    </span>
  );
}
