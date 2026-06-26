"use client";

import { useState } from "react";
import { useMotionValueEvent, useScroll } from "motion/react";
import { useLenis } from "lenis/react";
import { Logo } from "@/components/logo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import { LoginIcon } from "../icons";

const LINKS = [
  { label: "Net Profit", href: "#net-profit" },
  { label: "Dashboard", href: "#dashboard" },
  { label: "Integrations", href: "#integrations" },
  { label: "Pricing", href: "#pricing" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();
  const lenis = useLenis();

  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 16));

  const go = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    lenis?.scrollTo(href, { offset: -72 });
  };

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b transition-all duration-300",
        scrolled
          ? "border-border bg-background/80 backdrop-blur-md"
          : "border-transparent",
      )}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <a
          href="#top"
          onClick={(e) => go(e, "#top")}
          aria-label="MarginOptic home"
        >
          <Logo />
        </a>

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={(e) => go(e, l.href)}
              className="px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <a
            href="#"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "hidden sm:inline-flex",
            )}
          >
            <HugeiconsIcon
              icon={LoginIcon}
              className="size-4"
              strokeWidth={1.8}
            />
            Sign in
          </a>
          <div className="block w-12">
          </div>
        </div>
      </nav>
    </header>
  );
}
