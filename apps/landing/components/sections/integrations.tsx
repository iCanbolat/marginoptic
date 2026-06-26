import { IntegrationOrbit } from "@/components/mocks/integration-orbit";
import { Reveal } from "@/components/motion/reveal";
import { SectionHeading } from "@/components/sections/section-heading";

export function Integrations() {
  return (
    <section id="integrations" className="overflow-hidden py-24 sm:py-16">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="Integrations"
          title="Every channel, one source of truth."
          description="OAuth into your stores and ad accounts in a couple of clicks. MarginOptic pulls orders, costs and spend automatically — then keeps it all in sync, in orbit around your real profit."
        />

        <Reveal delay={0.1} className="mt-14">
          <IntegrationOrbit />
        </Reveal>

      </div>
    </section>
  );
}
