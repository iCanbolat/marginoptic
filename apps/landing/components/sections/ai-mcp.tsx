import { AiChatMock } from "@/components/mocks/ai-chat";
import { MotionItem, Reveal, RevealGroup } from "@/components/motion/reveal";
import { Eyebrow } from "@/components/sections/section-heading";

const TOOLS = [
  "list_stores",
  "get_profit_summary",
  "get_pnl",
  "top_products_by_profit",
  "get_ad_performance",
  "compare_periods",
];

export function AiMcp() {
  return (
    <section id="ai" className="border-y border-border bg-muted/30 py-24 sm:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-2 lg:gap-16">
        <div className="flex flex-col gap-5">
          <Reveal>
            <Eyebrow>AI analysis · MCP</Eyebrow>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Ask your data anything.
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="max-w-md text-sm text-pretty text-muted-foreground sm:text-base/relaxed">
              MarginOptic ships a Model Context Protocol server. Connect Claude
              or any MCP client and let it query your profit data with secure,
              read-only tools — no SQL, no exports.
            </p>
          </Reveal>

          <Reveal delay={0.15}>
            <span className="mt-1 font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Available tools
            </span>
          </Reveal>
          <RevealGroup className="grid grid-cols-2 gap-2 sm:max-w-md">
            {TOOLS.map((t) => (
              <MotionItem
                key={t}
                className="bg-card px-2.5 py-1.5 font-mono text-xs text-foreground/80 ring-1 ring-border"
              >
                {t}
              </MotionItem>
            ))}
          </RevealGroup>
        </div>

        <Reveal delay={0.1}>
          <AiChatMock />
        </Reveal>
      </div>
    </section>
  );
}
