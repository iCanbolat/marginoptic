"use client";

import { motion } from "motion/react";
import { COST_SEGMENTS } from "@/lib/mock-data";
import { usdCompact } from "@/lib/utils";

const SIZE = 150;
const STROKE = 20;
const R = (SIZE - STROKE) / 2;
const CX = SIZE / 2;

export function DonutMock() {
  const total = COST_SEGMENTS.reduce((s, seg) => s + seg.value, 0);
  let cum = 0;
  const segments = COST_SEGMENTS.map((seg) => {
    const frac = seg.value / total;
    const offset = cum;
    cum += frac;
    return { ...seg, frac, offset };
  });

  return (
    <div className="flex h-full items-center gap-4">
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="size-full">
          <circle
            cx={CX}
            cy={CX}
            r={R}
            fill="none"
            stroke="var(--muted)"
            strokeWidth={STROKE}
          />
          <g transform={`rotate(-90 ${CX} ${CX})`}>
            {segments.map((seg, i) => (
              <motion.circle
                key={seg.label}
                cx={CX}
                cy={CX}
                r={R}
                fill="none"
                stroke={seg.color}
                strokeWidth={STROKE}
                strokeLinecap="butt"
                style={{ pathOffset: seg.offset }}
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: seg.frac * 0.99 }}
                viewport={{ once: true }}
                transition={{
                  duration: 0.9,
                  delay: 0.15 + i * 0.07,
                  ease: "easeOut",
                }}
              />
            ))}
          </g>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] text-muted-foreground">Total cost</span>
          <span className="font-heading text-base font-semibold tabular-nums">
            {usdCompact(total)}
          </span>
        </div>
      </div>
      <ul className="grid flex-1 grid-cols-1 gap-x-3 gap-y-1 text-xs sm:grid-cols-2">
        {COST_SEGMENTS.map((seg) => (
          <li key={seg.label} className="flex items-center gap-1.5">
            <span
              className="size-2 shrink-0"
              style={{ background: seg.color }}
            />
            <span className="truncate text-muted-foreground">{seg.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
