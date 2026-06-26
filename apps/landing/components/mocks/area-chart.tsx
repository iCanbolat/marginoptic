"use client";

import { motion } from "motion/react";
import { SERIES } from "@/lib/mock-data";

const W = 320;
const H = 150;
const PAD_X = 4;
const PAD_TOP = 14;
const PAD_BOTTOM = 10;

function build() {
  const pts = SERIES;
  const max = Math.max(...pts.map((p) => p.revenue)) * 1.12;
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_TOP - PAD_BOTTOM;
  const x = (i: number) => PAD_X + (i / (pts.length - 1)) * innerW;
  const y = (v: number) => PAD_TOP + innerH - (v / max) * innerH;
  const line = (k: "revenue" | "profit") =>
    pts
      .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p[k]).toFixed(1)}`)
      .join(" ");
  const area = (k: "revenue" | "profit") =>
    `${line(k)} L ${x(pts.length - 1).toFixed(1)} ${(PAD_TOP + innerH).toFixed(1)} L ${x(0).toFixed(1)} ${(PAD_TOP + innerH).toFixed(1)} Z`;
  const baseline = PAD_TOP + innerH;
  return { line, area, baseline };
}

export function AreaChartMock() {
  const { line, area, baseline } = build();

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2" style={{ background: "var(--chart-1)" }} />
          Revenue
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2" style={{ background: "var(--primary)" }} />
          Net Profit
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-full w-full flex-1"
        role="img"
        aria-label="Revenue and net profit trend"
      >
        <defs>
          <linearGradient id="rev-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="pro-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* faint gridlines */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={PAD_X}
            x2={W - PAD_X}
            y1={PAD_TOP + (H - PAD_TOP - PAD_BOTTOM) * f}
            y2={PAD_TOP + (H - PAD_TOP - PAD_BOTTOM) * f}
            stroke="var(--border)"
            strokeWidth="1"
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        <motion.path
          d={area("revenue")}
          fill="url(#rev-fill)"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.5 }}
        />
        <motion.path
          d={area("profit")}
          fill="url(#pro-fill)"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.6 }}
        />
        <motion.path
          d={line("revenue")}
          fill="none"
          stroke="var(--chart-1)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.4, ease: "easeInOut" }}
        />
        <motion.path
          d={line("profit")}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.4, ease: "easeInOut", delay: 0.15 }}
        />
        <line
          x1={PAD_X}
          x2={W - PAD_X}
          y1={baseline}
          y2={baseline}
          stroke="var(--border)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
