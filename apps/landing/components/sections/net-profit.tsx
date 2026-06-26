"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle02Icon } from "@/components/icons";
import { CountUp } from "@/components/motion/count-up";
import { MotionItem, Reveal, RevealGroup } from "@/components/motion/reveal";
import { Eyebrow } from "@/components/sections/section-heading";
import { NET_MARGIN, NET_PROFIT, PNL, REVENUE } from "@/lib/mock-data";
import { usd } from "@/lib/utils";

const SUBTRACTS = PNL.filter((r) => r.kind === "subtract");

const POINTS = [
  "Every cost source unified in one ledger",
  "Order-level contribution margin, not estimates",
  "Blended ad spend attributed back to products",
];

export function NetProfit() {
  return (
    <section id="net-profit" className="py-24 sm:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-2 lg:gap-16">
        {/* narrative */}
        <div className="flex flex-col gap-5">
          <Reveal>
            <Eyebrow>The core idea</Eyebrow>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Revenue lies. <br />
              Net profit tells the truth.
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="max-w-md text-sm text-pretty text-muted-foreground sm:text-base/relaxed">
              Your store dashboard celebrates revenue. But COGS, shipping,
              payment fees, taxes, refunds and ad spend are scattered across a
              dozen tools — so the number that actually matters stays hidden.
              MarginOptic puts it all in one place.
            </p>
          </Reveal>
          <RevealGroup className="mt-2 flex flex-col gap-3">
            {POINTS.map((p) => (
              <MotionItem
                key={p}
                className="flex items-center gap-2.5 text-sm"
              >
                <HugeiconsIcon
                  icon={CheckmarkCircle02Icon}
                  className="size-5 shrink-0 text-primary"
                  strokeWidth={2}
                />
                {p}
              </MotionItem>
            ))}
          </RevealGroup>
        </div>

        {/* receipt / waterfall */}
        <Reveal delay={0.1}>
          <div className="bg-card p-6 ring-1 ring-foreground/10 sm:p-8">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-mono uppercase tracking-wider">
                Order-level P&amp;L
              </span>
              <span>Last 30 days</span>
            </div>

            <div className="mt-5 border-b border-border pb-5">
              <span className="text-xs text-muted-foreground">
                What your platform shows
              </span>
              <div className="mt-1 font-heading text-3xl font-semibold tabular-nums text-muted-foreground sm:text-4xl">
                <CountUp to={REVENUE} format={(n) => usd(n)} />
              </div>
            </div>

            <RevealGroup className="flex flex-col gap-2 py-5">
              {SUBTRACTS.map((row) => (
                <MotionItem
                  key={row.label}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-medium tabular-nums text-red-600">
                    −{usd(Math.abs(row.amount))}
                  </span>
                </MotionItem>
              ))}
            </RevealGroup>

            <div className="border-t-2 border-foreground/15 pt-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Your real net profit</span>
                <span className="inline-flex h-5 items-center bg-emerald-500/10 px-2 text-xs font-medium text-emerald-600">
                  {NET_MARGIN}% margin
                </span>
              </div>
              <div className="mt-1 font-heading text-4xl font-semibold tabular-nums text-primary sm:text-5xl">
                <CountUp to={NET_PROFIT} duration={1.9} format={(n) => usd(n)} />
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
