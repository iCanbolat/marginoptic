import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon } from "@/components/icons";
import { Reveal } from "@/components/motion/reveal";

export function Cta() {
  return (
    <section className="py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal>
          <div className="relative overflow-hidden bg-primary px-6 py-16 text-center text-primary-foreground sm:px-12 sm:py-20">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-30"
            >
              <div className="absolute -left-16 -top-24 size-72 rounded-full bg-primary-foreground/15 blur-3xl" />
              <div className="absolute -bottom-24 -right-10 size-72 rounded-full bg-primary-foreground/10 blur-3xl" />
            </div>

            <div className="relative">
              <h2 className="mx-auto max-w-2xl font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                Start seeing your real net profit today.
              </h2>
              <p className="mx-auto mt-4 max-w-md text-sm text-primary-foreground/75 sm:text-base">
                Connect your first store in minutes. 14-day free trial — no
                credit card required.
              </p>

              <div className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row">
                <input
                  type="email"
                  placeholder="you@yourstore.com"
                  aria-label="Work email"
                  className="h-11 flex-1 bg-primary-foreground/10 px-3 text-sm text-primary-foreground outline-none ring-1 ring-primary-foreground/25 placeholder:text-primary-foreground/55 focus:ring-primary-foreground/50"
                />
                <button
                  type="button"
                  className="inline-flex h-11 shrink-0 items-center justify-center gap-2 bg-background px-5 text-sm font-medium text-foreground transition-colors hover:bg-background/90"
                >
                  Start free trial
                  <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
                </button>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
