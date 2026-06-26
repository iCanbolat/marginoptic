"use client";

import { useRef } from "react";
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
  type MotionValue,
} from "motion/react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AmazonIcon,
  AuctionIcon,
  GoogleIcon,
  MetaIcon,
  ShoppingBag01Icon,
  TiktokIcon,
} from "@/components/icons";
import { LogoMark } from "@/components/logo";
import { AD_PLATFORMS, SALES_CHANNELS, type Integration } from "@/lib/mock-data";

const ICON: Record<Integration["provider"], typeof AmazonIcon> = {
  shopify: ShoppingBag01Icon,
  amazon: AmazonIcon,
  ebay: AuctionIcon,
  meta_ads: MetaIcon,
  google_ads: GoogleIcon,
  tiktok_ads: TiktokIcon,
  amazon_ads: AmazonIcon,
};

function OrbitNode({
  item,
  angleDeg,
  radiusPct,
  counter,
}: {
  item: Integration;
  angleDeg: number;
  radiusPct: number;
  counter: MotionValue<number>;
}) {
  const a = (angleDeg * Math.PI) / 180;
  const left = 50 + radiusPct * Math.cos(a);
  const top = 50 + radiusPct * Math.sin(a);
  return (
    <div
      className="absolute"
      style={{ left: `${left}%`, top: `${top}%`, transform: "translate(-50%, -50%)" }}
    >
      {/* counter-rotate so the tile stays upright while the ring spins */}
      <motion.div
        style={{ rotate: counter }}
        className="flex flex-col items-center gap-1.5"
      >
        <span className="flex size-11 items-center justify-center bg-card shadow-sm ring-1 ring-foreground/10 sm:size-12">
          <HugeiconsIcon
            icon={ICON[item.provider]}
            className="size-5 sm:size-6"
            strokeWidth={1.7}
          />
        </span>
        <span className="text-[10px] font-medium text-muted-foreground">
          {item.label}
        </span>
      </motion.div>
    </div>
  );
}

export function IntegrationOrbit() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const velocity = useVelocity(scrollYProgress);
  const smooth = useSpring(velocity, { damping: 50, stiffness: 350 });
  // |scroll speed| → extra angular velocity ("speeds up as you scroll").
  const boost = useTransform(smooth, (v) => Math.min(Math.abs(v) * 0.6, 1.5));

  const rotInner = useMotionValue(0);
  const rotOuter = useMotionValue(0);
  const counterInner = useTransform(rotInner, (v) => -v);
  const counterOuter = useTransform(rotOuter, (v) => -v);

  useAnimationFrame((_, delta) => {
    if (reduce) return;
    const b = boost.get();
    rotInner.set(rotInner.get() + (0.012 + b * 0.22) * delta);
    rotOuter.set(rotOuter.get() - (0.008 + b * 0.16) * delta);
  });

  return (
    <div
      ref={ref}
      className="relative mx-auto aspect-square w-full max-w-130"
    >
      {/* center glow */}
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 size-44 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl"
      />

      {/* dashed orbit tracks */}
      <div className="absolute left-1/2 top-1/2 size-[58%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-border" />
      <div className="absolute left-1/2 top-1/2 size-[86%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-border" />

      {/* inner ring — sales channels */}
      <motion.div className="absolute inset-0" style={{ rotate: rotInner }}>
        {SALES_CHANNELS.map((item, i) => (
          <OrbitNode
            key={item.provider}
            item={item}
            angleDeg={(360 / SALES_CHANNELS.length) * i - 90}
            radiusPct={29}
            counter={counterInner}
          />
        ))}
      </motion.div>

      {/* outer ring — ad platforms */}
      <motion.div className="absolute inset-0" style={{ rotate: rotOuter }}>
        {AD_PLATFORMS.map((item, i) => (
          <OrbitNode
            key={item.provider}
            item={item}
            angleDeg={(360 / AD_PLATFORMS.length) * i - 90}
            radiusPct={43}
            counter={counterOuter}
          />
        ))}
      </motion.div>

      {/* center hub */}
      <div className="absolute left-1/2 top-1/2 flex size-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center bg-card shadow-sm ring-1 ring-foreground/10">
        <LogoMark className="h-9" />
      </div>
    </div>
  );
}
