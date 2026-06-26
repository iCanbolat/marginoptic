"use client";

import { ReactLenis } from "lenis/react";
import type { ReactNode } from "react";

/**
 * Global Lenis smooth scroll. `root` attaches Lenis to <html>, so every section
 * (and Framer Motion's scroll-linked transforms) ride the same smoothed scroll.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  return (
    <ReactLenis
      root
      options={{
        lerp: 0.1,
        duration: 1.2,
        smoothWheel: true,
        wheelMultiplier: 1,
      }}
    >
      {children}
    </ReactLenis>
  );
}
