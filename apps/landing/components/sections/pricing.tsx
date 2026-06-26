"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tick02Icon } from "@/components/icons";
import { Reveal } from "@/components/motion/reveal";
import { SectionHeading } from "@/components/sections/section-heading";
import { buttonVariants } from "@/components/ui/button";
import { PLANS, type Plan } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

function PlanCard({ plan, annual }: { plan: Plan; annual: boolean }) {
  const price = annual ? plan.annual : plan.monthly;
  return (
    <div
      className={cn(
        "relative flex flex-col gap-6 bg-card p-6 sm:p-8",
        plan.highlighted ? "ring-2 ring-primary" : "ring-1 ring-foreground/10",
      )}
    >
      {plan.highlighted && (
        <span className="absolute -top-3 left-8 inline-flex h-6 items-center bg-primary px-2.5 text-xs font-medium text-primary-foreground">
          Most popular
        </span>
      )}
      <div>
        <h3 className="font-heading text-lg font-semibold">{plan.name}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
      </div>
      <div>
        <div className="flex items-end gap-1">
          <span className="font-heading text-4xl font-semibold tabular-nums">
            ${price}
          </span>
          <span className="mb-1 text-sm text-muted-foreground">/mo</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {annual ? "billed annually" : "billed monthly"} · 14-day free trial
        </p>
      </div>
      <a
        href="#"
        className={cn(
          buttonVariants({
            variant: plan.highlighted ? "default" : "outline",
            size: "lg",
          }),
          "w-full",
        )}
      >
        {plan.cta}
      </a>
      <ul className="flex flex-col gap-2.5">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <HugeiconsIcon
              icon={Tick02Icon}
              className="mt-0.5 size-4 shrink-0 text-primary"
              strokeWidth={2.5}
            />
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Pricing() {
  const [annual, setAnnual] = useState(true);

  return (
    <section id="pricing" className="py-24 sm:py-28">
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="Pricing"
          title="Simple pricing. Real profit clarity."
          description="Start with a 14-day free trial — no credit card required. Upgrade only when MarginOptic is already paying for itself."
        />

        <Reveal delay={0.08} className="mt-8 flex justify-center">
          <div className="inline-flex items-center gap-1 bg-muted p-1">
            <button
              type="button"
              onClick={() => setAnnual(false)}
              className={cn(
                "h-8 px-3 text-xs font-medium transition-colors",
                !annual
                  ? "bg-background text-foreground ring-1 ring-foreground/10"
                  : "text-muted-foreground",
              )}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setAnnual(true)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 px-3 text-xs font-medium transition-colors",
                annual
                  ? "bg-background text-foreground ring-1 ring-foreground/10"
                  : "text-muted-foreground",
              )}
            >
              Annual <span className="text-primary">−20%</span>
            </button>
          </div>
        </Reveal>

        <Reveal delay={0.12}>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {PLANS.map((p) => (
              <PlanCard key={p.name} plan={p} annual={annual} />
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
