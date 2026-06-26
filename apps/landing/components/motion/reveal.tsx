"use client";

import { motion, useReducedMotion, type Variants } from "motion/react";
import type { ComponentProps, ReactNode } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Single element that fades + slides in once it scrolls into view. */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
  as = "div",
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: "div" | "section" | "span" | "li";
}) {
  const reduce = useReducedMotion();
  const MotionTag = motion[as] as typeof motion.div;
  return (
    <MotionTag
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.6, delay, ease: EASE }}
    >
      {children}
    </MotionTag>
  );
}

/** Stagger container — children using `MotionItem` cascade in. */
export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
};

export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
};

export function RevealGroup({
  children,
  className,
  ...props
}: { children: ReactNode; className?: string } & ComponentProps<
  typeof motion.div
>) {
  return (
    <motion.div
      className={className}
      variants={staggerContainer}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function MotionItem({
  children,
  className,
  ...props
}: { children: ReactNode; className?: string } & ComponentProps<
  typeof motion.div
>) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      variants={reduce ? undefined : itemVariants}
      {...props}
    >
      {children}
    </motion.div>
  );
}
