import { cn } from "@/lib/utils";

/** A faux app-window chrome wrapping product mocks (sharp, ring-based). */
export function BrowserFrame({
  url = "app.marginoptic.com",
  children,
  className,
  toolbar,
}: {
  url?: string;
  children: React.ReactNode;
  className?: string;
  toolbar?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden bg-card ring-1 ring-foreground/10",
        className,
      )}
    >
      <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-3 py-2.5">
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-foreground/15" />
          <span className="size-2.5 rounded-full bg-foreground/15" />
          <span className="size-2.5 rounded-full bg-foreground/15" />
        </span>
        <span className="mx-auto inline-flex max-w-[60%] items-center gap-1.5 truncate bg-background px-3 py-1 font-mono text-[11px] text-muted-foreground ring-1 ring-border">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          {url}
        </span>
        <span className="w-10.5" />
      </div>
      {toolbar}
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}
