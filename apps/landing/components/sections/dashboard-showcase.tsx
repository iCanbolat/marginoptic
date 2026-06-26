import { HugeiconsIcon } from "@hugeicons/react";
import {
  AnalyticsUpIcon,
  Calculator01Icon,
  DashboardSquare01Icon,
} from "@/components/icons";
import { BrowserFrame } from "@/components/browser-frame";
import { DashboardMock } from "@/components/mocks/dashboard-mock";
import { MotionItem, Reveal, RevealGroup } from "@/components/motion/reveal";
import { SectionHeading } from "@/components/sections/section-heading";

const FEATURES = [
  {
    icon: DashboardSquare01Icon,
    title: "Drag-and-drop widgets",
    body: "Rearrange KPIs, charts and tables on a 12-column grid. Build the view your team actually reads.",
  },
  {
    icon: Calculator01Icon,
    title: "Custom metrics & formulas",
    body: "Compose your own metrics — contribution margin, MER, blended ROAS — and drop them in as widgets.",
  },
  {
    icon: AnalyticsUpIcon,
    title: "Unlimited dashboards",
    body: "Spin up focused boards per store, channel or campaign. Each one saves its own layout.",
  },
];

export function DashboardShowcase() {
  return (
    <section
      id="dashboard"
      className="border-y border-border bg-muted/20 py-24 sm:py-28"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="Customizable dashboard"
          title="A dashboard that works the way you do."
          description="Drag widgets into place, add your own metrics, and watch revenue, profit and cost update in near real-time — all on one customizable grid."
        />

        <Reveal delay={0.1} className="mt-12">
          <BrowserFrame className="mx-auto max-w-5xl shadow-[0_40px_80px_-40px_rgba(165,4,54,0.16)]">
            <DashboardMock />
          </BrowserFrame>
        </Reveal>

        <RevealGroup className="mx-auto mt-12 grid max-w-5xl gap-6 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <MotionItem key={f.title} className="flex flex-col gap-3">
              <span className="flex size-10 items-center justify-center bg-primary/10 text-primary ring-1 ring-primary/15">
                <HugeiconsIcon icon={f.icon} className="size-5" strokeWidth={1.9} />
              </span>
              <h3 className="font-heading text-base font-medium">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.body}</p>
            </MotionItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
