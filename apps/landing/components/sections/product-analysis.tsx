import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import {
  AnalyticsUpIcon,
  Coins01Icon,
  PackageIcon,
  Target02Icon,
} from "@/components/icons";
import { ChannelBadge } from "@/components/mocks/channel-badge";
import { ProductsTableMock } from "@/components/mocks/products-table";
import { MotionItem, Reveal, RevealGroup } from "@/components/motion/reveal";
import { SectionHeading } from "@/components/sections/section-heading";
import { PRODUCT_OVERVIEW, type OverviewCard } from "@/lib/mock-data";

const ICONS: Record<OverviewCard["icon"], IconSvgElement> = {
  units: PackageIcon,
  revenue: AnalyticsUpIcon,
  profit: Coins01Icon,
  conversion: Target02Icon,
};

const FILTERS = ["Jan 1 – Today", "All channels", "Sort: Net profit", "Search products…"];

function OverviewTile({ card }: { card: OverviewCard }) {
  return (
    <div className="flex flex-col gap-2 bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{card.label}</span>
        <HugeiconsIcon
          icon={ICONS[card.icon]}
          className="size-4 text-muted-foreground"
          strokeWidth={1.8}
        />
      </div>
      <span className="font-heading text-2xl font-semibold tabular-nums">
        {card.metric}
      </span>
      <div className="flex items-center gap-2">
        <span className="truncate text-xs text-muted-foreground">
          {card.product}
        </span>
        <ChannelBadge channel={card.channel} />
      </div>
    </div>
  );
}

export function ProductAnalysis() {
  return (
    <section id="products" className="py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="Product analysis"
          title="Know which products actually make money."
          description="Per-product revenue, ad spend, ROAS, conversion and true net profit — so you double down on winners and fix the leaks."
        />

        <RevealGroup className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PRODUCT_OVERVIEW.map((c) => (
            <MotionItem key={c.label}>
              <OverviewTile card={c} />
            </MotionItem>
          ))}
        </RevealGroup>

        <Reveal delay={0.1} className="mt-6">
          <div className="bg-card ring-1 ring-foreground/10">
            {/* filter bar */}
            <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
              {FILTERS.map((f, i) => (
                <span
                  key={f}
                  className={`inline-flex h-7 items-center px-2.5 text-xs text-muted-foreground ring-1 ring-border ${
                    i === FILTERS.length - 1 ? "ml-auto min-w-[160px]" : ""
                  }`}
                >
                  {f}
                </span>
              ))}
            </div>
            <div className="overflow-x-auto p-4">
              <ProductsTableMock variant="full" />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
