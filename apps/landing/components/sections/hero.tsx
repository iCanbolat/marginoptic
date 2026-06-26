import { HugeiconsIcon } from "@hugeicons/react";
import {
  AmazonIcon,
  ArrowRight01Icon,
  AuctionIcon,
  GoogleIcon,
  MetaIcon,
  ShoppingBag01Icon,
  TiktokIcon,
} from "@/components/icons";
import { Reveal } from "@/components/motion/reveal";
import { Eyebrow } from "@/components/sections/section-heading";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const WORKS_WITH = [
  { icon: ShoppingBag01Icon, label: "Shopify" },
  { icon: AmazonIcon, label: "Amazon" },
  { icon: AuctionIcon, label: "eBay" },
  { icon: MetaIcon, label: "Meta" },
  { icon: GoogleIcon, label: "Google" },
  { icon: TiktokIcon, label: "TikTok" },
];

export function Hero() {
  return (
    <section
      id="top"
      className="relative overflow-hidden pb-24 pt-36 sm:pb-28 sm:pt-44"
    >
      {/* decorative backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 left-[15%] size-120 rounded-full bg-primary/15 blur-3xl animate-blob" />
        <div
          className="absolute top-0 right-[12%] size-104 rounded-full bg-accent-teal/10 blur-3xl animate-blob"
          style={{ animationDelay: "-9s" }}
        />
        <div className="absolute inset-0 bg-grid opacity-40" />
      </div>

      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="flex flex-col items-center text-center">
          <Reveal>
            <Eyebrow>Multi-channel profit tracking</Eyebrow>
          </Reveal>
          <Reveal delay={0.05}>
            <h1 className="mt-6 max-w-4xl font-heading text-4xl font-semibold leading-[1.05] tracking-tight text-balance sm:text-6xl">
              See your <span className="text-primary">real net profit</span>,
              <br className="hidden sm:block" /> not just revenue.
            </h1>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="mt-5 max-w-xl text-base text-pretty text-muted-foreground sm:text-lg/relaxed">
              MarginOptic unifies your Shopify, Amazon and eBay sales with ad
              spend, COGS, shipping and fees — so you finally know what every
              order, product and campaign actually earns.
            </p>
          </Reveal>
          <Reveal delay={0.18}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a
                href="#pricing"
                className={cn(buttonVariants({ size: "xl" }), "gap-2")}
              >
                Start free trial
                <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
              </a>
            </div>
          </Reveal>
          <Reveal delay={0.24}>
            <p className="mt-4 text-xs text-muted-foreground">
              14-day free trial · No credit card required
            </p>
          </Reveal>
          <Reveal delay={0.3}>
            <div className="mt-12 flex flex-col items-center gap-3">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Works with
              </span>
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-muted-foreground">
                {WORKS_WITH.map((w) => (
                  <span
                    key={w.label}
                    className="inline-flex items-center gap-1.5 text-sm font-medium"
                  >
                    <HugeiconsIcon
                      icon={w.icon}
                      className="size-4"
                      strokeWidth={1.8}
                    />
                    {w.label}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
