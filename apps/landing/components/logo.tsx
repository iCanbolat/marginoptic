import { cn } from "@/lib/utils";

/** MarginOptic wordmark (SVG copied from apps/web/public). */
export function Logo({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/horizontal-lockup-light.svg"
      alt="MarginOptic"
      className={cn("h-12 w-auto select-none", className)}
      draggable={false}
    />
  );
}

/** Compact M-symbol mark. */
export function LogoMark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/symbol.svg"
      alt="MarginOptic"
      className={cn("h-6 w-auto select-none", className)}
      draggable={false}
    />
  );
}
