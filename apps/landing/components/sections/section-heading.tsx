import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 bg-primary/8 px-2.5 py-1 font-mono text-[11px] font-medium tracking-[0.18em] text-primary uppercase">
      <span className="size-1.5 rounded-full bg-primary" />
      {children}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        align === "center" && "items-center text-center",
        className,
      )}
    >
      {eyebrow && (
        <Reveal>
          <Eyebrow>{eyebrow}</Eyebrow>
        </Reveal>
      )}
      <Reveal delay={0.05}>
        <h2 className="max-w-2xl font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {title}
        </h2>
      </Reveal>
      {description && (
        <Reveal delay={0.1}>
          <p className="max-w-2xl text-pretty text-sm text-muted-foreground sm:text-base/relaxed">
            {description}
          </p>
        </Reveal>
      )}
    </div>
  );
}
